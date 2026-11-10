import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { formatCAD, formatDate, utcToETDateStr, getProvinceTaxLabel, getProvinceTaxRate } from './invoiceUtils'
import { t, langOf, fmtPct, pdfSafe } from './i18n'
import { brandOf, hexToRgb, CONTACT } from './brands'

// Neutral colours shared by both brands.
const BASE = {
  gray:      [100, 116, 139],
  lightGray: [248, 250, 252],
  dark:      [15, 23, 42],
  white:     [255, 255, 255],
}

// Per-invoice palette: navy is shared; accent/lightBlue/blue come from the brand.
// `BRAND` is reassigned at the start of each generateInvoicePDF() call so the
// drawing helpers below can keep reading BRAND.* unchanged.
let BRAND = buildPalette('seniors')
let LANG = 'en'
const L = (key, vars) => t(LANG, key, vars)
const money = v => pdfSafe(formatCAD(v, LANG))
function buildPalette(brandId) {
  const b = brandOf(brandId)
  return {
    ...BASE,
    navy:      hexToRgb(b.navy),
    blue:      hexToRgb(b.accentText),   // labels / lines (text-safe)
    accent:    hexToRgb(b.accent),       // header rule
    lightBlue: hexToRgb(b.tint),
  }
}

// ── Logo helpers ─────────────────────────────────────────────────────────────

// Brand logos are bundled with the app (public/logos/), so they load from this
// site's own origin — no cross-site dependency that can disappear.
async function fetchLogoFull(brand) {
  try {
    const res = await fetch(brand.logo)
    if (!res.ok) return null
    const blob = await res.blob()
    if (!blob.type.startsWith('image/')) return null
    return await blobToBase64(blob)
  } catch (_) { return null }
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result)
    reader.onerror   = reject
    reader.readAsDataURL(blob)
  })
}

// ── PDF skeleton ──────────────────────────────────────────────────────────────

function createDoc() {
  return new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' })
}

function drawHeader(doc, pageW, margin, logoData, brand) {
  doc.setFillColor(...BRAND.lightGray)
  doc.rect(0, 0, pageW, doc.internal.pageSize.getHeight(), 'F')
  doc.setFillColor(...BRAND.navy)
  doc.rect(0, 0, pageW, 50, 'F')
  doc.setFillColor(...BRAND.accent)
  doc.rect(0, 50, pageW, 3, 'F')

  // The logo mark is navy on transparent, so it sits on a white tile to stay
  // visible against the navy header.
  doc.setFillColor(...BRAND.white)
  doc.roundedRect(margin, 8, 28, 28, 3, 3, 'F')
  if (logoData) {
    doc.addImage(logoData, 'PNG', margin + 2, 10, 24, 24, undefined, 'FAST')
  }

  doc.setTextColor(...BRAND.white)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.text('AI with Robert', margin + 32, 20)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(200, 220, 255)
  doc.text(LANG === 'fr' ? brand.taglineFr : brand.tagline, margin + 32, 27)
  doc.text(CONTACT.address, margin + 32, 33)
  doc.text(`${CONTACT.email}  ·  ${CONTACT.phone}  ·  ${brand.website}`, margin + 32, 39)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(26)
  doc.setTextColor(...BRAND.white)
  doc.text(L('invoice'), pageW - margin, 28, { align: 'right' })
}

function drawBody(doc, invoice, margin, pageW) {
  const billBottom = _drawMetaAndBillTo(doc, invoice, margin, pageW)
  // Start the table below the Bill To block even when a company + attn line makes it taller.
  _drawServicesTable(doc, invoice, margin, Math.max(96, billBottom + 8))
  _drawTotals(doc, invoice, margin, pageW)
  _drawNotes(doc, invoice, margin, pageW)
  _drawFooter(doc, invoice, doc.internal.pageSize.getHeight(), margin, pageW)
}

// ── Drawing helpers ───────────────────────────────────────────────────────────

function _drawMetaAndBillTo(doc, invoice, margin, pageW, startY = 62) {
  const col1 = pageW - margin - 80
  const col2 = col1 + 36

  const issuedDateET = pdfSafe(formatDate(
    utcToETDateStr(invoice.created_at) ||
    new Date().toLocaleDateString('en-CA', { timeZone: 'America/Toronto' }),
    LANG
  ))

  const metaRows = [
    [L('invoiceNo'),     invoice.invoice_number],
    [L('dateIssued'),    issuedDateET],
    [L('dateOfService'), pdfSafe(formatDate(invoice.service_date, LANG))],
    [L('status'),        L(`status_${invoice.status || 'draft'}`)],
  ]
  metaRows.forEach(([label, value], i) => {
    const y = startY + i * 7
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    doc.setTextColor(...BRAND.gray)
    doc.text(label, col1, y)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...BRAND.dark)
    doc.text(value || '', col2, y)
  })

  const billY = startY
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...BRAND.blue)
  doc.text(L('billTo'), margin, billY)
  doc.setDrawColor(...BRAND.blue)
  doc.setLineWidth(0.4)
  doc.line(margin, billY + 1.5, margin + 40, billY + 1.5)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(...BRAND.dark)
  const maxNameWidth = col1 - margin - 8
  // Business invoices bill a company: company name leads, contact person below it.
  const company = invoice.client_company || ''
  const nameLines = doc.splitTextToSize(company || invoice.client_name || '', maxNameWidth)
  doc.text(nameLines, margin, billY + 9)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...BRAND.gray)
  let addressY = billY + 9 + (nameLines.length * 6)
  if (company && invoice.client_name) { doc.text(`${L('attn')} ${invoice.client_name}`, margin, addressY); addressY += 6 }

  if (invoice.client_email)  { doc.text(invoice.client_email,  margin, addressY); addressY += 6 }
  if (invoice.address_line1) { doc.text(invoice.address_line1, margin, addressY); addressY += 6 }
  if (invoice.address_line2) { doc.text(invoice.address_line2, margin, addressY); addressY += 6 }
  const cityLine = [invoice.address_city, invoice.province, invoice.address_postal].filter(Boolean).join(', ')
  if (cityLine)             { doc.text(cityLine,              margin, addressY) }
  else if (invoice.province){ doc.text(invoice.province,      margin, addressY) }
  return addressY
}

function _drawServicesTable(doc, invoice, margin, startY = 96) {
  const services = Array.isArray(invoice.services) ? invoice.services : []
  autoTable(doc, {
    startY,
    margin: { left: margin, right: margin },
    head: [[L('service'), L('description'), L('qtyPeople'), L('rate'), L('amount')]],
    body: services.map(item => {
      const isWorkshop = item.service_id === 'group-workshop'
      const qtyLabel   = isWorkshop
        ? L('workshopQty', { p: item.people || 1, s: item.quantity || 1 })
        : String(item.quantity || 1)
      const amount = isWorkshop
        ? (item.people || 1) * (item.quantity || 1) * (item.rate || 0)
        : (item.quantity || 1) * (item.rate || 0)
      return [item.service_name || '', item.description || '', qtyLabel, money(item.rate || 0), money(amount)]
    }),
    headStyles:         { fillColor: BRAND.accent, textColor: BRAND.navy, fontStyle: 'bold', fontSize: 8.5, cellPadding: 4 },
    bodyStyles:         { fontSize: 8.5, textColor: BRAND.dark, cellPadding: 3.5 },
    alternateRowStyles: { fillColor: BRAND.lightBlue },
    columnStyles: {
      0: { cellWidth: 38, fontStyle: 'bold' },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 30, halign: 'center' },
      3: { cellWidth: 24, halign: 'right' },
      4: { cellWidth: 28, halign: 'right', fontStyle: 'bold' },
    },
    styles: { overflow: 'linebreak', lineColor: [226, 232, 240], lineWidth: 0.3 },
  })
}

function _drawTotals(doc, invoice, margin, pageW) {
  const totalsY = doc.lastAutoTable.finalY + 8
  const totalsX = pageW - margin - 70
  const totalsW = 70
  const rowCount = 1 + (invoice.discount_amount > 0 ? 1 : 0) + (invoice.gst_enabled ? 1 : 0)

  doc.setFillColor(...BRAND.white)
  doc.roundedRect(totalsX, totalsY, totalsW, rowCount * 8 + 14, 3, 3, 'F')

  let ty = totalsY + 9
  const lc = totalsX + 5
  const rc = totalsX + totalsW - 5

  const addRow = (label, value, color) => {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...(color || BRAND.gray))
    doc.text(label, lc, ty)
    doc.text(money(value), rc, ty, { align: 'right' })
    ty += 7
  }

  addRow(L('subtotal'), invoice.subtotal || 0)
  if (invoice.discount_amount > 0) {
    const label = invoice.discount_type === 'percent'
      ? `${L('discount')} (${pdfSafe(fmtPct(invoice.discount_value, LANG))})`
      : L('discount')
    addRow(label, -Math.abs(invoice.discount_amount || 0), [22, 163, 74])
  }
  if (invoice.gst_enabled) {
    const taxLabel = getProvinceTaxLabel(invoice.province, LANG)
    const taxRate  = getProvinceTaxRate(invoice.province)
    addRow(`${taxLabel} (${pdfSafe(fmtPct(taxRate, LANG))})`, invoice.gst_amount || 0)
  }

  doc.setDrawColor(...BRAND.lightBlue)
  doc.setLineWidth(0.5)
  doc.line(lc, ty - 2, rc, ty - 2)
  doc.setFillColor(...BRAND.accent)
  doc.roundedRect(totalsX, ty - 1, totalsW, 12, 2, 2, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...BRAND.navy)
  doc.text(L('totalDue'), lc, ty + 6.5)
  doc.text(money(invoice.total || 0), rc, ty + 6.5, { align: 'right' })
}

function _drawNotes(doc, invoice, margin, pageW) {
  if (!invoice.notes) return
  const totalsY = doc.lastAutoTable.finalY + 8
  const totalsX = pageW - margin - 70
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...BRAND.blue)
  doc.text(L('notes'), margin, totalsY)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(...BRAND.gray)
  const lines = doc.splitTextToSize(invoice.notes, totalsX - margin - 10)
  doc.text(lines, margin, totalsY + 7)
}

function _drawFooter(doc, invoice, pageH, margin, pageW) {
  const footY    = pageH - 20
  const taxLabel = getProvinceTaxLabel(invoice.province, LANG)
  const taxRate  = getProvinceTaxRate(invoice.province)

  doc.setFillColor(...BRAND.accent)
  doc.rect(0, footY, pageW, 20, 'F')
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(...BRAND.navy)
  const brand = brandOf(invoice)
  doc.text(L('thanks'), pageW / 2, footY + 5,  { align: 'center' })
  doc.text(CONTACT.address, pageW / 2, footY + 10, { align: 'center' })
  doc.text(`${brand.website}  ·  ${CONTACT.email}  ·  ${CONTACT.phone}`, pageW / 2, footY + 15, { align: 'center' })
  doc.setTextColor(...BRAND.navy)
  doc.setFontSize(6.5)
  const taxNote = invoice.gst_enabled
    ? pdfSafe(L('taxApplied', { label: taxLabel, rate: fmtPct(taxRate, LANG) }))
    : L('taxNA')
  doc.text(taxNote, margin, footY + 10)
}

// ── Public export ─────────────────────────────────────────────────────────────

export async function generateInvoicePDF(invoice) {
  const doc      = createDoc()
  const pageW    = doc.internal.pageSize.getWidth()
  const margin   = 20
  const brand    = brandOf(invoice)
  BRAND = buildPalette(brand.id)
  LANG = langOf(invoice)
  const logoData = await fetchLogoFull(brand)
  drawHeader(doc, pageW, margin, logoData, brand)
  drawBody(doc, invoice, margin, pageW)
  const filename = `${L('pdfPrefix')}-${invoice.invoice_number}-${invoice.client_name?.replace(/\s+/g, '-')}.pdf`
  doc.save(filename)
}
