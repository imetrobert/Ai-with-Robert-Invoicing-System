// src/components/SurveyDashboard.jsx
import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Navbar from './Navbar'

const TOPIC_LABELS = {
  chatgpt_emails:      'ChatGPT / Emails',
  online_scams:        'Online Scams',
  ai_translate:        'AI Translation',
  ai_images:           'AI Images',
  smartphones_tablets: 'Smartphones & Tablets',
  video_calling:       'Video Calling',
  online_banking:      'Online Banking',
  ai_health:           'AI for Health',
  social_media:        'Social Media',
}

function escapeCSV(val) {
  if (val === null || val === undefined) return ''
  const s = Array.isArray(val) ? val.join('; ') : String(val)
  return s.includes(',') || s.includes('"') || s.includes('\n')
    ? `"${s.replace(/"/g, '""')}"` : s
}

function exportEmailList(responses) {
  const opted = responses.filter(r => r.wants_newsletter && r.email)
  if (opted.length === 0) { alert('No newsletter opt-ins with email addresses found.'); return }
  const rows = opted.map(r => [r.email, r.first_name, r.last_name, r.preferred_language || ''].map(escapeCSV).join(','))
  const csv = ['Email,First Name,Last Name,Language', ...rows].join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `AIwithRobert-EmailList-${new Date().toISOString().split('T')[0]}.csv`
  document.body.appendChild(a); a.click()
  document.body.removeChild(a); URL.revokeObjectURL(url)
}

function exportAllData(responses) {
  const headers = [
    'Date', 'Location', 'First Name', 'Last Name', 'Email', 'Phone', 'Address',
    'Age Range', 'Language', 'Gender',
    'Tech Comfort', 'Tech Interest', 'AI Interest',
    'Topics', 'Other Topic', 'Learning Format', 'Zoom Comfort', 'Online Preference',
    'Ongoing Support', 'Enjoyed Most', 'Next Topic', 'Newsletter'
  ]
  const rows = responses.map(r => [
    r.workshop_date || r.created_at?.split('T')[0], r.workshop_location, r.first_name, r.last_name, r.email, r.phone, r.address,
    r.age_range, r.preferred_language, r.gender,
    r.tech_comfort, r.tech_interest, r.ai_interest,
    (r.topics || []).join('; '), r.topics_other, r.learning_format, r.zoom_comfort, r.online_preference,
    (r.ongoing_support || []).join('; '), r.enjoyed_most, r.next_topic_comments,
    r.wants_newsletter ? 'Yes' : 'No'
  ].map(escapeCSV).join(','))
  const csv = [headers.join(','), ...rows].join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `AIwithRobert-Surveys-${new Date().toISOString().split('T')[0]}.csv`
  document.body.appendChild(a); a.click()
  document.body.removeChild(a); URL.revokeObjectURL(url)
}

export default function SurveyDashboard() {
  const [responses, setResponses] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showDeleteId, setShowDeleteId] = useState(null)

  useEffect(() => { fetchResponses() }, [])

  async function fetchResponses() {
    setLoading(true)
    const { data } = await supabase
      .from('survey_responses')
      .select('*')
      .order('created_at', { ascending: false })
    setResponses(data || [])
    setLoading(false)
  }

  async function handleDelete(id) {
    await supabase.from('survey_responses').delete().eq('id', id)
    setShowDeleteId(null)
    fetchResponses()
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return responses
    const q = search.toLowerCase()
    return responses.filter(r =>
      [r.first_name, r.last_name, r.email, r.phone].some(v => v?.toLowerCase().includes(q))
    )
  }, [responses, search])

  const newsletterCount = responses.filter(r => r.wants_newsletter && r.email).length

  const topicCounts = useMemo(() => {
    const counts = {}
    responses.forEach(r => (r.topics || []).forEach(t => { counts[t] = (counts[t] || 0) + 1 }))
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5)
  }, [responses])

  return (
    <div className="app-layout">
      <Navbar />
      <div className="main-content">

        <div className="page-header">
          <h1>Survey Responses</h1>
          <Link to="/surveys/upload" className="btn btn-primary btn-sm">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Upload Survey
          </Link>
        </div>

        <div className="stats-grid" style={{ marginBottom: 16 }}>
          <div className="card" style={{ padding: '12px 14px' }}>
            <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--muted)', marginBottom: 3 }}>Total Responses</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--navy)' }}>{responses.length}</div>
          </div>
          <div className="card" style={{ padding: '12px 14px' }}>
            <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--muted)', marginBottom: 3 }}>Newsletter Opt-ins</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--success)' }}>{newsletterCount}</div>
          </div>
          <div className="card" style={{ padding: '12px 14px' }}>
            <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--muted)', marginBottom: 3 }}>Top Topic</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--blue)', lineHeight: 1.3, marginTop: 4 }}>
              {topicCounts[0] ? TOPIC_LABELS[topicCounts[0][0]] : '—'}
            </div>
          </div>
        </div>

        {topicCounts.length > 0 && (
          <div className="card" style={{ padding: '14px 16px', marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--muted)', marginBottom: 10 }}>
              Most Requested Topics
            </div>
            {topicCounts.map(([topic, count]) => (
              <div key={topic} style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                  <span>{TOPIC_LABELS[topic] || topic}</span>
                  <span style={{ fontWeight: 700, color: 'var(--blue)' }}>{count}</span>
                </div>
                <div style={{ height: 5, background: 'var(--border)', borderRadius: 999 }}>
                  <div style={{ height: '100%', width: `${(count / responses.length) * 100}%`, background: 'var(--blue)', borderRadius: 999, transition: 'width .4s' }} />
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => exportEmailList(responses)} disabled={newsletterCount === 0}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
            Export Email List ({newsletterCount})
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => exportAllData(filtered)} disabled={filtered.length === 0}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Export All Data ({filtered.length})
          </button>
        </div>

        <div className="form-group" style={{ marginBottom: 12 }}>
          <input type="search" className="form-control" placeholder="Search by name, email, or phone…"
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
            <h3>{search ? 'No results' : 'No survey responses yet'}</h3>
            <p style={{ marginBottom: 16 }}>{search ? 'Try a different search.' : 'Upload your first survey to get started.'}</p>
            {!search && <Link to="/surveys/upload" className="btn btn-primary">Upload Survey</Link>}
          </div>
        ) : (
          <div className="invoice-list">
            {filtered.map(r => (
              <div key={r.id} className="invoice-row" style={{ cursor: 'default' }}>
                <div className="invoice-row-top">
                  <div>
                    <div className="invoice-client">
                      {[r.first_name, r.last_name].filter(Boolean).join(' ') || '(No name)'}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                      {r.email || 'No email'} {r.phone ? `· ${r.phone}` : ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                    <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                      {r.workshop_date || r.created_at?.split('T')[0]}
                    </span>
                    {r.workshop_location && (
                      <span style={{ fontSize: 11, color: 'var(--muted)' }}>{r.workshop_location}</span>
                    )}
                    {r.wants_newsletter && (
                      <span style={{ fontSize: 10, fontWeight: 700, background: 'var(--success-bg)', color: 'var(--success)', padding: '2px 7px', borderRadius: 20 }}>
                        Newsletter ✓
                      </span>
                    )}
                  </div>
                </div>
                <div className="invoice-row-bottom" style={{ gap: 6, flexWrap: 'wrap' }}>
                  {r.age_range && <span className="badge badge-draft">{r.age_range.replace('_', '–').replace('plus', '+')}</span>}
                  {r.ai_interest && <span className="badge badge-sent">AI: {r.ai_interest}</span>}
                  {(r.topics || []).slice(0, 3).map(t => (
                    <span key={t} style={{ fontSize: 10, background: '#f0fdf4', color: '#15803d', padding: '2px 7px', borderRadius: 20, border: '1px solid #86efac' }}>
                      {TOPIC_LABELS[t] || t}
                    </span>
                  ))}
                  {(r.topics || []).length > 3 && (
                    <span style={{ fontSize: 10, color: 'var(--muted)' }}>+{r.topics.length - 3} more</span>
                  )}
                  <button
                    onClick={() => setShowDeleteId(r.id)}
                    className="btn btn-danger btn-sm"
                    style={{ marginLeft: 'auto', padding: '3px 8px', fontSize: 11 }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showDeleteId && (
        <div className="modal-overlay" onClick={() => setShowDeleteId(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Delete Response?</h3>
            <p>This will permanently remove this survey response. This cannot be undone.</p>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setShowDeleteId(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={() => handleDelete(showDeleteId)}>Yes, Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
