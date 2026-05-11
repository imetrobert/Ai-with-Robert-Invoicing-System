import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Navbar from './Navbar'
import { formatCAD, formatDateShort, STATUS_COLORS } from '../lib/invoiceUtils'

export default function Dashboard() {
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [session, setSession] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session))
    fetchInvoices()
  }, [])

  async function fetchInvoices() {
    setLoading(true)
    const { data, error } = await supabase
      .from('invoices')
      .select('id, invoice_number, client_name, service_date, total, status, emailed_at, created_at')
      .order('created_at', { ascending: false })
    if (!error) setInvoices(data || [])
    setLoading(false)
  }

  const filtered = invoices.filter(inv =>
    inv.client_name?.toLowerCase().includes(search.toLowerCase()) ||
    inv.invoice_number?.toLowerCase().includes(search.toLowerCase())
  )

  const totalRevenue = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + (i.total || 0), 0)
  const outstanding  = invoices.filter(i => i.status !== 'paid').reduce((s, i) => s + (i.total || 0), 0)

  return (
    <div className="app-layout">
      <Navbar session={session} />
      <div className="main-content">

        {/* Stats */}
        <div className="stats-grid">
          <StatCard label="Invoices" value={invoices.length} />
          <StatCard label="Collected" value={formatCAD(totalRevenue)} accent />
          <StatCard label="Pending" value={formatCAD(outstanding)} warn={outstanding > 0} />
        </div>

        {/* Header */}
        <div className="page-header">
          <div className="page-header-left">
            <h1>Invoices</h1>
          </div>
          <div className="page-header-right">
            <Link to="/invoice/new" className="btn btn-primary">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              New Invoice
            </Link>
          </div>
        </div>

        {/* Search */}
        <div className="form-group" style={{ marginBottom: 14 }}>
          <input
            type="search"
            className="form-control"
            placeholder="Search client or invoice #"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* List */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
            <h3>{search ? 'No results found' : 'No invoices yet'}</h3>
            <p style={{ marginBottom: 16 }}>{search ? 'Try a different search.' : 'Create your first invoice.'}</p>
            {!search && <Link to="/invoice/new" className="btn btn-primary">Create Invoice</Link>}
          </div>
        ) : (
          <div className="invoice-list">
            {filtered.map(inv => (
              <div key={inv.id} className="invoice-row" onClick={() => navigate(`/invoice/${inv.id}`)}>
                <div className="invoice-row-left">
                  <div className="invoice-number">{inv.invoice_number}</div>
                  <div className="invoice-client">{inv.client_name}</div>
                  <div className="invoice-date">
                    {formatDateShort(inv.service_date)}
                    {inv.emailed_at ? (
                      <span style={{ color: 'var(--success)', fontWeight: 600, fontSize: 11 }}>✓ Emailed</span>
                    ) : (
                      <span style={{ color: '#94a3b8', fontSize: 11 }}>Not emailed</span>
                    )}
                  </div>
                </div>
                <div className="invoice-right">
                  <div className="invoice-amount">{formatCAD(inv.total || 0)}</div>
                  <span className={`badge badge-${inv.status || 'draft'}`}>
                    {STATUS_COLORS[inv.status]?.label || 'Draft'}
                  </span>
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
      <div style={{ fontSize: 16, fontWeight: 700, color: accent ? 'var(--success)' : warn ? 'var(--danger)' : 'var(--navy)', fontFamily: 'monospace', wordBreak: 'break-all' }}>
        {value}
      </div>
    </div>
  )
}
