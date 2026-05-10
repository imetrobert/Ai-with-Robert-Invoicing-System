import { useState, useEffect } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Navbar from './Navbar'
import { generateInvoicePDF } from '../lib/pdfGenerator'
import { formatCAD, formatDate, STATUS_COLORS } from '../lib/invoiceUtils'

export default function InvoiceView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [invoice, setInvoice] = useState(null)
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [pdfLoading, setPdfLoading] = useState(false)
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

  return (
    <div className="app-layout">
      <Navbar session={session} />
      <div className="main-content invoice-view">

        {/* Page header */}
        <div className="page-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Link to="/" className="btn btn-ghost btn-sm">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
              Back
            </Link>
            <h1>{invoice.invoice_number}</h1>
            <span className={`badge badge-${invoice.status}`}>{sc.label}</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Link to={`/invoice/${id}/edit`} className="btn btn-ghost btn-sm">Edit</Link>
            <button className="btn btn-primary btn-sm" onClick={handlePDF} disabled={pdfLoading}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              {pdfLoading ? 'Generating…' : 'Download PDF'}
            </button>
            <button className="btn btn-danger btn-sm" onClick={() => setShowDeleteModal(true)}>Delete</button>
          </div>
        </div>

        {/* Invoice card */}
        <div className="card">
          {/* Brand header */}
          <div style={{
            background: 'linear-gradient(135deg, var(--navy) 0%, #1e4a8a 100%)',
            padding: '24px 26px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <img src="https://aiwithrobert.com/logo.PNG" alt="" style={{ height: 44, borderRadius: 8 }} onError={e => e.target.style.display='none'} />
              <div style={{ color: 'white' }}>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 700 }}>AI with Robert</div>
                <div style={{ fontSize: 12, opacity: .7 }}>info@aiwithrobert.com · 514-250-8491 · aiwithrobert.com</div>
                <div style={{ fontSize: 12, opacity: .7 }}>Côte Saint-Luc, Quebec</div>
              </div>
            </div>
            <div style={{ textAlign: 'right', color: 'white' }}>
              <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: 2 }}>INVOICE</div>
              <div style={{ fontFamily: 'monospace', fontSize: 13, opacity: .8 }}>{invoice.invoice_number}</div>
            </div>
          </div>

          <div className="card-body">
            {/* Meta grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
              <div>
                <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--blue)', fontWeight: 700, marginBottom: 6 }}>Bill To</div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{invoice.client_name}</div>
                {invoice.client_email && <div style={{ color: 'var(--muted)', fontSize: 13 }}>{invoice.client_email}</div>}
              </div>
              <div style={{ textAlign: 'right' }}>
                <MetaRow label="Date of Service" value={formatDate(invoice.service_date)} />
                <MetaRow label="Date Issued" value={formatDate(invoice.created_at?.split('T')[0])} />
              </div>
            </div>

            {/* Services table */}
            <table className="data-table" style={{ marginBottom: 20 }}>
              <thead>
                <tr>
                  <th>Service</th>
                  <th>Description</th>
                  <th style={{ textAlign: 'center' }}>Qty</th>
                  <th style={{ textAlign: 'right' }}>Rate (CAD)</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {services.map((svc, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 600 }}>{svc.service_name}</td>
                    <td style={{ color: 'var(--muted)', fontSize: 13 }}>{svc.description}</td>
                    <td style={{ textAlign: 'center' }}>{svc.quantity}</td>
                    <td style={{ textAlign: 'right' }}>{formatCAD(svc.rate)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>{formatCAD((svc.quantity || 1) * (svc.rate || 0))}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals */}
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
                  <div className="totals-row"><span>GST (5%)</span><span>{formatCAD(invoice.gst_amount || 0)}</span></div>
                )}
                <div className="totals-row total">
                  <span>Total Due (CAD)</span>
                  <span style={{ fontSize: 20 }}>{formatCAD(invoice.total || 0)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div style={{ background: 'var(--navy)', color: 'rgba(255,255,255,.6)', textAlign: 'center', padding: '10px 20px', fontSize: 12 }}>
            Thank you for choosing AI with Robert! — GST/HST not applicable at this time.
          </div>
        </div>

        {/* Status changer */}
        <div className="card" style={{ marginTop: 16, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 600 }}>Mark as:</span>
          {['draft', 'sent', 'paid'].map(s => (
            <button
              key={s}
              className={`btn btn-sm ${invoice.status === s ? 'btn-navy' : 'btn-ghost'}`}
              onClick={() => handleStatusChange(s)}
              disabled={statusSaving || invoice.status === s}
            >
              {STATUS_COLORS[s].label}
            </button>
          ))}
        </div>

      </div>

      {/* Delete confirm modal */}
      {showDeleteModal && (
        <div className="modal-overlay" onClick={() => setShowDeleteModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Delete Invoice?</h3>
            <p>This will permanently delete <strong>{invoice.invoice_number}</strong> for <strong>{invoice.client_name}</strong>. This cannot be undone.</p>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setShowDeleteModal(false)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleDelete} disabled={deleting}>
                {deleting ? 'Deleting…' : 'Yes, Delete'}
              </button>
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
