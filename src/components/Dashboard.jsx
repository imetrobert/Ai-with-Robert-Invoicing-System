import { useState, useEffect, useRef, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Navbar from './Navbar'
import { formatCAD, formatDateShort, formatDate, STATUS_COLORS } from '../lib/invoiceUtils'

// ─── Date helpers ─────────────────────────────────────────────────────────────

function startOfDay(d) {
  const x = new Date(d); x.setHours(0,0,0,0); return x
}
function endOfDay(d) {
  const x = new Date(d); x.setHours(23,59,59,999); return x
}
function toDateInputVal(d) {
  return d.toISOString().split('T')[0]
}

const DATE_PRESETS = [
  { id: 'all',           label: 'All time' },
  { id: 'last7',         label: 'Last 7 days' },
  { id: 'last30',        label: 'Last 30 days' },
  { id: 'thisMonth',     label: 'This month' },
  { id: 'lastMonth',     label: 'Last month' },
  { id: 'custom',        label: 'Custom range' },
]

function getPresetRange(preset) {
  const now = new Date()
  switch (preset) {
    case 'last7': {
      const from = new Date(now); from.setDate(from.getDate() - 6)
      return [startOfDay(from), endOfDay(now)]
    }
    case 'last30': {
      const from = new Date(now); from.setDate(from.getDate() - 29)
      return [startOfDay(from), endOfDay(now)]
    }
    case 'thisMonth': {
      const from = new Date(now.getFullYear(), now.getMonth(), 1)
      return [startOfDay(from), endOfDay(now)]
    }
    case 'lastMonth': {
      const from = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const to   = new Date(now.getFullYear(), now.getMonth(), 0)
      return [startOfDay(from), endOfDay(to)]
    }
    default: return null
  }
}

// ─── CSV export ──────────────────────────────────────────────────────────────

function escapeCSV(val) {
  if (val === null || val === undefined) return ''
  const s = String(val)
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

function exportToCSV(invoices) {
  const headers = [
    'Invoice #', 'Status', 'Client Name', 'Client Email',
    'Service Date', 'Created Date',
    'Province',
    'Address Line 1', 'Address Line 2', 'City', 'Postal Code',
    'Subtotal (CAD)', 'Discount Type', 'Discount Value', 'Discount Amount (CAD)',
    'Tax Enabled', 'Tax Amount (CAD)', 'Total (CAD)',
    'Emailed', 'Emailed Date', 'Views',
    'Notes',
  ]

  const rows = invoices.map(inv => [
    inv.invoice_number,
    inv.status || 'draft',
    inv.client_name,
    inv.client_email || '',
    inv.service_date || '',
    inv.created_at ? inv.created_at.split('T')[0] : '',
    inv.province || '',
    inv.address_line1 || '',
    inv.address_line2 || '',
    inv.address_city || '',
    inv.address_postal || '',
    inv.subtotal != null ? inv.subtotal.toFixed(2) : '',
    inv.discount_type || 'none',
    inv.discount_value != null ? inv.discount_value : '',
    inv.discount_amount != null ? inv.discount_amount.toFixed(2) : '0.00',
    inv.gst_enabled ? 'Yes' : 'No',
    inv.gst_amount != null ? inv.gst_amount.toFixed(2) : '0.00',
    inv.total != null ? inv.total.toFixed(2) : '',
    inv.emailed_at ? 'Yes' : 'No',
    inv.emailed_at ? inv.emailed_at.split('T')[0] : '',
    inv.view_count != null ? inv.view_count : 0,
    inv.notes || '',
  ])

  const csv = [headers, ...rows]
    .map(row => row.map(escapeCSV).join(','))
    .join('\n')

  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  const now  = new Date()
  a.href     = url
  a.download = `AIwithRobert-Invoices-${now.toISOString().split('T')[0]}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [invoices, setInvoices]       = useState([])
  const [loading, setLoading]         = useState(true)
  const [session, setSession]         = useState(null)
  const navigate                      = useNavigate()

  // ── Filter state ──────────────────────────────────────────────────────────
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [search, setSearch]           = useState('')       // legacy quick search (still shown above list)
  const [statusFilter, setStatusFilter] = useState('all') // 'all'|'draft'|'sent'|'paid'
  const [datePreset, setDatePreset]   = useState('all')
  const [customFrom, setCustomFrom]   = useState('')
  const [customTo, setCustomTo]       = useState('')

  // Client-name filter with autocomplete
  const [clientFilter, setClientFilter]           = useState('')
  const [clientSuggestions, setClientSuggestions] = useState([])
  const [showClientSug, setShowClientSug]         = useState(false)
  const clientFilterRef = useRef(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session))
    fetchInvoices()
  }, [])

  async function fetchInvoices() {
    setLoading(true)
    const { data, error } = await supabase
      .from('invoices')
      .select(`
        id, invoice_number, client_name, client_email, service_date, created_at,
        total, subtotal, discount_type, discount_value, discount_amount,
        gst_enabled, gst_amount,
        province, address_line1, address_line2, address_city, address_postal,
        status, emailed_at, view_count, notes
      `)
      .order('created_at', { ascending: false })
    if (!error) setInvoices(data || [])
    setLoading(false)
  }

  // ── Client autocomplete ────────────────────────────────────────────────────
  const allClientNames = useMemo(() =>
    [...new Set(invoices.map(i => i.client_name).filter(Boolean))].sort()
  , [invoices])

  function handleClientFilterInput(val) {
    setClientFilter(val)
    if (val.length > 0) {
      const matches = allClientNames.filter(c =>
        c.toLowerCase().includes(val.toLowerCase())
      )
      setClientSuggestions(matches)
      setShowClientSug(matches.length > 0)
    } else {
      setShowClientSug(false)
    }
  }

  // ── Filtering logic ────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let result = invoices

    // Quick search (invoice # or client name)
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(inv =>
        inv.client_name?.toLowerCase().includes(q) ||
        inv.invoice_number?.toLowerCase().includes(q)
      )
    }

    // Status
    if (statusFilter !== 'all') {
      result = result.filter(inv => (inv.status || 'draft') === statusFilter)
    }

    // Client name filter (exact/partial)
    if (clientFilter.trim()) {
      const q = clientFilter.toLowerCase()
      result = result.filter(inv => inv.client_name?.toLowerCase().includes(q))
    }

    // Date range
    if (datePreset !== 'all') {
      let fromDate, toDate
      if (datePreset === 'custom') {
        fromDate = customFrom ? startOfDay(new Date(customFrom + 'T00:00:00')) : null
        toDate   = customTo   ? endOfDay(new Date(customTo   + 'T00:00:00')) : null
      } else {
        const range = getPresetRange(datePreset)
        if (range) [fromDate, toDate] = range
      }
      if (fromDate || toDate) {
        result = result.filter(inv => {
          if (!inv.created_at) return false
          const d = new Date(inv.created_at)
          if (fromDate && d < fromDate) return false
          if (toDate   && d > toDate)   return false
          return true
        })
      }
    }

    return result
  }, [invoices, search, statusFilter, clientFilter, datePreset, customFrom, customTo])

  // ── Active filter count badge ──────────────────────────────────────────────
  const activeFilterCount = [
    statusFilter !== 'all',
    datePreset !== 'all',
    clientFilter.trim() !== '',
  ].filter(Boolean).length

  // ── Stats (based on ALL invoices, not filtered view) ──────────────────────
  const totalRevenue = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + (i.total || 0), 0)
  const outstanding  = invoices.filter(i => i.status !== 'paid').reduce((s, i) => s + (i.total || 0), 0)

  // EmailJS quota
  const emailsUsed = (() => {
    const now = new Date()
    const cycleStart = new Date(now.getFullYear(), now.getMonth(), 10)
    if (now < cycleStart) cycleStart.setMonth(cycleStart.getMonth() - 1)
    return invoices.filter(i => i.emailed_at && new Date(i.emailed_at) >= cycleStart).length
  })()
  const EMAIL_LIMIT = 200
  const emailsLeft  = EMAIL_LIMIT - emailsUsed
  const emailPct    = (emailsUsed / EMAIL_LIMIT) * 100
  const emailColor  = emailPct >= 95 ? 'var(--danger)' : emailPct >= 80 ? '#d97706' : 'var(--success)'

  // ── Filtered stats (shown when filters are active) ─────────────────────────
  const filteredRevenue     = filtered.filter(i => i.status === 'paid').reduce((s, i) => s + (i.total || 0), 0)
  const filteredOutstanding = filtered.filter(i => i.status !== 'paid').reduce((s, i) => s + (i.total || 0), 0)
  const isFiltered          = activeFilterCount > 0 || search.trim() !== ''

  function clearAllFilters() {
    setSearch('')
    setStatusFilter('all')
    setClientFilter('')
    setDatePreset('all')
    setCustomFrom('')
    setCustomTo('')
    setShowClientSug(false)
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="app-layout">
      <Navbar session={session} />
      <div className="main-content">

        {/* ── Stats grid ── */}
        <div className="stats-grid">
          <StatCard label="Invoices" value={invoices.length} />
          <StatCard label="Collected" value={formatCAD(totalRevenue)} accent />
          <StatCard label="Outstanding" value={formatCAD(outstanding)} warn={outstanding > 0} />
        </div>

        {/* ── EmailJS quota bar ── */}
        <div className="card" style={{ padding: '12px 16px', marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>
              📧 EmailJS quota this cycle
            </span>
            <span style={{ fontSize: 12, fontWeight: 700, color: emailColor }}>
              {emailsUsed} / {EMAIL_LIMIT} &nbsp;·&nbsp; {emailsLeft} left
            </span>
          </div>
          <div style={{ height: 6, background: 'var(--border)', borderRadius: 999, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.min(emailPct, 100)}%`, background: emailColor, borderRadius: 999, transition: 'width .4s' }} />
          </div>
          {emailsLeft <= 10 && (
            <div style={{ marginTop: 6, fontSize: 11, color: emailColor, fontWeight: 600 }}>
              {emailsLeft === 0
                ? 'Quota reached — emails will fail until cycle resets on the 10th.'
                : `Only ${emailsLeft} email${emailsLeft === 1 ? '' : 's'} left this cycle — resets on the 10th.`}
            </div>
          )}
        </div>

        {/* ── Page header ── */}
        <div className="page-header">
          <h1>Invoices</h1>
          <Link to="/invoice/new" className="btn btn-primary btn-sm">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            New Invoice
          </Link>
        </div>

        {/* ── Quick search ── */}
        <div className="form-group" style={{ marginBottom: 8 }}>
          <input
            type="search"
            className="form-control"
            placeholder="Quick search — client name or invoice #…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* ── Filter bar ── */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>

            {/* Filter toggle button */}
            <button
              className={`btn btn-sm ${filtersOpen ? 'btn-navy' : 'btn-ghost'}`}
              onClick={() => setFiltersOpen(p => !p)}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="4" y1="6" x2="20" y2="6"/>
                <line x1="8" y1="12" x2="16" y2="12"/>
                <line x1="11" y1="18" x2="13" y2="18"/>
              </svg>
              Filters
              {activeFilterCount > 0 && (
                <span style={{
                  background: 'var(--blue)', color: 'white',
                  borderRadius: '50%', width: 16, height: 16,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, fontWeight: 700, lineHeight: 1, marginLeft: 2,
                }}>
                  {activeFilterCount}
                </span>
              )}
            </button>

            {/* Export CSV button */}
            <button
              className="btn btn-sm btn-ghost"
              onClick={() => exportToCSV(filtered)}
              disabled={filtered.length === 0}
              style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}
              title={`Export ${filtered.length} invoice${filtered.length !== 1 ? 's' : ''} to CSV`}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Export CSV
              <span style={{ color: 'var(--muted)', fontWeight: 400 }}>({filtered.length})</span>
            </button>

            {/* Clear all filters */}
            {(activeFilterCount > 0 || search.trim()) && (
              <button
                className="btn btn-sm"
                onClick={clearAllFilters}
                style={{ background: 'var(--danger-bg)', color: 'var(--danger)', border: '1px solid #fca5a5' }}
              >
                Clear filters
              </button>
            )}
          </div>

          {/* ── Expanded filter panel ── */}
          {filtersOpen && (
            <div className="card" style={{ marginTop: 10, padding: 16 }}>

              {/* Status filter */}
              <div style={{ marginBottom: 16 }}>
                <div className="filter-section-label">Status</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {[
                    { id: 'all',   label: 'All' },
                    { id: 'draft', label: 'Draft' },
                    { id: 'sent',  label: 'Sent' },
                    { id: 'paid',  label: 'Paid' },
                  ].map(s => (
                    <button
                      key={s.id}
                      className={`btn btn-sm ${statusFilter === s.id ? 'btn-navy' : 'btn-ghost'}`}
                      onClick={() => setStatusFilter(s.id)}
                    >
                      {s.id !== 'all' && (
                        <span className={`badge badge-${s.id}`} style={{ marginRight: 4, padding: '1px 6px', fontSize: 9 }}>
                          {s.label}
                        </span>
                      )}
                      {s.id === 'all' ? 'All statuses' : s.label}
                      {s.id !== 'all' && (
                        <span style={{ color: 'var(--muted)', fontWeight: 400, marginLeft: 2, fontSize: 11 }}>
                          ({invoices.filter(i => (i.status || 'draft') === s.id).length})
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date range */}
              <div style={{ marginBottom: 16 }}>
                <div className="filter-section-label">Date Created</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {DATE_PRESETS.map(p => (
                    <button
                      key={p.id}
                      className={`btn btn-sm ${datePreset === p.id ? 'btn-navy' : 'btn-ghost'}`}
                      onClick={() => setDatePreset(p.id)}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                {/* Custom date range pickers */}
                {datePreset === 'custom' && (
                  <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.5px', whiteSpace: 'nowrap' }}>From</label>
                      <input
                        type="date"
                        className="form-control"
                        style={{ width: 'auto', fontSize: 14, padding: '7px 10px' }}
                        value={customFrom}
                        max={customTo || toDateInputVal(new Date())}
                        onChange={e => setCustomFrom(e.target.value)}
                      />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.5px', whiteSpace: 'nowrap' }}>To</label>
                      <input
                        type="date"
                        className="form-control"
                        style={{ width: 'auto', fontSize: 14, padding: '7px 10px' }}
                        value={customTo}
                        min={customFrom}
                        max={toDateInputVal(new Date())}
                        onChange={e => setCustomTo(e.target.value)}
                      />
                    </div>
                    {(customFrom || customTo) && (
                      <button
                        className="btn btn-sm btn-ghost"
                        onClick={() => { setCustomFrom(''); setCustomTo('') }}
                        style={{ fontSize: 11, color: 'var(--muted)' }}
                      >
                        Reset
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Client name filter */}
              <div>
                <div className="filter-section-label">Client Name</div>
                <div className="autocomplete-wrapper" style={{ maxWidth: 340 }}>
                  <input
                    ref={clientFilterRef}
                    type="text"
                    className="form-control"
                    style={{ fontSize: 15 }}
                    placeholder="Filter by client…"
                    value={clientFilter}
                    onChange={e => handleClientFilterInput(e.target.value)}
                    onFocus={() => {
                      if (clientFilter) {
                        const matches = allClientNames.filter(c => c.toLowerCase().includes(clientFilter.toLowerCase()))
                        setClientSuggestions(matches)
                        setShowClientSug(matches.length > 0)
                      }
                    }}
                    onBlur={() => setTimeout(() => setShowClientSug(false), 150)}
                    autoComplete="off"
                  />
                  {showClientSug && (
                    <div className="autocomplete-list">
                      {clientSuggestions.map(name => (
                        <div
                          key={name}
                          className="autocomplete-item"
                          onMouseDown={() => { setClientFilter(name); setShowClientSug(false) }}
                        >
                          {name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Filtered stats summary ── */}
        {isFiltered && filtered.length > 0 && (
          <div style={{
            background: 'var(--blue-pale)', border: '1px solid #bfdbfe',
            borderRadius: 8, padding: '10px 14px', marginBottom: 12,
            display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center',
            fontSize: 13,
          }}>
            <span style={{ color: 'var(--blue)', fontWeight: 700 }}>
              Showing {filtered.length} of {invoices.length} invoice{invoices.length !== 1 ? 's' : ''}
            </span>
            <span style={{ color: 'var(--muted)' }}>·</span>
            <span style={{ color: 'var(--success)', fontWeight: 600 }}>
              Collected: {formatCAD(filteredRevenue)}
            </span>
            <span style={{ color: 'var(--muted)' }}>·</span>
            <span style={{ color: filteredOutstanding > 0 ? 'var(--danger)' : 'var(--muted)', fontWeight: 600 }}>
              Outstanding: {formatCAD(filteredOutstanding)}
            </span>
          </div>
        )}

        {/* ── Invoice list ── */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            <h3>{isFiltered ? 'No results for these filters' : 'No invoices yet'}</h3>
            <p style={{ marginBottom: 16 }}>
              {isFiltered
                ? 'Try adjusting your filters or clearing them.'
                : 'Create your first invoice.'}
            </p>
            {isFiltered
              ? <button className="btn btn-ghost" onClick={clearAllFilters}>Clear filters</button>
              : <Link to="/invoice/new" className="btn btn-primary">Create Invoice</Link>
            }
          </div>
        ) : (
          <div className="invoice-list">
            {filtered.map(inv => (
              <div
                key={inv.id}
                className="invoice-row"
                onClick={() => navigate(`/invoice/${inv.id}`)}
              >
                <div className="invoice-row-top">
                  <div>
                    <div className="invoice-client">{inv.client_name}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                      <span className="invoice-number">{inv.invoice_number}</span>
                      <span className="invoice-date">{formatDateShort(inv.service_date)}</span>
                    </div>
                  </div>
                  <div className="invoice-amount">{formatCAD(inv.total || 0)}</div>
                </div>
                <div className="invoice-row-bottom">
                  <span className={`badge badge-${inv.status || 'draft'}`}>
                    {STATUS_COLORS[inv.status]?.label || 'Draft'}
                  </span>
                  {inv.emailed_at ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, color: 'var(--success)', fontWeight: 600 }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                      Emailed
                    </span>
                  ) : (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                      Not emailed
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value, accent, warn }) {
  return (
    <div className="card" style={{ padding: '12px 14px' }}>
      <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--muted)', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 17, fontWeight: 700, color: accent ? 'var(--success)' : warn ? 'var(--danger)' : 'var(--navy)', fontFamily: 'monospace', wordBreak: 'break-all' }}>
        {value}
      </div>
    </div>
  )
}
