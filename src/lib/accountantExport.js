import { getTaxBreakdown, round2 } from './invoiceUtils'

// Accountant package: one CSV with a summary per brand on top and one row per invoice below.
// Pure functions (no browser or database) so scripts/check_accountant_export.mjs can test them.

export const QUARTERS = {
  all: { label: 'Full year', from: '01', to: '12' },
  Q1:  { label: 'Q1 (Jan to Mar)', from: '01', to: '03' },
  Q2:  { label: 'Q2 (Apr to Jun)', from: '04', to: '06' },
  Q3:  { label: 'Q3 (Jul to Sep)', from: '07', to: '09' },
  Q4:  { label: 'Q4 (Oct to Dec)', from: '10', to: '12' },
}

// service_date is YYYY-MM-DD; keep invoices whose service month falls in the period.
export function inPeriod(serviceDate, year, period = 'all') {
  if (!serviceDate || serviceDate.slice(0, 4) !== String(year)) return false
  const q = QUARTERS[period] || QUARTERS.all
  const m = serviceDate.slice(5, 7)
  return m >= q.from && m <= q.to
}

function esc(v) {
  const s = v === null || v === undefined ? '' : String(v)
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
}

const BRAND_LABEL = { seniors: 'Seniors', business: 'Business' }

export function summarizeByBrand(invoices) {
  const out = {}
  for (const inv of invoices) {
    const b = inv.brand === 'business' ? 'business' : 'seniors'
    const t = getTaxBreakdown(inv)
    const o = (out[b] ||= { count: 0, taxable: 0, gst: 0, hst: 0, qst: 0, total: 0 })
    o.count += 1
    o.taxable = round2(o.taxable + t.taxable)
    o.gst = round2(o.gst + t.gstToCRA)
    o.hst = round2(o.hst + t.hstToCRA)
    o.qst = round2(o.qst + t.qstToRevQC)
    o.total = round2(o.total + (inv.total || 0))
  }
  return out
}

export function buildAccountantCsv(invoices, { year, period = 'all', includeLabel = '' } = {}) {
  const q = QUARTERS[period] || QUARTERS.all
  const by = summarizeByBrand(invoices)
  const all = Object.values(by).reduce((a, o) => ({ count: a.count + o.count, taxable: round2(a.taxable + o.taxable), gst: round2(a.gst + o.gst), hst: round2(a.hst + o.hst), qst: round2(a.qst + o.qst), total: round2(a.total + o.total) }), { count: 0, taxable: 0, gst: 0, hst: 0, qst: 0, total: 0 })
  const lines = []
  lines.push(['AI with Robert - accountant package'].map(esc).join(','))
  lines.push(['Period', `${year} ${q.label}`, 'Includes', includeLabel].map(esc).join(','))
  lines.push('')
  lines.push(['SUMMARY', 'Invoices', 'Revenue before tax', 'GST to CRA', 'HST to CRA', 'QST to Revenu Quebec', 'Total billed'].map(esc).join(','))
  for (const b of ['seniors', 'business']) {
    const o = by[b] || { count: 0, taxable: 0, gst: 0, hst: 0, qst: 0, total: 0 }
    lines.push([BRAND_LABEL[b], o.count, o.taxable.toFixed(2), o.gst.toFixed(2), o.hst.toFixed(2), o.qst.toFixed(2), o.total.toFixed(2)].map(esc).join(','))
  }
  lines.push(['Both brands', all.count, all.taxable.toFixed(2), all.gst.toFixed(2), all.hst.toFixed(2), all.qst.toFixed(2), all.total.toFixed(2)].map(esc).join(','))
  lines.push('')
  lines.push(['Invoice #', 'Brand', 'Client', 'Company', 'Service date', 'Status', 'Province', 'Revenue before tax', 'GST', 'HST', 'QST', 'Total'].map(esc).join(','))
  const sorted = [...invoices].sort((a, b) => String(a.service_date).localeCompare(String(b.service_date)) || String(a.invoice_number).localeCompare(String(b.invoice_number)))
  for (const inv of sorted) {
    const t = getTaxBreakdown(inv)
    lines.push([inv.invoice_number, BRAND_LABEL[inv.brand === 'business' ? 'business' : 'seniors'], inv.client_name, inv.client_company || '', inv.service_date, inv.status, t.province, t.taxable.toFixed(2), t.gstToCRA.toFixed(2), t.hstToCRA.toFixed(2), t.qstToRevQC.toFixed(2), (inv.total || 0).toFixed(2)].map(esc).join(','))
  }
  return lines.join('\r\n') + '\r\n'
}

export function downloadCsv(text, filename) {
  const blob = new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
