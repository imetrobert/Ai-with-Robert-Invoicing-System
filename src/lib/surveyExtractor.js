// src/lib/surveyExtractor.js
// Uses Gemini 2.5 Flash to extract survey fields from a PDF or image.
// Free tier: 15 req/min, 1500 req/day — more than enough for workshop volumes.

const GEMINI_API_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'

const EXTRACTION_PROMPT = `You are extracting data from a handwritten survey form for "AI with Robert" workshops.

Analyze this survey image carefully and extract ALL fields. Return ONLY valid JSON, no markdown, no explanation.

Return exactly this structure (use null for fields you cannot read):
{
  "workshop_date": string (YYYY-MM-DD) or null,
  "workshop_location": string or null,
  "first_name": string or null,
  "last_name": string or null,
  "email": string or null,
  "phone": string or null,
  "address": string or null,
  "age_range": "under_50" | "50_64" | "65_74" | "75_plus" | null,
  "preferred_language": "english" | "french" | "both" | null,
  "gender": "male" | "female" | "prefer_not" | null,
  "tech_comfort": "very" | "somewhat" | "not_very" | "not_at_all" | null,
  "tech_interest": "very" | "somewhat" | "not_very" | null,
  "ai_interest": "very" | "somewhat" | "not_very" | null,
  "topics": array of strings from: ["chatgpt_emails", "online_scams", "ai_translate", "ai_images", "smartphones_tablets", "video_calling", "online_banking", "ai_health", "social_media"],
  "topics_other": string or null,
  "learning_format": "one_on_one" | "small_group" | "online" | "no_preference" | null,
  "zoom_comfort": "very" | "somewhat" | "not_very" | "never_tried" | null,
  "online_preference": "much_more" | "slightly_more" | "same" | "slightly_less" | "much_less" | null,
  "ongoing_support": array of strings from: ["newsletter", "group_workshops", "helpline", "video_tutorials", "private_group"],
  "enjoyed_most": string or null,
  "next_topic_comments": string or null,
  "wants_newsletter": true | false
}

WHERE TO FIND workshop_date AND workshop_location:
Near the top of page 1, below the "AI with Robert" logo and to the right of the intro line, there are two
handwritten fields labeled "Date" and "Location" on a plain white strip. These are filled in by hand for
this specific session — they are NOT the same as the attendee's own address field further down the form.
- workshop_date: convert whatever date format is handwritten (e.g. "May 28", "5/28/25", "28-05-2025") into
  strict YYYY-MM-DD. If the year is not written, infer the most recent plausible year. If the date field is
  blank or you cannot confidently parse a real date, return null — never guess a date that isn't there.
- workshop_location: transcribe the handwritten location as written (venue name, neighborhood, or both).
  Return null if left blank.

CHECKBOXES AND RADIO BUTTONS:
Every option on this form is a bold, dark-outlined square (checkbox) or circle (radio button) on a white
background, roughly 16x16px, positioned immediately to the left of its label text. A response is marked
with a checkmark, X, or filled/shaded interior inside that specific box — it will visibly break the box's
white interior. Only count an option as selected if the mark is clearly inside or directly overlapping
that option's own box. Do not infer a selection from a mark's proximity to a label, from underlining the
label text instead of the box, or from stray pen strokes between options — when in doubt, treat it as
unmarked. For single-choice questions (radio buttons), there should be at most one marked option; if you
see what looks like two marks, prefer the one most clearly and fully filled and treat the other as unmarked.

HANDWRITTEN TEXT FIELDS (name, email, phone, address, topics_other, enjoyed_most, next_topic_comments):
Transcribe exactly as written, preserving the person's own wording. If a field is left blank or is
genuinely illegible after careful attempt, return null rather than guessing a plausible-sounding value.

The "Other" write-in line under question 4 (topics) is separate from the fixed topic checkboxes — put
whatever is handwritten there into topics_other, not into the topics array.

The form may be 2 pages — extract from all visible content.`

/**
 * Convert a File to base64 string
 */
async function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const base64 = reader.result.split(',')[1]
      resolve(base64)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

/**
 * Convert PDF to images using PDF.js, returns array of base64 JPEG strings.
 * Falls back to treating PDF as a single image if PDF.js is unavailable.
 */
async function pdfToImages(file) {
  try {
    if (!window.pdfjsLib) {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script')
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
        script.onload = resolve
        script.onerror = reject
        document.head.appendChild(script)
      })
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
    }

    const arrayBuffer = await file.arrayBuffer()
    const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise
    const images = []

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum)
      const viewport = page.getViewport({ scale: 2.0 }) // 2x scale for better OCR quality
      const canvas = document.createElement('canvas')
      canvas.width = viewport.width
      canvas.height = viewport.height
      const ctx = canvas.getContext('2d')
      await page.render({ canvasContext: ctx, viewport }).promise
      const base64 = canvas.toDataURL('image/jpeg', 0.85).split(',')[1]
      images.push(base64)
    }

    return images
  } catch (err) {
    console.warn('PDF.js failed, treating PDF as image:', err)
    const base64 = await fileToBase64(file)
    return [base64]
  }
}

/**
 * Extract survey fields from one or more PDF/image files using Gemini.
 * Multiple files (e.g. a front-of-form photo + back-of-form photo) are sent
 * together in a single Gemini call so they're consolidated into one survey.
 * The Gemini API key is stored in localStorage (browser-only, never sent to any server except Gemini).
 *
 * @param {File[]} files - Array of 1-2 PDF or image files representing the same survey
 * @param {string} apiKey - Gemini API key
 * @returns {Object[]} array of extracted survey objects (one per detected respondent)
 */
export async function extractSurveyFromFiles(files, apiKey) {
  if (!apiKey) throw new Error('Gemini API key not configured')
  if (!files || files.length === 0) throw new Error('No file provided')

  let imageParts = []

  for (const file of files) {
    if (file.type === 'application/pdf') {
      const images = await pdfToImages(file)
      imageParts.push(...images.map(base64 => ({
        inlineData: { mimeType: 'image/jpeg', data: base64 }
      })))
    } else {
      const base64 = await fileToBase64(file)
      imageParts.push({ inlineData: { mimeType: file.type, data: base64 } })
    }
  }

  const prompt = files.length > 1
    ? EXTRACTION_PROMPT + `\n\nNote: the ${files.length} images provided are separate photos of the SAME survey form (e.g. front and back). Treat them as one combined form and merge fields across all images into a single result.`
    : EXTRACTION_PROMPT

  const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: prompt },
          ...imageParts
        ]
      }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 4096,
        responseMimeType: 'application/json',
      },
    })
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    const msg = err?.error?.message || response.statusText || `HTTP ${response.status}`
    if (response.status === 429) throw new Error(`Rate limit: ${msg}`)
    if (response.status === 403) throw new Error(`API key rejected: ${msg}`)
    if (response.status === 400) throw new Error(`Bad request: ${msg}`)
    throw new Error(`Gemini API error: ${msg}`)
  }

  const data = await response.json()

  // Gemini 2.5 Flash may return "thinking" parts alongside text parts — collect only text
  const parts = data?.candidates?.[0]?.content?.parts || []
  const text = parts
    .filter(p => p.text && !p.thought)
    .map(p => p.text)
    .join('') || parts.filter(p => p.text).map(p => p.text).join('')

  if (!text || text.trim() === '') {
    const debugInfo = 'parts:' + parts.length + ' types:' + parts.map(p => p.thought ? 'thought' : 'text(' + (p.text||'').length + ')').join(',')
    throw new Error('Empty response from Gemini. ' + debugInfo + ' raw:' + JSON.stringify(data).substring(0, 300))
  }

  let stripped = text.replace(/```json|```/g, '').trim()

  const firstBrace = Math.min(
    stripped.indexOf('{') === -1 ? Infinity : stripped.indexOf('{'),
    stripped.indexOf('[') === -1 ? Infinity : stripped.indexOf('[')
  )

  if (firstBrace === Infinity) {
    throw new Error('No JSON found in response. Preview: ' + stripped.substring(0, 200))
  }

  // Walk backwards from end to find the last valid closing brace (handles } inside strings)
  let parsed = null
  let lastPos = stripped.length - 1
  while (lastPos > firstBrace) {
    const pos = stripped.lastIndexOf('}', lastPos)
    if (pos <= firstBrace) break
    try {
      parsed = JSON.parse(stripped.substring(firstBrace, pos + 1))
      break
    } catch {
      lastPos = pos - 1
    }
  }

  if (!parsed) {
    // Last resort: fix truncated JSON by closing unclosed braces and removing trailing commas
    try {
      let attempt = stripped.substring(firstBrace)
      const opens  = (attempt.match(/\{/g) || []).length
      const closes = (attempt.match(/\}/g) || []).length
      attempt += '}'.repeat(Math.max(0, opens - closes))
      attempt  = attempt.replace(/,\s*([}\]])/g, '$1')
      parsed   = JSON.parse(attempt)
    } catch {
      throw new Error('Could not parse Gemini JSON (' + stripped.length + ' chars): ' + stripped.substring(0, 400))
    }
  }

  return Array.isArray(parsed) ? parsed : [parsed]
}
