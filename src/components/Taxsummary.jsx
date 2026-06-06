import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import Navbar from './Navbar'
import { formatCAD, round2 } from '../lib/invoiceUtils'

const GST_RATE    = 0.05
const QST_RATE    = 0.09975

const HST_PROVINCES = ['ON', 'NB', 'NS', 'NL', 'PE']

function getTaxBreakdown(invoice) {
  const province = (invoice.province || '').toUpperCase()
  const taxable  = round2((invoice.subtotal || 0) - (invoice.discount_amount || 0))
  const taxCollected = invoice.gst_amount || 0

  if (!invoice.gst_enabled || taxCollected === 0) {
    return { taxable, gstToCRA: 0, hstToCRA: 0, qstToRevQC: 0, province }
  }

  if (province === 'QC') {
    const gstToCRA   = round2(taxable * GST_RATE)
    const qstToRevQC = round2(taxable * QST_RATE)
    return { taxable, gstToCRA, hstToCRA: 0, qstToRevQC, province }
  }

  if (HST_PROVINCES.includes(province)) {
    return { taxable, gstToCRA: 0, hstToCRA: taxCollected, qstToRevQC: 0, province }
  }

  return { taxable, gstToCRA: taxCollected, hstToCRA: 0, qstToRevQC: 0, province }
}

function getAvailableYears(invoices) {
  const years = new Set(
    invoices
      .map(inv => inv.service_date?.substring(0, 4))
      .filter(Boolean)
  )
  const currentYear = new Date().getFullYear().toString()
  years.add(currentYear)
  return [...years].sort((a, b) => b - a)
}

export default function TaxSummary({ session }) {
  const [invoices, setInvoices]         = useState([])
  const [loading, setLoading]           = useState(true)
  const [taxYear, setTaxYear]           = useState(new Date().getFullYear().toString())
  const [statusFilter, setStatusFilter] = useState('paid')
  const printRef = useRef()

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data, error } = await supabase
        .from('invoices')
        .select('id,invoice_number,client_name,service_date,province,gst_enabled,subtotal,discount_amount,gst_amount,total,status')
        .order('service_date', { ascending: true })
      if (!error) setInvoices(data || [])
      setLoading(false)
    }
    load()
  }, [])

  const availableYears = getAvailableYears(invoices)

  const filtered = invoices.filter(inv => {
    const year = inv.service_date?.substring(0, 4)
    if (year !== taxYear) return false
    if (statusFilter === 'paid') return inv.status === 'paid'
    if (statusFilter === 'sent_paid') return inv.status === 'paid' || inv.status === 'sent'
    return true
  })

  const totals = filtered.reduce(
    (acc, inv) => {
      const { taxable, gstToCRA, hstToCRA, qstToRevQC } = getTaxBreakdown(inv)
      acc.grossRevenue  = round2(acc.grossRevenue  + taxable)
      acc.gstToCRA      = round2(acc.gstToCRA      + gstToCRA)
      acc.hstToCRA      = round2(acc.hstToCRA      + hstToCRA)
      acc.qstToRevQC    = round2(acc.qstToRevQC    + qstToRevQC)
      acc.quebecRevenue = inv.province?.toUpperCase() === 'QC'
        ? round2(acc.quebecRevenue + taxable)
        : acc.quebecRevenue
      return acc
    },
    { grossRevenue: 0, gstToCRA: 0, hstToCRA: 0, qstToRevQC: 0, quebecRevenue: 0 }
  )
  totals.totalTaxCRA = round2(totals.gstToCRA + totals.hstToCRA)

  const statusLabels = {
    paid:      'Paid invoices only',
    sent_paid: 'Sent + Paid invoices',
    all:       'All invoices (incl. drafts)',
  }

  if (loading) {
    return (
      <>
        <Navbar session={session} />
        <div className="container" style={{ paddingTop: 48, textAlign: 'center' }}>
          <div className="spinner" />
        </div>
      </>
    )
  }

  return (
    <>
      <Navbar session={session} />
      <div className="container" style={{ maxWidth: 820, paddingTop: 32, paddingBottom: 64 }}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 28 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--navy)', margin: 0 }}>Tax Summary</h1>
            <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 14 }}>Revenue breakdown for CRA and Revenue Québec</p>
          </div>
          <button onClick={() => window.print()} className="btn btn-primary" style={{ gap: 6, display: 'flex', alignItems: 'center' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>
            </svg>
            Print / Save PDF
          </button>
        </div>

        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 28, padding: '16px 20px', background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0' }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>TAX YEAR</label>
            <select value={taxYear} onChange={e => setTaxYear(e.target.value)} className="form-control" style={{ minWidth: 120 }}>
              {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 4 }}>INCLUDE</label>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="form-control" style={{ minWidth: 220 }}>
              <option value="paid">Paid invoices only (recommended)</option>
              <option value="sent_paid">Sent + Paid invoices</option>
              <option value="all">All invoices (incl. drafts)</option>
            </select>
          </div>
          <div style={{ alignSelf: 'flex-end', paddingBottom: 2 }}>
            <span style={{ fontSize: 13, color: '#64748b' }}>
              <strong style={{ color: '#1e293b' }}>{filtered.length}</strong> invoice{filtered.length !== 1 ? 's' : ''} · {statusLabels[statusFilter]}
            </span>
          </div>
        </div>

        <div ref={printRef} id="tax-report">
          <div className="print-header" style={{ display: 'none' }}>
            <h2 style={{ margin: 0 }}>AI with Robert — Tax Summary {taxYear}</h2>
            <p style={{ margin: '4px 0 0', color: '#64748b' }}>{statusLabels[statusFilter]} · Generated {new Date().toLocaleDateString('en-CA')}</p>
          </div>

          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0', color: '#94a3b8' }}>
              No invoices found for {taxYear} with the selected filter.
            </div>
          ) : (
            <>
              <section style={{ marginBottom: 32 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: '#1e3a5f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ color: '#fff', fontWeight: 700, fontSize: 13 }}>CRA</span>
                  </div>
                  <div>
                    <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#1e293b' }}>Canada Revenue Agency</h2>
                    <span style={{ fontSize: 13, color: '#64748b' }}>Federal taxes — GST / HST</span>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 16 }}>
                  <SummaryCard label="Gross Revenue (taxable base)" value={formatCAD(totals.grossRevenue)} accent="#1e3a5f" />
                  <SummaryCard label="GST Collected" value={formatCAD(totals.gstToCRA)} sub="(5% — non-HST provinces + QC)" accent="#2563eb" />
                  <SummaryCard label="HST Collected" value={formatCAD(totals.hstToCRA)} sub="(13–15% — ON, NB, NS, NL, PE)" accent="#2563eb" />
                  <SummaryCard label="Total Remit to CRA" value={formatCAD(totals.totalTaxCRA)} accent="#15803d" highlight />
                </div>
                <InvoiceTable
                  invoices={filtered}
                  columns={[
                    { label: 'Invoice', key: 'invoice_number' },
                    { label: 'Client', key: 'client_name' },
                    { label: 'Date', key: 'service_date' },
                    { label: 'Province', key: 'province' },
                    { label: 'Taxable Base', key: '_taxable', align: 'right' },
                    { label: 'GST → CRA', key: '_gstCRA', align: 'right' },
                    { label: 'HST → CRA', key: '_hstCRA', align: 'right' },
                  ]}
                  rowFn={inv => {
                    const b = getTaxBreakdown(inv)
                    return {
                      invoice_number: inv.invoice_number,
                      client_name: inv.client_name,
                      service_date: inv.service_date,
                      province: inv.province || '—',
                      _taxable: formatCAD(b.taxable),
                      _gstCRA: b.gstToCRA ? formatCAD(b.gstToCRA) : '—',
                      _hstCRA: b.hstToCRA ? formatCAD(b.hstToCRA) : '—',
                    }
                  }}
                  footerCells={['', '', '', 'TOTAL', formatCAD(totals.grossRevenue), formatCAD(totals.gstToCRA), formatCAD(totals.hstToCRA)]}
                />
              </section>

              <section style={{ marginBottom: 32 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: '#0f4c81', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ color: '#fff', fontWeight: 700, fontSize: 10, textAlign: 'center', lineHeight: 1.2 }}>REV QC</span>
                  </div>
                  <div>
                    <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#1e293b' }}>Revenue Québec</h2>
                    <span style={{ fontSize: 13, color: '#64748b' }}>Provincial tax — QST (9.975%)</span>
                  </div>
                </div>
                {totals.quebecRevenue === 0 ? (
                  <div style={{ padding: '20px 24px', background: '#f8fafc', borderRadius: 10, border: '1px solid #e2e8f0', color: '#94a3b8', fontSize: 14 }}>
                    No Quebec invoices found for {taxYear}.
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 16 }}>
                      <SummaryCard label="Quebec Revenue (taxable base)" value={formatCAD(totals.quebecRevenue)} accent="#0f4c81" />
                      <SummaryCard label="QST Collected" value={formatCAD(totals.qstToRevQC)} sub="(9.975%)" accent="#2563eb" />
                      <SummaryCard label="Total Remit to Rev. Québec" value={formatCAD(totals.qstToRevQC)} accent="#15803d" highlight />
                    </div>
                    <InvoiceTable
                      invoices={filtered.filter(inv => inv.province?.toUpperCase() === 'QC')}
                      columns={[
                        { label: 'Invoice', key: 'invoice_number' },
                        { label: 'Client', key: 'client_name' },
                        { label: 'Date', key: 'service_date' },
                        { label: 'Taxable Base', key: '_taxable', align: 'right' },
                        { label: 'GST → CRA', key: '_gstCRA', align: 'right' },
                        { label: 'QST → Rev. QC', key: '_qst', align: 'right' },
                      ]}
                      rowFn={inv => {
                        const b = getTaxBreakdown(inv)
                        return {
                          invoice_number: inv.invoice_number,
                          client_name: inv.client_name,
                          service_date: inv.service_date,
                          _taxable: formatCAD(b.taxable),
                          _gstCRA: formatCAD(b.gstToCRA),
                          _qst: b.qstToRevQC ? formatCAD(b.qstToRevQC) : '—',
                        }
                      }}
                      footerCells={['', '', 'TOTAL', formatCAD(totals.quebecRevenue), formatCAD(totals.gstToCRA), formatCAD(totals.qstToRevQC)]}
                    />
                  </>
                )}
              </section>

              {filtered.some(inv => !inv.gst_enabled || !inv.gst_amount) && (
                <section style={{ marginBottom: 32 }}>
                  <h3 style={{ fontSize: 15, fontWeight: 600, color: '#64748b', marginBottom: 12 }}>Invoices without tax collected</h3>
                  <InvoiceTable
                    invoices={filtered.filter(inv => !inv.gst_enabled || !inv.gst_amount)}
                    columns={[
                      { label: 'Invoice', key: 'invoice_number' },
                      { label: 'Client', key: 'client_name' },
                      { label: 'Date', key: 'service_date' },
                      { label: 'Province', key: 'province' },
                      { label: 'Amount', key: '_total', align: 'right' },
                    ]}
                    rowFn={inv => ({
                      invoice_number: inv.invoice_number,
                      client_name: inv.client_name,
                      service_date: inv.service_date,
                      province: inv.province || '—',
                      _total: formatCAD(round2((inv.subtotal || 0) - (inv.discount_amount || 0))),
                    })}
                  />
                </section>
              )}

              <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 12, padding: '20px 24px' }}>
                <h3 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700, color: '#0369a1' }}>
                  {taxYear} Summary — At a Glance
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                  <GlanceStat label="Total Revenue" value={formatCAD(totals.grossRevenue)} />
                  <GlanceStat label="Total GST/HST → CRA" value={formatCAD(totals.totalTaxCRA)} />
                  <GlanceStat label="Total QST → Rev. Québec" value={formatCAD(totals.qstToRevQC)} />
                  <GlanceStat label="Total Tax Collected" value={formatCAD(round2(totals.totalTaxCRA + totals.qstToRevQC))} />
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <style>{`
        @media print {
          .navbar, .no-print { display: none !important; }
          .print-header { display: block !important; margin-bottom: 24px; }
          body { background: white; }
          .container { max-width: 100% !important; padding: 0 !important; }
          button { display: none !important; }
        }
      `}</style>
    </>
  )
}

function SummaryCard({ label, value, sub, accent = '#1e3a5f', highlight = false }) {
  return (
    <div style={{
      background: highlight ? '#f0fdf4' : '#fff',
      border: `1px solid ${highlight ? '#bbf7d0' : '#e2e8f0'}`,
      borderLeft: `4px solid ${accent}`,
      borderRadius: 10,
      padding: '14px 16px',
    }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: highlight ? '#15803d' : '#1e293b' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

function GlanceStat({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 12, color: '#0369a1', fontWeight: 600, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: '#0c4a6e' }}>{value}</div>
    </div>
  )
}

function InvoiceTable({ invoices, columns, rowFn, footerCells }) {
  if (invoices.length === 0) return null
  return (
    <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid #e2e8f0' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: '#f8fafc' }}>
            {columns.map(col => (
              <th key={col.key} style={{ padding: '8px 12px', textAlign: col.align || 'left', fontWeight: 600, color: '#475569', borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {invoices.map((inv, i) => {
            const row = rowFn(inv)
            return (
              <tr key={inv.id} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
                {columns.map(col => (
                  <td key={col.key} style={{ padding: '7px 12px', textAlign: col.align || 'left', color: '#334155', borderBottom: '1px solid #f1f5f9' }}>
                    {row[col.key]}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
        {footerCells && (
          <tfoot>
            <tr style={{ background: '#f1f5f9' }}>
              {footerCells.map((cell, i) => (
                <td key={i} style={{ padding: '8px 12px', textAlign: columns[i]?.align || 'left', fontWeight: 700, color: '#1e293b', borderTop: '2px solid #e2e8f0' }}>
                  {cell}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}
