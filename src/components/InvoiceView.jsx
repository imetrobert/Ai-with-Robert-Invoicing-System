import { useState, useEffect } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Navbar from './Navbar'
import { generateInvoicePDF, generateInvoicePDFBase64 } from '../lib/pdfGenerator'
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

  /**
   * FIXED: Added 'await' to generateInvoicePDFBase64.
   * This prevents the "e.split is not a function" error by ensuring
   * we pass a string to EmailJS instead of a Promise.
   */
  async function handleEmail() {
    if (!invoice.client_email) {
      setEmailMsg({ type: 'error', text: 'No client email address on this invoice. Edit the invoice to add one first.' })
      return
    }
    setEmailLoading(true)
    setEmailMsg(null)
    try {
      // THE FIX: Added 'await' here
      const base64 = await generateInvoicePDFBase64(invoice) 
      
      await sendInvoiceEmail(invoice, base64)
      
      const now = new Date().toISOString()
      await supabase.from('invoices').update({ emailed_at: now }).eq('id', id)
      setInvoice(prev => ({ ...prev, emailed_at: now }))
      setEmailMsg({ type: 'success', text: `Invoice emailed successfully to ${invoice.client_email}!` })
    } catch (e) {
      console.error("Email error detail:", e)
      setEmailMsg({ type: 'error', text: 'Email failed: ' + e.message })
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
  
  // Tax labels updated for QC/ON/Other provinces
  const taxLabel = getProvinceTaxLabel(invoice.province)
  const taxRate = getProvinceTaxRate(invoice.province)

  return (
    <div className="app-layout">
      <Navbar session={session} />
      <div className="main-content invoice-view">

        <div className="page-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <Link to="/" className="btn btn-ghost btn-sm">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
              Back
            </Link>
            <h1>{invoice.invoice_number}</h1>
            <span className={`badge badge-${invoice.status}`}>{sc.label}</span>
            {invoice.emailed_at && (
              <span style={{ fontSize: 12, color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                Emailed {formatDateShort(invoice.emailed_at?.split('T')[0])}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Link to={`/invoice/${id}/edit`} className="btn btn-ghost btn-sm">Edit</Link>
            <button className="btn btn-primary btn-sm" onClick={handlePDF} disabled={pdfLoading}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              {pdfLoading ? 'Generating…' : 'Download PDF'}
            </button>
            <button className="btn btn-sm" style={{ background: '#f0fdf4', color: '#15803d', border: '1px solid #86efac' }} onClick={handleEmail} disabled={emailLoading}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
              {emailLoading ? 'Sending…' : 'Email Invoice'}
            </button>
            <button className="btn btn-danger btn-sm" onClick={() => setShowDeleteModal(true)}>Delete</button>
          </div>
        </div>

        {emailMsg && (
          <div className={`alert alert-${emailMsg.type === 'success' ? 'success' : 'error'}`}>
            {emailMsg.text}
          </div>
        )}

        <div className="card">
          <div style={{ background: 'linear-gradient(135deg, var(--navy) 0%, #1e4a8a 100%)', padding: '24px 26px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <img src="https://aiwithrobert.com/logo.PNG" alt="" style={{ height: 44, borderRadius: 8 }} onError={e => e.target.style.display='none'} />
              <div style={{ color: 'white' }}>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 700 }}>AI with Robert</div>
                <div style={{ fontSize: 12, opacity: .7 }}>invoices@aiwithrobert.com · 514-250-8491 · aiwithrobert.com</div>
                <div style={{ fontSize: 12, opacity: .7 }}>Côte Saint-Luc, Quebec</div>
              </div>
            </div>
            <div style={{ textAlign: 'right', color: 'white' }}>
              <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: 2 }}>INVOICE</div>
              <div style={{ fontFamily: 'monospace', fontSize: 13, opacity: .8 }}>{invoice.invoice_number}</div>
            </div>
          </div>

          <div className="card-body">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
              <div>
                <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--blue)', fontWeight: 700, marginBottom: 6 }}>Bill To</div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{invoice.client_name}</div>
                {invoice.client_email && <div style={{ color: 'var(--muted)', fontSize: 13 }}>{invoice.client_email}</div>}
                {invoice.province && <div style={{ color: 'var(--muted)', fontSize: 13 }}>{invoice.province}</div>}
              </div>
              <div style={{ textAlign: 'right' }}>
                <MetaRow label="Date of Service" value={formatDate(invoice.service_date)} />
                <MetaRow label="Date Issued" value={formatDate(invoice.created_at?.split('T')[0])} />
              </div>
            </div>

            <table className="data-table" style={{ marginBottom: 20 }}>
              <thead>
                <tr>
                  <th>Service</th>
                  <th>Description</th>
                  <th style={{ textAlign: 'center' }}>Qty / People</th>
                  <th style={{ textAlign: 'right' }}>Rate (CAD)</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {services.map((svc, i) => {
                  const isWorkshop = svc.service_id === 'group-workshop'
                  const qtyLabel = isWorkshop ? `${svc.people || 1} ppl × ${svc.quantity || 1} session(s)` : String(svc.quantity || 1)
                  const amount = isWorkshop
                    ? (svc.people || 1) * (svc.quantity || 1) * (svc.rate || 0)
                    : (svc.quantity || 1) * (svc.rate || 0)
                  return (
                    <tr key={i}>
                      <td style={{ fontWeight: 600 }}>{svc.service_name}</td>
                      <td style={{ color: 'var(--muted)', fontSize: 13 }}>{svc.description}</td>
                      <td style={{ textAlign: 'center' }}>{qtyLabel}</td>
                      <td style={{ textAlign: 'right' }}>{formatCAD(svc.rate)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>{formatCAD(amount)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto' }}>
              <div>
                {invoice.notes && (
                  <div>
                    <div style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--blue)', fontWeight: 700, marginBottom: 6 }}>Notes</div>
                    <p style={{ fontSize: 13, color: 'var(--muted)', maxWidth: 360 }}>{invoice.notes}</p>
                  </div>
                )}
              </div>
              <div style={{ minWidth: 240 }} className="invoice-totals">
                <div className="totals-row"><span>Subtotal</span><span>{formatCAD(invoice.subtotal || 0)}</span></div>
                {invoice.discount_amount > 0 && (
                  <div className="totals-row" style={{ color: 'var(--success)' }}>
                    <span>Discount {invoice.discount_type === 'percent' ? `(${invoice.discount_value}%)` : ''}</span>
                    <span>-{formatCAD(invoice.discount_amount)}</span>
                  </div>
                )}
                {invoice.gst_enabled && (
                  <div className="totals-row">
                    <span>{taxLabel} ({taxRate}%)</span>
                    <span>{formatCAD(invoice.gst_amount || 0)}</span>
                  </div>
                )}
                <div className="totals-row total">
                  <span>Total Due (CAD)</span>
                  <span style={{ fontSize: 20 }}>{formatCAD(invoice.total || 0)}</span>
                </div>
              </div>
            </div>
          </div>

          <div style={{ background: 'var(--navy)', color: 'rgba(255,255,255,.6)', textAlign: 'center', padding: '10px 20px', fontSize: 12 }}>
            Thank you for choosing AI with Robert! —{' '}
            {invoice.gst_enabled ? `${taxLabel} applied at ${taxRate}%` : 'GST/QST/HST not applicable at this time.'}
          </div>
        </div>

        <div className="card" style={{ marginTop: 16, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 600 }}>Mark as:</span>
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
            <p>This will permanently delete <strong>{invoice.invoice_number}</strong> for <strong>{invoice.client_name}</strong>. This cannot be undone.</p>
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
    <div style={{ marginBottom: 6 }}>
      <span style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--muted)', marginRight: 8 }}>{label}:</span>
      <span style={{ fontWeight: 600, fontSize: 14 }}>{value}</span>
    </div>
  )
}
