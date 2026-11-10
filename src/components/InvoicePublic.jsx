import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { generateInvoicePDF } from '../lib/pdfGenerator'
import { formatCAD, formatDate, getProvinceTaxLabel, getProvinceTaxRate, utcToETDateStr } from '../lib/invoiceUtils'
import { brandOf, brandCssVars, CONTACT } from '../lib/brands'
import { t, langOf, fmtPct } from '../lib/i18n'

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
    // Fetched via RPC, not a table filter: RLS can only see the row, so a
    // view_token=eq.<token> filter is scoping the caller supplies and can drop.
    // invoice_by_token(token text) takes the token as an argument instead, so
    // the database does the scoping. Empty array = no invoice for that token.
    const { data, error } = await supabase.rpc('invoice_by_token', { token: String(token) })
    const record = Array.isArray(data) ? data[0] : data

    if (error || !record) { setNotFound(true); setLoading(false); return }

    setInvoice(record)
    setLoading(false)

    // Explicitly cast token to string to match increment_invoice_view(token text) signature
    const { error: rpcError } = await supabase.rpc('increment_invoice_view', { token: String(token) })
    if (rpcError) console.error('View RPC error:', rpcError)
  }

  async function handlePDF() {
    setPdfLoading(true)
    try {
      // Recorded before the PDF is generated, not after. generateInvoicePDF ends
      // in doc.save(), which on iOS hands the file to Safari and suspends this
      // page — killing any request still in flight, so the count never landed.
      // The trade is that this counts a download that started rather than one
      // that finished.
      const { error: rpcError } = await supabase.rpc('increment_invoice_pdf_download', { token: String(token) })
      if (rpcError) console.error('PDF RPC error:', rpcError)
      await generateInvoicePDF(invoice)
    }
    catch (e) { alert(t(langOf(invoice), 'pdfFailed') + e.message) }
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
        <h2 style={{ fontFamily: "'Playfair Display', serif", color: 'var(--navy)', marginBottom: 8 }}>{t('en', 'notFoundTitle')} / {t('fr', 'notFoundTitle')}</h2>
        <p style={{ color: 'var(--muted)', fontSize: 14 }}>{t('en', 'notFoundBody')}</p>
        <p style={{ color: 'var(--muted)', fontSize: 14 }}>{t('fr', 'notFoundBody')}</p>
        <a href="mailto:invoices@aiwithrobert.com" style={{ display: 'inline-block', marginTop: 20, color: '#1F77AE', fontSize: 14 }}>invoices@aiwithrobert.com</a>
      </div>
    </div>
  )

  const services = Array.isArray(invoice.services) ? invoice.services : []
  const lang = langOf(invoice)
  const L = (k, v) => t(lang, k, v)
  const money = v => formatCAD(v, lang)
  const taxLabel = getProvinceTaxLabel(invoice.province, lang)
  const taxRate = getProvinceTaxRate(invoice.province)
  const brand = brandOf(invoice)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: "'Source Sans 3', 'Segoe UI', sans-serif", ...brandCssVars(brand) }}>
      {/* Top bar */}
      <div style={{ background: 'var(--navy)', padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src={brand.logo} alt={brand.name} style={{ height: 32, width: 32, background: 'white', borderRadius: 6, padding: 2, objectFit: 'contain' }} onError={e => e.target.style.display='none'} />
          <div style={{ color: 'white' }}>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 15, fontWeight: 600 }}>{brand.name}</div>
            <div style={{ fontSize: 10, opacity: .7 }}>{lang === 'fr' ? brand.taglineFr : brand.tagline}</div>
          </div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={handlePDF} disabled={pdfLoading} style={{ flexShrink: 0 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          {pdfLoading ? L('generating') : L('downloadPdf')}
        </button>
      </div>

      <div style={{ maxWidth: 700, margin: '0 auto', padding: '20px 16px' }}>
        <div className="card">
          {/* Brand header */}
          <div style={{ background: brand.navy, borderBottom: `4px solid ${brand.accent}`, padding: '20px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <img src={brand.logo} alt="" style={{ height: 44, width: 44, background: 'white', borderRadius: 8, padding: 3, objectFit: 'contain' }} onError={e => e.target.style.display='none'} />
              <div style={{ color: 'white' }}>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 700 }}>{brand.name}</div>
                <div style={{ fontSize: 11, opacity: .7 }}>{CONTACT.email} · {CONTACT.phone}</div>
                <div style={{ fontSize: 11, opacity: .7 }}>{brand.website}</div>
              </div>
            </div>
            <div style={{ textAlign: 'right', color: 'white' }}>
              <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: 1 }}>{L('invoice')}</div>
              <div style={{ fontFamily: 'monospace', fontSize: 12, opacity: .8 }}>{invoice.invoice_number}</div>
            </div>
          </div>

          <div style={{ padding: '20px 20px' }}>
            {/* Bill To + Meta */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--blue)', fontWeight: 700, marginBottom: 6 }}>{L('billTo')}</div>
                <div style={{ fontSize: 17, fontWeight: 700 }}>{invoice.client_company || invoice.client_name}</div>
                {invoice.client_company && invoice.client_name && <div style={{ color: 'var(--muted)', fontSize: 13 }}>{L('attn')} {invoice.client_name}</div>}
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
                <MetaRow label={L('dateOfService')} value={formatDate(invoice.service_date, lang)} />
                <MetaRow label={L('dateIssued')} value={formatDate(utcToETDateStr(invoice.created_at), lang)} />
                <MetaRow label={L('status')} value={L(`status_${invoice.status || 'draft'}`)} />
              </div>
            </div>

            {/* Services table */}
            <div className="table-scroll-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{L('service')}</th>
                    <th>{L('description')}</th>
                    <th style={{ textAlign: 'center' }}>{L('qty')}</th>
                    <th style={{ textAlign: 'right' }}>{L('rate')}</th>
                    <th style={{ textAlign: 'right' }}>{L('amount')}</th>
                  </tr>
                </thead>
                <tbody>
                  {services.map((svc, i) => {
                    const isWorkshop = svc.service_id === 'group-workshop'
                    const qtyLabel = isWorkshop ? L('workshopQtyShort', { p: svc.people || 1, s: svc.quantity || 1 }) : String(svc.quantity || 1)
                    const amount = isWorkshop
                      ? (svc.people || 1) * (svc.quantity || 1) * (svc.rate || 0)
                      : (svc.quantity || 1) * (svc.rate || 0)
                    return (
                      <tr key={i}>
                        <td style={{ fontWeight: 600 }}>{svc.service_name}</td>
                        <td style={{ color: 'var(--muted)', fontSize: 12 }}>{svc.description}</td>
                        <td style={{ textAlign: 'center' }}>{qtyLabel}</td>
                        <td style={{ textAlign: 'right' }}>{money(svc.rate)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>{money(amount)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div style={{ maxWidth: 280, marginLeft: 'auto', marginTop: 8 }}>
              <div className="totals-row"><span>{L('subtotal')}</span><span>{money(invoice.subtotal || 0)}</span></div>
              {invoice.discount_amount > 0 && (
                <div className="totals-row" style={{ color: 'var(--success)' }}>
                  <span>{L('discount')} {invoice.discount_type === 'percent' ? `(${fmtPct(invoice.discount_value, lang)})` : ''}</span>
                  <span>-{money(invoice.discount_amount)}</span>
                </div>
              )}
              {invoice.gst_enabled && (
                <div className="totals-row"><span>{taxLabel} ({fmtPct(taxRate, lang)})</span><span>{money(invoice.gst_amount || 0)}</span></div>
              )}
              <div className="totals-row total">
                <span>{L('totalDueCad')}</span>
                <span>{money(invoice.total || 0)}</span>
              </div>
            </div>

            {/* Notes */}
            {invoice.notes && (
              <div style={{ marginTop: 20, padding: '12px 14px', background: 'var(--bg)', borderLeft: '3px solid var(--blue)', borderRadius: 4 }}>
                <div style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--blue)', fontWeight: 700, marginBottom: 5 }}>{L('notes')}</div>
                <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>{invoice.notes}</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{ background: brand.accent, color: brand.navy, fontWeight: 600, textAlign: 'center', padding: '12px 20px', fontSize: 11 }}>
            {L('thanks')} —{' '}
            {invoice.gst_enabled ? L('taxAt', { label: taxLabel, rate: fmtPct(taxRate, lang) }) : L('taxNA')}
          </div>
        </div>

        <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--muted)', fontSize: 13 }}>
          {L('questions')} <a href={`mailto:${CONTACT.email}`} style={{ color: "var(--blue)" }}>{CONTACT.email}</a>
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
