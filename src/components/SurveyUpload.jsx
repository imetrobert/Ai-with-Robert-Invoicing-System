// src/components/SurveyUpload.jsx
import { useState, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Navbar from './Navbar'
import { extractSurveyFromFiles } from '../lib/surveyExtractor'

// ─── Constants ────────────────────────────────────────────────────────────────

const TOPICS_OPTIONS = [
  { id: 'chatgpt_emails',    label: 'Using ChatGPT to write emails & answer questions' },
  { id: 'online_scams',      label: 'Spotting online scams & phishing emails' },
  { id: 'ai_translate',      label: 'Using AI to translate text or communicate' },
  { id: 'ai_images',         label: 'Creating AI images & creative AI tools' },
  { id: 'smartphones_tablets', label: 'Getting better at smartphones & tablets' },
  { id: 'video_calling',     label: 'Video calling family & friends (Zoom, FaceTime)' },
  { id: 'online_banking',    label: 'Safe online banking & protecting your accounts' },
  { id: 'ai_health',         label: 'AI for managing health info & appointments' },
  { id: 'social_media',      label: 'Social media basics (Facebook, Instagram)' },
]

const SUPPORT_OPTIONS = [
  { id: 'newsletter',       label: 'Monthly newsletter with tech tips & AI news' },
  { id: 'group_workshops',  label: 'Regular community group workshops' },
  { id: 'helpline',         label: 'On-call helpline for tech questions' },
  { id: 'video_tutorials',  label: 'Short video tutorials by email or WhatsApp' },
  { id: 'private_group',    label: 'Private online group (WhatsApp / Facebook)' },
]

const EMPTY_FORM = {
  workshop_date: new Date().toISOString().split('T')[0],
  workshop_location: '',
  first_name: '', last_name: '', email: '', phone: '', address: '',
  age_range: '', preferred_language: '', gender: '',
  tech_comfort: '', tech_interest: '', ai_interest: '',
  topics: [], topics_other: '', learning_format: '',
  zoom_comfort: '', online_preference: '', ongoing_support: [],
  enjoyed_most: '', next_topic_comments: '',
  wants_newsletter: false,
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function RadioGroup({ label, name, value, onChange, options }) {
  return (
    <div className="form-group">
      <label className="form-label">{label}</label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
        {options.map(opt => (
          <label key={opt.value} style={{
            display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer',
            padding: '6px 12px', borderRadius: 20,
            border: `1.5px solid ${value === opt.value ? 'var(--blue)' : 'var(--border)'}`,
            background: value === opt.value ? 'var(--blue-pale)' : 'white',
            fontSize: 13, fontWeight: value === opt.value ? 600 : 400,
            color: value === opt.value ? 'var(--blue)' : 'var(--text)',
            transition: 'all .15s',
          }}>
            <input
              type="radio" name={name} value={opt.value}
              checked={value === opt.value}
              onChange={() => onChange(opt.value)}
              style={{ display: 'none' }}
            />
            {opt.label}
          </label>
        ))}
      </div>
    </div>
  )
}

function CheckGroup({ label, name, value = [], onChange, options }) {
  const toggle = (id) => {
    const next = value.includes(id) ? value.filter(v => v !== id) : [...value, id]
    onChange(next)
  }
  return (
    <div className="form-group">
      <label className="form-label">{label}</label>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {options.map(opt => (
          <label key={opt.id} style={{
            display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
            padding: '8px 12px', borderRadius: 8,
            border: `1.5px solid ${value.includes(opt.id) ? 'var(--blue)' : 'var(--border)'}`,
            background: value.includes(opt.id) ? 'var(--blue-pale)' : 'white',
            fontSize: 13,
          }}>
            <input
              type="checkbox" checked={value.includes(opt.id)}
              onChange={() => toggle(opt.id)}
              style={{ accentColor: 'var(--blue)', width: 15, height: 15 }}
            />
            <span style={{ color: value.includes(opt.id) ? 'var(--blue)' : 'var(--text)', fontWeight: value.includes(opt.id) ? 600 : 400 }}>
              {opt.label}
            </span>
          </label>
        ))}
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SurveyUpload() {
  const navigate = useNavigate()
  const fileInputRef = useRef(null)
  const secondFileInputRef = useRef(null)

  const [stage, setStage] = useState('upload') // 'upload' | 'staged' | 'extracting' | 'review' | 'saving'
  const [surveys, setSurveys] = useState([]) // all extracted surveys
  const [surveyIndex, setSurveyIndex] = useState(0) // which one we're reviewing
  const [extractLog, setExtractLog] = useState('')
  const [fileName, setFileName] = useState('')
  const [stagedFiles, setStagedFiles] = useState([]) // 1-2 files waiting to be consolidated & extracted
  const [formData, setFormData] = useState(EMPTY_FORM)
  const [error, setError] = useState('')
  const [apiKey] = useState(() => localStorage.getItem('gemini_api_key') || '')
  const [apiKeyInput, setApiKeyInput] = useState(apiKey)
  const [showKeySetup, setShowKeySetup] = useState(!apiKey)

  // ── File drop handling ────────────────────────────────────────────────────
  const [dragOver, setDragOver] = useState(false)

  // Called when the primary drop zone / file picker receives file(s).
  // Accepts 1 or 2 files at once (e.g. selecting both photos together from the iOS photo picker).
  function stageFiles(fileList) {
    if (!fileList || fileList.length === 0) return
    const key = localStorage.getItem('gemini_api_key')
    if (!key) { setShowKeySetup(true); return }

    const incoming = Array.from(fileList).slice(0, 2)
    setStagedFiles(incoming)
    setError('')
    setStage('staged')
  }

  // Called from the "+ Add second photo" slot once a first file is already staged.
  function addSecondFile(file) {
    if (!file) return
    setStagedFiles(prev => [prev[0], file].filter(Boolean).slice(0, 2))
  }

  function removeStagedFile(index) {
    setStagedFiles(prev => {
      const next = prev.filter((_, i) => i !== index)
      if (next.length === 0) setStage('upload')
      return next
    })
  }

  async function runExtraction() {
    if (stagedFiles.length === 0) return
    const key = localStorage.getItem('gemini_api_key')
    if (!key) { setShowKeySetup(true); return }

    const combinedName = stagedFiles.map(f => f.name).join(' + ')
    setFileName(combinedName)
    setStage('extracting')
    setExtractLog(stagedFiles.length > 1 ? 'Reading files…' : 'Reading file…')
    setError('')

    try {
      setExtractLog(stagedFiles.length > 1
        ? 'Sending both photos to Gemini to consolidate…'
        : 'Sending to Gemini for analysis…')
      const extractedArray = await extractSurveyFromFiles(stagedFiles, key)
      const count = extractedArray.length
      setExtractLog(`Extraction complete — found ${count} survey${count > 1 ? 's' : ''}. Please review.`)

      // Merge each extracted survey with defaults
      const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
      const merged = extractedArray.map(extracted => ({
        ...EMPTY_FORM,
        ...Object.fromEntries(
          Object.entries(extracted).map(([k, v]) => [k, v ?? EMPTY_FORM[k] ?? ''])
        ),
        source_pdf_name: combinedName,
        // Use the date Gemini read off the form itself; only fall back to
        // today if it didn't find one there or returned something the date
        // input can't display.
        workshop_date: ISO_DATE.test(extracted.workshop_date)
          ? extracted.workshop_date
          : new Date().toISOString().split('T')[0],
      }))

      setSurveys(merged)
      setSurveyIndex(0)
      setFormData(merged[0])
      setStagedFiles([])
      setStage('review')
    } catch (err) {
      setError(err.message)
      setStage('staged')
    }
  }

  function onDrop(e) {
    e.preventDefault(); setDragOver(false)
    stageFiles(e.dataTransfer.files)
  }

  // ── Form field helpers ────────────────────────────────────────────────────
  const set = (field) => (val) => setFormData(prev => ({ ...prev, [field]: val }))
  const setVal = (field) => (e) => setFormData(prev => ({ ...prev, [field]: e.target.value }))

  // ── Save ──────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!formData.first_name && !formData.email) {
      setError('Please fill in at least a name or email before saving.')
      return
    }
    setStage('saving')
    setError('')

    const { error: dbErr } = await supabase.from('survey_responses').insert([{
      ...formData,
      manually_reviewed: true,
      topics: formData.topics || [],
      ongoing_support: formData.ongoing_support || [],
    }])

    if (dbErr) { setError(dbErr.message); setStage('review'); return }

    // Move to next survey if there are more
    const nextIndex = surveyIndex + 1
    if (nextIndex < surveys.length) {
      setSurveyIndex(nextIndex)
      setFormData(surveys[nextIndex])
      setStage('review')
      setError('')
    } else {
      navigate('/surveys')
    }
  }

  // ── Save API key ──────────────────────────────────────────────────────────
  function saveApiKey() {
    if (!apiKeyInput.trim()) return
    localStorage.setItem('gemini_api_key', apiKeyInput.trim())
    setShowKeySetup(false)
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="app-layout">
      <Navbar />
      <div className="main-content" style={{ maxWidth: 720 }}>

        <div className="page-header">
          <h1>Upload Survey</h1>
          <Link to="/surveys" className="btn btn-ghost btn-sm">← Back to Surveys</Link>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {/* ── API Key Setup ── */}
        {showKeySetup && (
          <div className="card" style={{ marginBottom: 16, padding: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--navy)', marginBottom: 8 }}>
              🔑 One-time Gemini API Key Setup
            </div>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>
              Get your free key at{' '}
              <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" style={{ color: 'var(--blue)' }}>
                aistudio.google.com
              </a>
              {' '}— free tier is 1,500 requests/day, no credit card needed.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                className="form-control"
                type="password"
                placeholder="AIza…"
                value={apiKeyInput}
                onChange={e => setApiKeyInput(e.target.value)}
                style={{ flex: 1 }}
              />
              <button className="btn btn-primary" onClick={saveApiKey}>Save Key</button>
            </div>
            <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8 }}>
              Stored in your browser only — never sent to any server except Gemini.
            </p>
          </div>
        )}

        {/* ── Upload Zone ── */}
        {stage === 'upload' && !showKeySetup && (
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${dragOver ? 'var(--blue)' : 'var(--border)'}`,
              borderRadius: 12,
              padding: '48px 24px',
              textAlign: 'center',
              cursor: 'pointer',
              background: dragOver ? 'var(--blue-pale)' : 'white',
              transition: 'all .2s',
              marginBottom: 16,
            }}
          >
            <div style={{ fontSize: 40, marginBottom: 12 }}>📄</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--navy)', marginBottom: 6 }}>
              Drop survey PDF or photo here
            </div>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
              Accepts PDF, JPG, PNG — Gemini will extract all fields automatically.<br />
              Form on 2 photos (front &amp; back)? Select both at once, or add the second after.
            </div>
            <button className="btn btn-primary" onClick={e => { e.stopPropagation(); fileInputRef.current?.click() }}>
              Choose File(s)
            </button>
            <input
              ref={fileInputRef} type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              multiple
              style={{ display: 'none' }}
              onChange={e => stageFiles(e.target.files)}
            />
          </div>
        )}

        {/* ── Staged Files — confirm / add second photo / extract ── */}
        {stage === 'staged' && !showKeySetup && (
          <div className="card" style={{ padding: 20, marginBottom: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--navy)', marginBottom: 12 }}>
              📎 Ready to consolidate
            </div>

            {stagedFiles.map((f, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 14px', borderRadius: 8, border: '1.5px solid var(--border)',
                marginBottom: 10, background: 'var(--bg)',
              }}>
                <span style={{ fontSize: 13 }}>
                  {i === 0 ? '1️⃣' : '2️⃣'} {f.name}
                </span>
                <button className="btn btn-ghost btn-sm" onClick={() => removeStagedFile(i)}>✕ Remove</button>
              </div>
            ))}

            {stagedFiles.length < 2 && (
              <>
                <button
                  className="btn btn-ghost"
                  style={{ width: '100%', marginBottom: 12, border: '1.5px dashed var(--border)' }}
                  onClick={() => secondFileInputRef.current?.click()}
                >
                  + Add second photo (optional — e.g. back of form)
                </button>
                <input
                  ref={secondFileInputRef} type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  style={{ display: 'none' }}
                  onChange={e => addSecondFile(e.target.files[0])}
                />
              </>
            )}

            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16 }}>
              {stagedFiles.length > 1
                ? 'Both photos will be sent together and consolidated into a single survey.'
                : '1 file is enough to extract — add a second only if the form spans two separate photos.'}
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-ghost" onClick={() => { setStagedFiles([]); setStage('upload'); setError('') }}>
                ← Start Over
              </button>
              <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={runExtraction}>
                {stagedFiles.length > 1 ? 'Consolidate & Extract' : 'Extract Survey Data'}
              </button>
            </div>
          </div>
        )}

        {/* ── Extracting ── */}
        {stage === 'extracting' && (
          <div className="card" style={{ padding: 40, textAlign: 'center', marginBottom: 16 }}>
            <div className="spinner" style={{ margin: '0 auto 16px', borderTopColor: 'var(--blue)', borderColor: 'var(--border)' }} />
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--navy)', marginBottom: 6 }}>
              Analysing {fileName}
            </div>
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>{extractLog}</div>
          </div>
        )}

        {/* ── Review Form ── */}
        {stage === 'review' && (
          <>
            {surveys.length > 1 && (
              <div className="alert alert-success" style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>📋 Survey {surveyIndex + 1} of {surveys.length} — {formData.first_name || 'Unknown'} {formData.last_name || ''}</span>
                <span style={{ fontSize: 12, opacity: 0.8 }}>{surveys.length - surveyIndex - 1} remaining after this</span>
              </div>
            )}
            <div className="alert alert-success" style={{ marginBottom: 16 }}>
              ✅ Gemini extracted the fields below — review for accuracy, correct anything needed, then save.
            </div>

            {/* Section 1 */}
            <div className="card" style={{ marginBottom: 12 }}>
              <div className="card-header"><h2>Personal Information</h2></div>
              <div className="card-body">
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">First Name</label>
                    <input className="form-control" value={formData.first_name} onChange={setVal('first_name')} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Last Name</label>
                    <input className="form-control" value={formData.last_name} onChange={setVal('last_name')} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Email</label>
                    <input className="form-control" type="email" value={formData.email} onChange={setVal('email')} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Phone</label>
                    <input className="form-control" value={formData.phone} onChange={setVal('phone')} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Address / Apt</label>
                  <input className="form-control" value={formData.address} onChange={setVal('address')} />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Workshop Date</label>
                    <input className="form-control" type="date" value={formData.workshop_date} onChange={setVal('workshop_date')} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Workshop Location</label>
                    <input className="form-control" value={formData.workshop_location} onChange={setVal('workshop_location')} placeholder="e.g. Community Library, Room 2" />
                  </div>
                </div>
                <RadioGroup label="Age Range" name="age_range" value={formData.age_range} onChange={set('age_range')}
                  options={[
                    { value: 'under_50', label: 'Under 50' },
                    { value: '50_64',    label: '50–64' },
                    { value: '65_74',    label: '65–74' },
                    { value: '75_plus',  label: '75+' },
                  ]} />
                <RadioGroup label="Preferred Language" name="preferred_language" value={formData.preferred_language} onChange={set('preferred_language')}
                  options={[
                    { value: 'english', label: 'English' },
                    { value: 'french',  label: 'French' },
                    { value: 'both',    label: 'Both / Either' },
                  ]} />
                <RadioGroup label="Gender" name="gender" value={formData.gender} onChange={set('gender')}
                  options={[
                    { value: 'male',       label: 'Male' },
                    { value: 'female',     label: 'Female' },
                    { value: 'prefer_not', label: 'Prefer not to say' },
                  ]} />
              </div>
            </div>

            {/* Section 2 */}
            <div className="card" style={{ marginBottom: 12 }}>
              <div className="card-header"><h2>Technology Comfort</h2></div>
              <div className="card-body">
                <RadioGroup label="1. Comfortable with technology?" name="tech_comfort" value={formData.tech_comfort} onChange={set('tech_comfort')}
                  options={[
                    { value: 'very',        label: 'Very comfortable' },
                    { value: 'somewhat',    label: 'Somewhat' },
                    { value: 'not_very',    label: 'Not very' },
                    { value: 'not_at_all',  label: 'Not at all' },
                  ]} />
                <RadioGroup label="2. Interested in improving tech skills?" name="tech_interest" value={formData.tech_interest} onChange={set('tech_interest')}
                  options={[
                    { value: 'very',     label: 'Very interested' },
                    { value: 'somewhat', label: 'Somewhat' },
                    { value: 'not_very', label: 'Not very' },
                  ]} />
                <RadioGroup label="3. Interested in learning about AI?" name="ai_interest" value={formData.ai_interest} onChange={set('ai_interest')}
                  options={[
                    { value: 'very',     label: 'Very interested' },
                    { value: 'somewhat', label: 'Somewhat' },
                    { value: 'not_very', label: 'Not very' },
                  ]} />
              </div>
            </div>

            {/* Section 3 */}
            <div className="card" style={{ marginBottom: 12 }}>
              <div className="card-header"><h2>Topics & Future Workshops</h2></div>
              <div className="card-body">
                <CheckGroup label="4. Topics of interest" name="topics" value={formData.topics} onChange={set('topics')} options={TOPICS_OPTIONS} />
                <div className="form-group">
                  <label className="form-label">Other topic (from the write-in line)</label>
                  <input className="form-control" value={formData.topics_other} onChange={setVal('topics_other')} />
                </div>
                <RadioGroup label="5. Preferred learning format" name="learning_format" value={formData.learning_format} onChange={set('learning_format')}
                  options={[
                    { value: 'one_on_one',     label: 'One-on-one tutoring' },
                    { value: 'small_group',    label: 'Small group workshop' },
                    { value: 'online',         label: 'Online / virtual class' },
                    { value: 'no_preference',  label: 'No preference' },
                  ]} />
              </div>
            </div>

            {/* Section 4 */}
            <div className="card" style={{ marginBottom: 12 }}>
              <div className="card-header"><h2>How You Like to Learn</h2></div>
              <div className="card-body">
                <RadioGroup label="6. Comfortable joining online video calls?" name="zoom_comfort" value={formData.zoom_comfort} onChange={set('zoom_comfort')}
                  options={[
                    { value: 'very',        label: 'Very comfortable' },
                    { value: 'somewhat',    label: 'Somewhat' },
                    { value: 'not_very',    label: 'Not very' },
                    { value: 'never_tried', label: 'Never tried' },
                  ]} />
                <RadioGroup label="7. Would you attend online instead of in-person?" name="online_preference" value={formData.online_preference} onChange={set('online_preference')}
                  options={[
                    { value: 'much_more',     label: 'Much more likely' },
                    { value: 'slightly_more', label: 'Slightly more likely' },
                    { value: 'same',          label: 'Same / no difference' },
                    { value: 'slightly_less', label: 'Slightly less likely' },
                    { value: 'much_less',     label: 'Much less likely' },
                  ]} />
                <CheckGroup label="8. Ongoing support you'd sign up for" name="ongoing_support" value={formData.ongoing_support} onChange={set('ongoing_support')} options={SUPPORT_OPTIONS} />
              </div>
            </div>

            {/* Section 5 */}
            <div className="card" style={{ marginBottom: 12 }}>
              <div className="card-header"><h2>Feedback</h2></div>
              <div className="card-body">
                <div className="form-group">
                  <label className="form-label">9. What did you enjoy most?</label>
                  <textarea className="form-control" value={formData.enjoyed_most} onChange={setVal('enjoyed_most')} rows={3} />
                </div>
                <div className="form-group">
                  <label className="form-label">10. Next topic / other comments</label>
                  <textarea className="form-control" value={formData.next_topic_comments} onChange={setVal('next_topic_comments')} rows={3} />
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '10px 14px', background: formData.wants_newsletter ? 'var(--success-bg)' : 'var(--bg)', borderRadius: 8, border: `1.5px solid ${formData.wants_newsletter ? '#86efac' : 'var(--border)'}` }}>
                  <input type="checkbox" checked={formData.wants_newsletter} onChange={e => set('wants_newsletter')(e.target.checked)}
                    style={{ accentColor: 'var(--success)', width: 16, height: 16 }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: formData.wants_newsletter ? 'var(--success)' : 'var(--text)' }}>
                    Yes — keep me informed about upcoming workshops & offers
                  </span>
                </label>
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 32 }}>
              <button className="btn btn-ghost" onClick={() => { setStage('upload'); setError('') }}>
                ← Upload Different File
              </button>
              <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center', fontSize: 15, padding: 14 }}
                onClick={handleSave} disabled={stage === 'saving'}>
                {stage === 'saving' ? 'Saving…' : surveys.length > 1 ? `✓ Save & ${surveyIndex + 1 < surveys.length ? `Next (${surveyIndex + 1}/${surveys.length})` : 'Finish'}` : '✓ Save to Database'}
              </button>
            </div>
          </>
        )}

        {/* API key change link */}
        {!showKeySetup && stage === 'upload' && (
          <div style={{ textAlign: 'center', marginTop: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowKeySetup(true)} style={{ fontSize: 11, color: 'var(--muted)' }}>
              🔑 Change Gemini API Key
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
