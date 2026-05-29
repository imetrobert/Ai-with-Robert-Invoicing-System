import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { generateInvoicePDF } from '../lib/pdfGenerator'
import { formatCAD, formatDate, getProvinceTaxLabel, getProvinceTaxRate, utcToETDateStr } from '../lib/invoiceUtils'

export default function InvoicePublic() {
  const { token } = useParams()
  const [invoice, setInvoice] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [pdfLoading, setPdfLoading] = useState(false)

  useEffect(() => {
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex, nofollow'
    document.head.appendChild(meta)
    return () => document.head.removeChild(meta)
  }, [])

  useEffect(() => {
    fetchAndTrack()
  }, [token])

  async function fetchAndTrack() {
    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .eq('view_token', token)
      .single()

    if (error || !data) { setNotFound(true); setLoading(false); return }

    setInvoice(data)
    setLoading(false)

    await supabase.rpc('increment_invoice_view', { token })
  }

  async function handlePDF() {
    setPdfLoading(true)
    try { await generateInvoicePDF(invoice) }
    catch (e) { alert('PDF generation failed: ' + e.message) }
    setPdfLoading(false)
  }

  if (loading) return (
    <div className="loading-screen">
      <div className="spinner" />
    </div>
  )

  if (notFound) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: 20 }}>
      <div style={{ textAlign: 'center', maxWidth: 360 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>📄</div>
        <h2 style={{ fontFamily: "'Playfair Display', serif", color: 'var(--navy)', marginBottom: 8 }}>Invoice Not Found</h2>
        <p style={{ color: 'var(--muted)', fontSize: 14 }}>This invoice link may have expired or is no longer available. Please contact AI with Robert directly.</p>
        <a href="mailto:invoices@aiwithrobert.com" style={{ display: 'inline-block', marginTop: 20, color: 'var(--blue)', fontSize: 14 }}>invoices@aiwithrobert.com</a>
      </div>
    </div>
  )

  const services = Array.isArray(invoice.services) ? invoice.services : []
  const taxLabel = getProvinceTaxLabel(invoice.province)
  const taxRate = getProvinceTaxRate(invoice.province)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: "'Source Sans 3', 'Segoe UI', sans-serif" }}>
      {/* Top bar */}
      <div style={{ background: 'var(--navy)', padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src="https://aiwithrobert.com/logo.PNG" alt="AI with Robert" style={{ height: 32, borderRadius: 6 }} onError={e => e.target.style.display='none'} />
          <div style={{ color: 'white' }}>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 15, fontWeight: 600 }}>AI with Robert</div>
            <div style={{ fontSize: 10, opacity: .7 }}>invoices.aiwithrobert.com</div>
          </div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={handlePDF} disabled={pdfLoading} style={{ flexShrink: 0 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          {pdfLoading ? 'Generating…' : 'Download PDF'}
        </button>
      </div>

      <div style={{ maxWidth: 700, margin: '0 auto', padding: '20px 16px' }}>
        <div className="card">
          {/* Brand header */}
          <div style={{ background: 'linear-gradient(135deg, #153457 0%, #1e4a8a 100%)', padding: '20px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <img src="https://aiwithrobert.com/logo.PNG" alt="" style={{ height: 40, borderRadius: 6 }} onError={e => e.target.style.display='none'} />
              <div style={{ color: 'white' }}>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 700 }}>AI with Robert</div>
                <div style={{ fontSize: 11, opacity: .7 }}>invoices@aiwithrobert.com · 514-250-8491</div>
                <div style={{ fontSize: 11, opacity: .7 }}>aiwithrobert.com</div>
              </div>
            </div>
            <div style={{ textAlign: 'right', color: 'white' }}>
              <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: 1 }}>INVOICE</div>
              <div style={{ fontFamily: 'monospace', fontSize: 12, opacity: .8 }}>{invoice.invoice_number}</div>
            </div>
          </div>

          <div style={{ padding: '20px 20px' }}>
            {/* Bill To + Meta */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--blue)', fontWeight: 700, marginBottom: 6 }}>Bill To</div>
                <div style={{ fontSize: 17, fontWeight: 700 }}>{invoice.client_name}</div>
                {invoice.client_email && <div style={{ color: 'var(--muted)', fontSize: 13 }}>{invoice.client_email}</div>}
                {invoice.address_line1 && <div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 3 }}>{invoice.address_line1}</div>}
                {invoice.address_line2 && <div style={{ color: 'var(--muted)', fontSize: 13 }}>{invoice.address_line2}</div>}
                {(invoice.address_city || invoice.province) && (
                  <div style={{ color: 'var(--muted)', fontSize: 13 }}>
                    {[invoice.address_city, invoice.province, invoice.address_postal].filter(Boolean).join(', ')}
                  </div>
                )}
              </div>
              <div>
                <MetaRow label="Date of Service" value={formatDate(invoice.service_date)} />
                <MetaRow label="Date Issued" value={formatDate(utcToETDateStr(invoice.created_at))} />
                <MetaRow label="Status" value={(invoice.status || 'draft').toUpperCase()} />
              </div>
            </div>

            {/* Services table */}
            <div className="table-scroll-wrapper">
              <table className="data-table">
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

            {/* Totals */}
            <div style={{ maxWidth: 280, marginLeft: 'auto', marginTop: 8 }}>
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

            {/* Notes */}
            {invoice.notes && (
              <div style={{ marginTop: 20, padding: '12px 14px', background: 'var(--bg)', borderLeft: '3px solid var(--blue)', borderRadius: 4 }}>
                <div style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--blue)', fontWeight: 700, marginBottom: 5 }}>Notes</div>
                <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>{invoice.notes}</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{ background: 'var(--navy)', color: 'rgba(255,255,255,.6)', textAlign: 'center', padding: '12px 20px', fontSize: 11 }}>
            Thank you for choosing AI with Robert! —{' '}
            {invoice.gst_enabled ? `${taxLabel} at ${taxRate}%` : 'GST/QST/HST not applicable at this time.'}
          </div>
        </div>

        <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--muted)', fontSize: 13 }}>
          Questions? Contact us at <a href="mailto:invoices@aiwithrobert.com" style={{ color: 'var(--blue)' }}>invoices@aiwithrobert.com</a>
        </div>
      </div>
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
