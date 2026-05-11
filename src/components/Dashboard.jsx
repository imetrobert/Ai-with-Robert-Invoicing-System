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
      .select('id, invoice_number, client_name, service_date, total, status, emailed_at, view_count, created_at')
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
        <div className="stats-grid">
          <StatCard label="Invoices" value={invoices.length} />
          <StatCard label="Collected" value={formatCAD(totalRevenue)} accent />
          <StatCard label="Outstanding" value={formatCAD(outstanding)} warn={outstanding > 0} />
        </div>

        <div className="page-header">
          <h1>Invoices</h1>
          <Link to="/invoice/new" className="btn btn-primary btn-sm">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            New Invoice
          </Link>
        </div>

        <div className="form-group" style={{ marginBottom: 14 }}>
          <input type="search" className="form-control" placeholder="Search client or invoice #…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            <h3>{search ? 'No results' : 'No invoices yet'}</h3>
            <p style={{ marginBottom: 16 }}>{search ? 'Try a different search.' : 'Create your first invoice.'}</p>
            {!search && <Link to="/invoice/new" className="btn btn-primary">Create Invoice</Link>}
          </div>
        ) : (
          <div className="invoice-list">
            {filtered.map(inv => (
              <div key={inv.id} className="invoice-row" onClick={() => navigate(`/invoice/${inv.id}`)}>
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
