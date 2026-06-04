import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { formatCAD, formatDate, utcToETDateStr, getProvinceTaxLabel, getProvinceTaxRate } from './invoiceUtils'

const BRAND = {
  navy:      [21, 52, 95],
  blue:      [37, 99, 235],
  lightBlue: [219, 234, 254],
  gray:      [100, 116, 139],
  lightGray: [248, 250, 252],
  dark:      [15, 23, 42],
  white:     [255, 255, 255],
}

// ── Logo helpers ─────────────────────────────────────────────────────────────

async function fetchLogoFull() {
  try {
    const res  = await fetch('https://aiwithrobert.com/logo.PNG')
    const blob = await res.blob()
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

function drawHeader(doc, pageW, margin, logoData) {
  doc.setFillColor(...BRAND.lightGray)
  doc.rect(0, 0, pageW, doc.internal.pageSize.getHeight(), 'F')
  doc.setFillColor(...BRAND.navy)
  doc.rect(0, 0, pageW, 50, 'F')
  doc.setFillColor(...BRAND.blue)
  doc.rect(0, 50, pageW, 3, 'F')

  if (logoData) {
    doc.addImage(logoData, 'JPEG', margin, 8, 28, 28, undefined, 'FAST')
  }

  doc.setTextColor(...BRAND.white)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.text('AI with Robert', margin + 32, 20)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(200, 220, 255)
  doc.text('AI & Technology Training for Seniors', margin + 32, 27)
  doc.text('5550 Lyndale, Cote Saint-Luc, Quebec  H4V 2L5', margin + 32, 33)
  doc.text('invoices@aiwithrobert.com  ·  (514) 250-8491  ·  aiwithrobert.com', margin + 32, 39)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(26)
  doc.setTextColor(...BRAND.white)
  doc.text('INVOICE', pageW - margin, 28, { align: 'right' })
}

function drawBody(doc, invoice, margin, pageW) {
  _drawMetaAndBillTo(doc, invoice, margin, pageW)
  _drawServicesTable(doc, invoice, margin)
  _drawTotals(doc, invoice, margin, pageW)
  _drawNotes(doc, invoice, margin, pageW)
  _drawFooter(doc, invoice, doc.internal.pageSize.getHeight(), margin, pageW)
}

// ── Drawing helpers ───────────────────────────────────────────────────────────

function _drawMetaAndBillTo(doc, invoice, margin, pageW, startY = 62) {
  const col1 = pageW - margin - 80
  const col2 = col1 + 36

  const issuedDateET = formatDate(
    utcToETDateStr(invoice.created_at) ||
    new Date().toLocaleDateString('en-CA', { timeZone: 'America/Toronto' })
  )

  const metaRows = [
    ['Invoice #',       invoice.invoice_number],
    ['Date Issued',     issuedDateET],
    ['Date of Service', formatDate(invoice.service_date)],
    ['Status',          invoice.status?.toUpperCase() || 'DRAFT'],
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
  doc.text('BILL TO', margin, billY)
  doc.setDrawColor(...BRAND.blue)
  doc.setLineWidth(0.4)
  doc.line(margin, billY + 1.5, margin + 40, billY + 1.5)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(...BRAND.dark)
  const maxNameWidth = col1 - margin - 8
  const nameLines = doc.splitTextToSize(invoice.client_name || '', maxNameWidth)
  doc.text(nameLines, margin, billY + 9)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...BRAND.gray)
  let addressY = billY + 9 + (nameLines.length * 6)

  if (invoice.client_email)  { doc.text(invoice.client_email,  margin, addressY); addressY += 6 }
  if (invoice.address_line1) { doc.text(invoice.address_line1, margin, addressY); addressY += 6 }
  if (invoice.address_line2) { doc.text(invoice.address_line2, margin, addressY); addressY += 6 }
  const cityLine = [invoice.address_city, invoice.province, invoice.address_postal].filter(Boolean).join(', ')
  if (cityLine)             { doc.text(cityLine,              margin, addressY) }
  else if (invoice.province){ doc.text(invoice.province,      margin, addressY) }
}

function _drawServicesTable(doc, invoice, margin, startY = 96) {
  const services = Array.isArray(invoice.services) ? invoice.services : []
  autoTable(doc, {
    startY,
    margin: { left: margin, right: margin },
    head: [['Service', 'Description', 'Qty / People', 'Rate', 'Amount']],
    body: services.map(item => {
      const isWorkshop = item.service_id === 'group-workshop'
      const qtyLabel   = isWorkshop
        ? `${item.people || 1} ppl x ${item.quantity || 1} session(s)`
        : String(item.quantity || 1)
      const amount = isWorkshop
        ? (item.people || 1) * (item.quantity || 1) * (item.rate || 0)
        : (item.quantity || 1) * (item.rate || 0)
      return [item.service_name || '', item.description || '', qtyLabel, formatCAD(item.rate || 0), formatCAD(amount)]
    }),
    headStyles:         { fillColor: BRAND.navy, textColor: BRAND.white, fontStyle: 'bold', fontSize: 8.5, cellPadding: 4 },
    bodyStyles:         { fontSize: 8.5, textColor: BRAND.dark, cellPadding: 3.5 },
    alternateRowStyles: { fillColor: [241, 245, 249] },
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
    doc.text(formatCAD(value), rc, ty, { align: 'right' })
    ty += 7
  }

  addRow('Subtotal', invoice.subtotal || 0)
  if (invoice.discount_amount > 0) {
    const label = invoice.discount_type === 'percent'
      ? `Discount (${invoice.discount_value}%)`
      : 'Discount'
    addRow(label, -Math.abs(invoice.discount_amount || 0), [22, 163, 74])
  }
  if (invoice.gst_enabled) {
    const taxLabel = getProvinceTaxLabel(invoice.province)
    const taxRate  = getProvinceTaxRate(invoice.province)
    addRow(`${taxLabel} (${taxRate}%)`, invoice.gst_amount || 0)
  }

  doc.setDrawColor(...BRAND.lightBlue)
  doc.setLineWidth(0.5)
  doc.line(lc, ty - 2, rc, ty - 2)
  doc.setFillColor(...BRAND.navy)
  doc.roundedRect(totalsX, ty - 1, totalsW, 12, 2, 2, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...BRAND.white)
  doc.text('TOTAL DUE', lc, ty + 6.5)
  doc.text(formatCAD(invoice.total || 0), rc, ty + 6.5, { align: 'right' })
}

function _drawNotes(doc, invoice, margin, pageW) {
  if (!invoice.notes) return
  const totalsY = doc.lastAutoTable.finalY + 8
  const totalsX = pageW - margin - 70
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...BRAND.blue)
  doc.text('NOTES', margin, totalsY)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(...BRAND.gray)
  const lines = doc.splitTextToSize(invoice.notes, totalsX - margin - 10)
  doc.text(lines, margin, totalsY + 7)
}

function _drawFooter(doc, invoice, pageH, margin, pageW) {
  const footY    = pageH - 20
  const taxLabel = getProvinceTaxLabel(invoice.province)
  const taxRate  = getProvinceTaxRate(invoice.province)

  doc.setFillColor(...BRAND.navy)
  doc.rect(0, footY, pageW, 20, 'F')
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(180, 200, 240)
  doc.text('Thank you for choosing AI with Robert!', pageW / 2, footY + 5,  { align: 'center' })
  doc.text('5550 Lyndale, Cote Saint-Luc, Quebec  H4V 2L5', pageW / 2, footY + 10, { align: 'center' })
  doc.text('aiwithrobert.com  ·  invoices@aiwithrobert.com  ·  (514) 250-8491', pageW / 2, footY + 15, { align: 'center' })
  doc.setTextColor(150, 170, 210)
  doc.setFontSize(6.5)
  const taxNote = invoice.gst_enabled
    ? `${taxLabel} applied at ${taxRate}%`
    : 'GST/QST/HST not applicable at this time.'
  doc.text(taxNote, margin, footY + 10)
}

// ── Public export ─────────────────────────────────────────────────────────────

export async function generateInvoicePDF(invoice) {
  const doc      = createDoc()
  const pageW    = doc.internal.pageSize.getWidth()
  const margin   = 20
  const logoData = await fetchLogoFull()
  drawHeader(doc, pageW, margin, logoData)
  drawBody(doc, invoice, margin, pageW)
  const filename = `Invoice-${invoice.invoice_number}-${invoice.client_name?.replace(/\s+/g, '-')}.pdf`
  doc.save(filename)
}
