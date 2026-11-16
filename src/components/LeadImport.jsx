import { useState } from 'react'
import { supabase } from '../lib/supabase'

// Lets the owner pull a contact-form inquiry or a waitlist sign-up (saved by the two websites in
// the shared Supabase project, tables site_inquiries and waitlist_requests) into a new invoice.
// Read access comes from the toolkit app's RLS policies, so it works for the owner's login only.

const has = (text, re) => re.test(text)

// Best-effort guess of the catalog items a lead asked for, from the form's interest values and the
// waitlist's service labels (EN or FR). The owner can change every line afterwards.
export function suggestServiceIds(lead, site) {
  const ex = lead.extra || {}
  const text = [ex.interest, ex['session-type'], ...(lead.services || [])].filter(Boolean).join(' | ').toLowerCase()
  const out = []
  const add = (id) => { if (!out.includes(id)) out.push(id) }
  if (site === 'business') {
    if (has(text, /assessment|évaluation|evaluation/)) add('biz-assessment-small')
    if (has(text, /workflow|flux de travail|automation/)) add('biz-workflow')
    if (has(text, /training|formation/)) add('biz-training')
    if (has(text, /talk|speaking|conférence|conference/)) add('biz-talk')
    if (has(text, /monthly|mensuel/)) add('biz-support')
  } else {
    if (has(text, /starter|départ|depart/)) add('starter-package')
    else if (has(text, /complete package|forfait complet/)) add('complete-package')
    else if (has(text, /one-on-one-online|online|en ligne/)) add('online-session')
    else if (has(text, /one-on-one-home|in-home|domicile/)) add('inhome-session')
    if (has(text, /group|groupe/)) add('group-workshop')
  }
  return out
}

function when(iso) {
  const d = new Date(iso)
  return isNaN(d) ? '' : d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })
}

export default function LeadImport({ onPick }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [leads, setLeads] = useState([])

  async function load() {
    setLoading(true); setError('')
    const [a, b] = await Promise.all([
      supabase.from('site_inquiries').select('*').neq('status', 'archived').order('created_at', { ascending: false }).limit(60),
      supabase.from('waitlist_requests').select('*').neq('status', 'archived').order('created_at', { ascending: false }).limit(60),
    ])
    setLoading(false)
    if (a.error && b.error) {
      setError('Could not load leads. Run the Supabase migrations from the toolkit repo (site_inquiries.sql, site_capacity.sql) and check that your login has toolkit access.')
      return
    }
    // The toolkit's Leads screen is the source of truth: a lead deleted there leaves its website row behind
    // (marked contacted), and an archived lead should not be offered either. Match by the contact's email.
    // If the toolkit's saved leads cannot be read, fall back to showing everything that is not archived.
    let live = null
    const t = await supabase.from('toolkit_sessions').select('id, lead:data->lead').limit(2000)
    if (!t.error && Array.isArray(t.data)) {
      live = { active: new Set(), archived: new Set() }
      for (const r of t.data) {
        if (!r.lead) continue
        const found = String(r.lead.contact || '').toLowerCase().match(/[^\s·,;]+@[^\s·,;]+\.[^\s·,;]+/)
        if (found) (r.lead.archived ? live.archived : live.active).add(found[0])
      }
    }
    const keep = (r) => {
      if (!live) return true
      const e = String(r.email || '').toLowerCase()
      if (!e) return true
      if (live.active.has(e)) return true
      if (live.archived.has(e)) return false
      return r.status === 'new'   // no lead at all: only rows the toolkit has not turned into a lead yet
    }
    const rows = [
      ...(a.data || []).map(r => ({ ...r, source: 'Inquiry' })),
      ...(b.data || []).map(r => ({ ...r, source: 'Waitlist' })),
    ].filter(keep).sort((x, y) => (x.created_at < y.created_at ? 1 : -1))
    setLeads(rows)
  }

  function toggle() {
    const next = !open
    setOpen(next)
    if (next) load()
  }

  return (
    <div style={{ marginBottom: 12 }}>
      <button type="button" className="btn btn-ghost btn-sm" onClick={toggle}>
        {open ? 'Close lead list' : 'Import a lead'}
      </button>
      {open && (
        <div style={{ marginTop: 8, border: '1px solid var(--border)', borderRadius: 10, background: 'white', maxHeight: 320, overflowY: 'auto' }}>
          {loading && <div style={{ padding: 12, color: 'var(--muted)', fontSize: 13 }}>Loading…</div>}
          {error && <div style={{ padding: 12, color: 'var(--danger)', fontSize: 13 }}>{error}</div>}
          {!loading && !error && leads.length === 0 && (
            <div style={{ padding: 12, color: 'var(--muted)', fontSize: 13 }}>No inquiries or waitlist sign-ups yet.</div>
          )}
          {leads.map(l => (
            <button
              type="button"
              key={l.source + l.id}
              className="autocomplete-item"
              style={{ display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 0, borderBottom: '1px solid var(--border)', padding: '10px 12px', cursor: 'pointer' }}
              onClick={() => { onPick(l); setOpen(false) }}
            >
              <div style={{ fontWeight: 700, fontSize: 14 }}>{l.name}{l.organization ? ` · ${l.organization}` : ''}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                {l.site === 'seniors' ? 'Seniors' : 'Business'} · {l.source} · {when(l.created_at)} · {l.email}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
