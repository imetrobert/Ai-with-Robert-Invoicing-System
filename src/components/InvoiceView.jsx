import { useState, useEffect } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Navbar from './Navbar'
import { generateInvoicePDF } from '../lib/pdfGenerator'
import { sendInvoiceEmail } from '../lib/emailService'
import { formatCAD, formatDate, formatDateShort, STATUS_COLORS, getProvinceTaxLabel, getProvinceTaxRate, utcToETDateStr } from '../lib/invoiceUtils'

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
  const [showResendModal, setShowResendModal] = useState(false)

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
    catch (e) { alert('PDF failed: ' + e.message) }
    setPdfLoading(false)
  }

  async function handleEmail() {
    if (!invoice.client_email) {
      setEmailMsg({ type: 'error', text: 'No client email on this invoice. Edit it to add one.' })
      return
    }
    setEmailLoading(true); setEmailMsg(null)
    try {
      await sendInvoiceEmail(invoice)
      const now = new Date().toISOString()
      // email_log records every send (not just the latest) so the EmailJS
      // quota tracker on the dashboard can count actual sends per cycle,
      // not just distinct invoices.
      const emailLog = [...(invoice.email_log || []), now]
      await supabase.from('invoices').update({ emailed_at: now, email_log: emailLog }).eq('id', id)
      setInvoice(prev => ({ ...prev, emailed_at: now, email_log: emailLog }))
      setEmailMsg({ type: 'success', text: `Emailed to ${invoice.client_email}!` })
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
    if (newStatus === 'paid' && invoice.client_email) {
      setShowResendModal(true)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    const { error } = await supabase.from('invoices').delete().eq('id', id)
    if (error) { alert('Delete failed: ' + error.message); setDeleting(false); return }
    navigate('/')
  }

  if (loading) return (
    <div className="app-layout"><Navbar session={session} />
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

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
          <Link to="/" className="btn btn-ghost btn-sm">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
            Back
          </Link>
          <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--blue)', fontSize: 14 }}>{invoice.invoice_number}</span>
          <span className={`badge badge-${invoice.status}`}>{sc.label}</span>
          {invoice.emailed_at && (
            <span style={{ fontSize: 12, color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 4 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
              Emailed {formatDateShort(utcToETDateStr(invoice.emailed_at))}
            </span>
          )}
          <span style={{ fontSize: 12, color: (invoice.view_count || 0) > 0 ? 'var(--blue)' : 'var(--muted)', fontWeight: 600 }}>
            👁 {invoice.view_count || 0} invoice link click{invoice.view_count !== 1 ? 's' : ''}
            {invoice.first_viewed_at ? ` · first clicked ${formatDateShort(utcToETDateStr(invoice.first_viewed_at))}` : ''}
          </span>
          <span style={{ fontSize: 12, color: (invoice.pdf_download_count || 0) > 0 ? 'var(--blue)' : 'var(--muted)', fontWeight: 600 }}>
            ⬇ {invoice.pdf_download_count || 0} PDF download{invoice.pdf_download_count !== 1 ? 's' : ''}
          </span>
        </div>

        <div className="invoice-actions">
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

        {emailMsg && (
          <div className={`alert alert-${emailMsg.type === 'success' ? 'success' : 'error'}`}>{emailMsg.text}</div>
        )}

        <div className="card">
          <div style={{ background: 'linear-gradient(135deg, var(--navy) 0%, #1e4a8a 100%)', padding: '20px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <img src="https://aiwithrobert.com/logo.PNG" alt="" style={{ height: 38, borderRadius: 6 }} onError={e => e.target.style.display='none'} />
              <div style={{ color: 'white' }}>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 17, fontWeight: 700 }}>AI with Robert</div>
                <div style={{ fontSize: 11, opacity: .7 }}>invoices@aiwithrobert.com · aiwithrobert.com</div>
              </div>
            </div>
            <div style={{ textAlign: 'right', color: 'white' }}>
              <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: 2 }}>INVOICE</div>
              <div style={{ fontFamily: 'monospace', fontSize: 11, opacity: .8 }}>{invoice.invoice_number}</div>
            </div>
          </div>

          <div className="card-body">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--blue)', fontWeight: 700, marginBottom: 4 }}>Bill To</div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{invoice.client_name}</div>
                {invoice.client_email && <div style={{ color: 'var(--muted)', fontSize: 12 }}>{invoice.client_email}</div>}
                {(invoice.address_line1 || invoice.address_city) && (
                  <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 3, lineHeight: 1.5 }}>
                    {invoice.address_line1 && <div>{invoice.address_line1}</div>}
                    {invoice.address_line2 && <div>{invoice.address_line2}</div>}
                    <div>{[invoice.address_city, invoice.province, invoice.address_postal].filter(Boolean).join(', ')}</div>
                  </div>
                )}
                {!invoice.address_line1 && invoice.province && <div style={{ color: 'var(--muted)', fontSize: 12 }}>{invoice.province}</div>}
              </div>
              <div style={{ textAlign: 'right' }}>
                <MetaRow label="Service Date" value={formatDate(invoice.service_date)} />
                <MetaRow label="Issued" value={formatDate(utcToETDateStr(invoice.created_at))} />
                {invoice.emailed_at && <MetaRow label="Emailed" value={formatDate(utcToETDateStr(invoice.emailed_at))} />}
              </div>
            </div>

            <div className="table-scroll">
              <table className="data-table" style={{ marginBottom: 16 }}>
                <thead>
                  <tr>
                    <th>Service</th>
                    <th>Description</th>
                    <th style={{ textAlign: 'center' }}>Qty</th>
                    <th style={{ textAlign: 'right' }}>Rate</th>
                    <th style={{ textAlign: 'right' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {services.map((svc, i) => {
                    const isWorkshop = svc.service_id === 'group-workshop'
                    const qtyLabel = isWorkshop ? `${svc.people || 1}p × ${svc.quantity || 1}s` : String(svc.quantity || 1)
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

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {invoice.notes && (
                <div style={{ padding: '10px 14px', background: 'var(--bg)', borderLeft: '3px solid var(--blue)', borderRadius: 4 }}>
                  <div style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--blue)', fontWeight: 700, marginBottom: 4 }}>Notes</div>
                  <p style={{ fontSize: 13, color: 'var(--muted)' }}>{invoice.notes}</p>
                </div>
              )}
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
                <div className="totals-row total"><span>Total Due (CAD)</span><span>{formatCAD(invoice.total || 0)}</span></div>
              </div>
            </div>
          </div>

          <div style={{ background: 'var(--navy)', color: 'rgba(255,255,255,.6)', textAlign: 'center', padding: '10px 16px', fontSize: 11 }}>
            Thank you for choosing AI with Robert! —{' '}
            {invoice.gst_enabled ? `${taxLabel} at ${taxRate}%` : 'GST/QST/HST not applicable at this time.'}
          </div>
        </div>

        <div className="card" style={{ marginTop: 12, padding: '12px 16px' }}>
          <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600, marginBottom: 8 }}>Mark as:</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {['draft', 'sent', 'paid'].map(s => (
              <button key={s} className={`btn btn-sm ${invoice.status === s ? 'btn-navy' : 'btn-ghost'}`}
                style={{ flex: 1 }}
                onClick={() => handleStatusChange(s)} disabled={statusSaving || invoice.status === s}>
                {STATUS_COLORS[s].label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {showResendModal && (
        <div className="modal-overlay" onClick={() => setShowResendModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Send Payment Confirmation?</h3>
            <p>
              Would you like to send <strong>{invoice.client_name}</strong> a payment confirmation email showing their invoice as <strong>PAID</strong>?
            </p>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setShowResendModal(false)}>No thanks</button>
              <button className="btn btn-primary" onClick={async () => {
                setShowResendModal(false)
                setEmailLoading(true)
                setEmailMsg(null)
                try {
                  await sendInvoiceEmail({ ...invoice, status: 'paid' })
                  const now = new Date().toISOString()
                  const emailLog = [...(invoice.email_log || []), now]
                  await supabase.from('invoices').update({ emailed_at: now, email_log: emailLog }).eq('id', id)
                  setInvoice(prev => ({ ...prev, emailed_at: now, email_log: emailLog }))
                  setEmailMsg({ type: 'success', text: `Payment confirmation sent to ${invoice.client_email}!` })
                } catch (e) {
                  const msg = e?.text || e?.message || 'Unknown error'
                  setEmailMsg({ type: 'error', text: 'Email failed: ' + msg })
                }
                setEmailLoading(false)
              }}>
                Yes, Send Confirmation
              </button>
            </div>
          </div>
        </div>
      )}

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
    <div style={{ marginBottom: 4 }}>
      <span style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--muted)', marginRight: 6 }}>{label}:</span>
      <span style={{ fontWeight: 600, fontSize: 13 }}>{value}</span>
    </div>
  )
}
