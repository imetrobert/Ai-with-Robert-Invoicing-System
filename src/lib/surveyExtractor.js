// src/lib/surveyExtractor.js
// Uses Gemini 1.5 Flash (free tier) to extract survey fields from a PDF/image
// Free tier: 15 req/min, 1500 req/day — more than enough for workshop volumes

const GEMINI_API_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'

const EXTRACTION_PROMPT = `You are extracting data from a handwritten survey form for "AI with Robert" workshops.

Analyze this survey image carefully and extract ALL fields. Return ONLY valid JSON, no markdown, no explanation.

Return exactly this structure (use null for fields you cannot read):
{
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
  "learning_format": "one_on_one" | "small_group" | "online" | "no_preference" | null,
  "zoom_comfort": "very" | "somewhat" | "not_very" | "never_tried" | null,
  "online_preference": "much_more" | "slightly_more" | "same" | "slightly_less" | "much_less" | null,
  "ongoing_support": array of strings from: ["newsletter", "group_workshops", "helpline", "video_tutorials", "private_group"],
  "enjoyed_most": string or null,
  "next_topic_comments": string or null,
  "wants_newsletter": true | false
}

For checkboxes: look for checkmarks, X marks, or filled circles next to options.
For handwritten text: transcribe as accurately as possible.
The form may be 2 pages — extract from all visible content.`

/**
 * Convert a File to base64 string
 */
async function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      // Strip the data:...;base64, prefix
      const base64 = reader.result.split(',')[1]
      resolve(base64)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

/**
 * Convert PDF to images using PDF.js, returns array of base64 PNG strings
 * Falls back to treating PDF as a single image if PDF.js unavailable
 */
async function pdfToImages(file) {
  try {
    // Dynamically load PDF.js from CDN
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
      const viewport = page.getViewport({ scale: 2.0 }) // 2x for better OCR quality
      const canvas = document.createElement('canvas')
      canvas.width = viewport.width
      canvas.height = viewport.height
      const ctx = canvas.getContext('2d')
      await page.render({ canvasContext: ctx, viewport }).promise
      // Convert to base64 JPEG (smaller than PNG, good enough for OCR)
      const base64 = canvas.toDataURL('image/jpeg', 0.85).split(',')[1]
      images.push(base64)
    }

    return images
  } catch (err) {
    console.warn('PDF.js failed, treating as image:', err)
    // Fallback: treat as image directly
    const base64 = await fileToBase64(file)
    return [base64]
  }
}

/**
 * Main extraction function
 * @param {File} file - PDF or image file
 * @param {string} apiKey - Gemini API key
 * @returns {Object} extracted survey fields
 */
export async function extractSurveyFromFile(file, apiKey) {
  if (!apiKey) throw new Error('Gemini API key not configured')

  let imageParts = []

  if (file.type === 'application/pdf') {
    const images = await pdfToImages(file)
    imageParts = images.map(base64 => ({
      inlineData: { mimeType: 'image/jpeg', data: base64 }
    }))
  } else {
    // Image file (jpg, png, etc.)
    const base64 = await fileToBase64(file)
    imageParts = [{ inlineData: { mimeType: file.type, data: base64 } }]
  }

  const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: EXTRACTION_PROMPT },
          ...imageParts
        ]
      }],
      generationConfig: {
        temperature: 0.1,      // Low temp = more deterministic extraction
        maxOutputTokens: 2048,
      }
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

  // gemini-2.5-flash uses "thinking" — parts can include thought + multiple text parts
  // Concatenate ALL non-thought text parts to get the full response
  const parts = data?.candidates?.[0]?.content?.parts || []
  const text = parts
    .filter(p => p.text && !p.thought)
    .map(p => p.text)
    .join('') || parts.filter(p => p.text).map(p => p.text).join('')

  if (!text) {
    console.error('Gemini raw response:', JSON.stringify(data, null, 2))
    throw new Error('Gemini returned an empty response — try again')
  }
  console.log('Gemini raw text:', text)

  // Strip markdown fences
  let stripped = text.replace(/```json|```/g, '').trim()

  // Find the first { and last } to extract the JSON object
  const firstBrace = stripped.indexOf('{')
  const lastBrace = stripped.lastIndexOf('}')

  if (firstBrace === -1) {
    throw new Error('No JSON found — raw: ' + stripped.substring(0, 400))
  }

  // Try progressively from lastBrace backwards until we get valid JSON
  // This handles cases where } appears inside string values
  let parsed = null
  let lastPos = stripped.length - 1
  while (lastPos > firstBrace) {
    const pos = stripped.lastIndexOf('}', lastPos)
    if (pos <= firstBrace) break
    try {
      parsed = JSON.parse(stripped.substring(firstBrace, pos + 1))
      break // success
    } catch {
      lastPos = pos - 1 // try the next } going backwards
    }
  }

  if (!parsed) {
    // Last resort: try fixing trailing commas and incomplete JSON
    try {
      // Add missing closing braces if truncated
      let attempt = stripped.substring(firstBrace)
      const opens = (attempt.match(/\{/g) || []).length
      const closes = (attempt.match(/\}/g) || []).length
      attempt += '}'.repeat(Math.max(0, opens - closes))
      attempt = attempt.replace(/,\s*([}\]])/g, '$1') // remove trailing commas
      parsed = JSON.parse(attempt)
    } catch {
      throw new Error('Could not parse JSON — raw (' + stripped.length + ' chars): ' + stripped.substring(0, 400))
    }
  }

  return parsed
}
