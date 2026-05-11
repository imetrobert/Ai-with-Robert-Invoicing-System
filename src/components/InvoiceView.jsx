import { useState, useEffect } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Navbar from './Navbar'
import { generateInvoicePDF } from '../lib/pdfGenerator'
import { sendInvoiceEmail } from '../lib/emailService'
import { formatCAD, formatDate, formatDateShort, STATUS_COLORS, getProvinceTaxLabel, getProvinceTaxRate } from '../lib/invoiceUtils'

export default function InvoiceView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [invoice, setInvoice] = useState(null)
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [emailLoading, setEmailLoading] = useState(false)
  const [emailMsg, setEmailMsg] = useState(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [statusSaving, setStatusSaving] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session))
    fetchInvoice()
  }, [id])

  async function fetchInvoice() {
    const { data, error } = await supabase.from('invoices').select('*').eq('id', id).single()
    if (error || !data) { navigate('/'); return }
    setInvoice(data)
    setLoading(false)
  }

  async function handlePDF() {
    setPdfLoading(true)
    try { await generateInvoicePDF(invoice) }
    catch (e) { alert('PDF generation failed: ' + e.message) }
    setPdfLoading(false)
  }

  async function handleEmail() {
    if (!invoice.client_email) {
      setEmailMsg({ type: 'error', text: 'No client email on this invoice. Edit to add one first.' })
      return
    }
    setEmailLoading(true)
    setEmailMsg(null)
    try {
      await sendInvoiceEmail(invoice)
      const now = new Date().toISOString()
      await supabase.from('invoices').update({ emailed_at: now }).eq('id', id)
      setInvoice(prev => ({ ...prev, emailed_at: now }))
      setEmailMsg({ type: 'success', text: `Invoice emailed to ${invoice.client_email}!` })
    } catch (e) {
      const msg = e?.text || e?.message || (typeof e === 'string' ? e : JSON.stringify(e)) || 'Unknown error'
      setEmailMsg({ type: 'error', text: 'Email failed: ' + msg })
    }
    setEmailLoading(false)
  }

  async function handleStatusChange(newStatus) {
    setStatusSaving(true)
    await supabase.from('invoices').update({ status: newStatus }).eq('id', id)
    setInvoice(prev => ({ ...prev, status: newStatus }))
    setStatusSaving(false)
  }

  async function handleDelete() {
    setDeleting(true)
    const { error } = await supabase.from('invoices').delete().eq('id', id)
    if (error) { alert('Delete failed: ' + error.message); setDeleting(false); return }
    navigate('/')
  }

  if (loading) return (
    <div className="app-layout">
      <Navbar session={session} />
      <div className="main-content" style={{ textAlign: 'center', paddingTop: 60, color: 'var(--muted)' }}>Loading…</div>
    </div>
  )

  const sc = STATUS_COLORS[invoice.status] || STATUS_COLORS.draft
  const services = Array.isArray(invoice.services) ? invoice.services : []
  const taxLabel = getProvinceTaxLabel(invoice.province)
  const taxRate = getProvinceTaxRate(invoice.province)

  return (
    <div className="app-layout">
      <Navbar session={session} />
      <div className="main-content invoice-view">

        {/* Page header */}
        <div className="page-header">
          <div className="page-header-left">
            <Link to="/" className="btn btn-ghost btn-sm">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
              Back
            </Link>
            <h1 style={{ fontSize: 16 }}>{invoice.invoice_number}</h1>
            <span className={`badge badge-${invoice.status}`}>{sc.label}</span>
            {invoice.emailed_at && (
              <span style={{ fontSize: 11, color: 'var(--success)', fontWeight: 600 }}>✓ Emailed {formatDateShort(invoice.emailed_at?.split('T')[0])}</span>
            )}
          </div>
          <div className="page-header-right">
            <Link to={`/invoice/${id}/edit`} className="btn btn-ghost btn-sm">Edit</Link>
            <button className="btn btn-primary btn-sm" onClick={handlePDF} disabled={pdfLoading}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              {pdfLoading ? 'Generating…' : 'PDF'}
            </button>
            <button className="btn btn-sm" style={{ background: '#f0fdf4', color: '#15803d', border: '1px solid #86efac' }} onClick={handleEmail} disabled={emailLoading}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
              {emailLoading ? 'Sending…' : 'Email'}
            </button>
            <button className="btn btn-danger btn-sm" onClick={() => setShowDeleteModal(true)}>Delete</button>
          </div>
        </div>

        {emailMsg && (
          <div className={`alert alert-${emailMsg.type === 'success' ? 'success' : 'error'}`}>
            {emailMsg.text}
          </div>
        )}

        {/* Invoice card */}
        <div className="card">
          {/* Brand header */}
          <div style={{ background: 'linear-gradient(135deg, var(--navy) 0%, #1e4a8a 100%)', padding: '18px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <img src="https://aiwithrobert.com/logo.PNG" alt="" style={{ height: 36, borderRadius: 6 }} onError={e => e.target.style.display='none'} />
              <div style={{ color: 'white' }}>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, fontWeight: 700 }}>AI with Robert</div>
                <div style={{ fontSize: 10, opacity: .7 }}>invoices@aiwithrobert.com · aiwithrobert.com</div>
              </div>
            </div>
            <div style={{ textAlign: 'right', color: 'white' }}>
              <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: 1 }}>INVOICE</div>
              <div style={{ fontFamily: 'monospace', fontSize: 11, opacity: .8 }}>{invoice.invoice_number}</div>
            </div>
          </div>

          <div className="card-body">
            {/* Bill to + meta — stacks on mobile */}
            <div className="bill-to-grid">
              <div>
                <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--blue)', fontWeight: 700, marginBottom: 5 }}>Bill To</div>
                <div style={{ fontSize: 17, fontWeight: 700 }}>{invoice.client_name}</div>
                {invoice.client_email && <div style={{ color: 'var(--muted)', fontSize: 13 }}>{invoice.client_email}</div>}
                {invoice.province && <div style={{ color: 'var(--muted)', fontSize: 13 }}>{invoice.province}</div>}
              </div>
              <div>
                <MetaRow label="Date of Service" value={formatDate(invoice.service_date)} />
                <MetaRow label="Date Issued" value={formatDate(invoice.created_at?.split('T')[0])} />
                {invoice.emailed_at && <MetaRow label="Emailed" value={formatDate(invoice.emailed_at?.split('T')[0])} />}
              </div>
            </div>

            {/* Services table — scrollable wrapper */}
            <div className="table-scroll-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Service</th>
                    <th>Desc</th>
                    <th style={{ textAlign: 'center' }}>Qty</th>
                    <th style={{ textAlign: 'right' }}>Rate</th>
                    <th style={{ textAlign: 'right' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {services.map((svc, i) => {
                    const isWorkshop = svc.service_id === 'group-workshop'
                    const qtyLabel = isWorkshop ? `${svc.people || 1}p x ${svc.quantity || 1}s` : String(svc.quantity || 1)
                    const amount = isWorkshop
                      ? (svc.people || 1) * (svc.quantity || 1) * (svc.rate || 0)
                      : (svc.quantity || 1) * (svc.rate || 0)
                    return (
                      <tr key={i}>
                        <td style={{ fontWeight: 600 }}>{svc.service_name}</td>
                        <td style={{ color: 'var(--muted)', fontSize: 12 }}>{svc.description}</td>
                        <td style={{ textAlign: 'center' }}>{qtyLabel}</td>
                        <td style={{ textAlign: 'right' }}>{formatCAD(svc.rate)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>{formatCAD(amount)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Totals + notes — stack on mobile */}
            <div className="invoice-totals-section">
              <div className="invoice-notes-col">
                {invoice.notes && (
                  <div>
                    <div style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--blue)', fontWeight: 700, marginBottom: 5 }}>Notes</div>
                    <p style={{ fontSize: 13, color: 'var(--muted)' }}>{invoice.notes}</p>
                  </div>
                )}
              </div>
              <div className="invoice-totals-col">
                <div className="invoice-totals">
                  <div className="totals-row"><span>Subtotal</span><span>{formatCAD(invoice.subtotal || 0)}</span></div>
                  {invoice.discount_amount > 0 && (
                    <div className="totals-row" style={{ color: 'var(--success)' }}>
                      <span>Discount {invoice.discount_type === 'percent' ? `(${invoice.discount_value}%)` : ''}</span>
                      <span>-{formatCAD(invoice.discount_amount)}</span>
                    </div>
                  )}
                  {invoice.gst_enabled && (
                    <div className="totals-row"><span>{taxLabel} ({taxRate}%)</span><span>{formatCAD(invoice.gst_amount || 0)}</span></div>
                  )}
                  <div className="totals-row total">
                    <span>Total Due (CAD)</span>
                    <span>{formatCAD(invoice.total || 0)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div style={{ background: 'var(--navy)', color: 'rgba(255,255,255,.6)', textAlign: 'center', padding: '10px 16px', fontSize: 11 }}>
            Thank you for choosing AI with Robert! —{' '}
            {invoice.gst_enabled ? `${taxLabel} at ${taxRate}%` : 'GST/QST/HST not applicable at this time.'}
          </div>
        </div>

        {/* Status changer */}
        <div className="card status-bar" style={{ marginTop: 12 }}>
          <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>Mark as:</span>
          {['draft', 'sent', 'paid'].map(s => (
            <button key={s} className={`btn btn-sm ${invoice.status === s ? 'btn-navy' : 'btn-ghost'}`} onClick={() => handleStatusChange(s)} disabled={statusSaving || invoice.status === s}>
              {STATUS_COLORS[s].label}
            </button>
          ))}
        </div>
      </div>

      {showDeleteModal && (
        <div className="modal-overlay" onClick={() => setShowDeleteModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Delete Invoice?</h3>
            <p>Permanently delete <strong>{invoice.invoice_number}</strong> for <strong>{invoice.client_name}</strong>? This cannot be undone.</p>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setShowDeleteModal(false)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleDelete} disabled={deleting}>{deleting ? 'Deleting…' : 'Yes, Delete'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function MetaRow({ label, value }) {
  return (
    <div style={{ marginBottom: 5 }}>
      <span style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--muted)', marginRight: 6 }}>{label}:</span>
      <span style={{ fontWeight: 600, fontSize: 13 }}>{value}</span>
    </div>
  )
}
