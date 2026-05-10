import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { formatCAD, formatDate } from './invoiceUtils'

const BRAND = {
  navy: [21, 52, 95],       // #153457
  blue: [37, 99, 235],      // #2563eb
  lightBlue: [219, 234, 254], // #dbeafe
  gray: [100, 116, 139],    // #64748b
  lightGray: [248, 250, 252], // #f8fafc
  dark: [15, 23, 42],       // #0f172a
  white: [255, 255, 255],
}

export async function generateInvoicePDF(invoice) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const margin = 20

  // ── Background ──────────────────────────────────────────────────────
  doc.setFillColor(...BRAND.lightGray)
  doc.rect(0, 0, pageW, pageH, 'F')

  // ── Header band ─────────────────────────────────────────────────────
  doc.setFillColor(...BRAND.navy)
  doc.rect(0, 0, pageW, 44, 'F')

  // Accent stripe
  doc.setFillColor(...BRAND.blue)
  doc.rect(0, 44, pageW, 3, 'F')

  // Logo (fetch & embed)
  try {
    const imgData = await fetchImageAsBase64('https://aiwithrobert.com/logo.PNG')
    if (imgData) {
      doc.addImage(imgData, 'PNG', margin, 8, 28, 28, undefined, 'FAST')
    }
  } catch (_) { /* skip logo if fetch fails */ }

  // Company name in header
  doc.setTextColor(...BRAND.white)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.text('AI with Robert', margin + 32, 22)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(200, 220, 255)
  doc.text('AI & Technology Training for Seniors', margin + 32, 28)
  doc.text('Côte Saint-Luc, Quebec', margin + 32, 33)
  doc.text('info@aiwithrobert.com  ·  514-250-8491  ·  aiwithrobert.com', margin + 32, 38)

  // INVOICE label
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(26)
  doc.setTextColor(...BRAND.white)
  doc.text('INVOICE', pageW - margin, 26, { align: 'right' })

  // ── Invoice meta block ───────────────────────────────────────────────
  const metaY = 56
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.setTextColor(...BRAND.gray)

  const metaLeft = pageW - margin - 80
  const col1 = metaLeft
  const col2 = metaLeft + 36

  const metaRows = [
    ['Invoice #', invoice.invoice_number],
    ['Date Issued', formatDate(invoice.created_at?.split('T')[0] || new Date().toISOString().split('T')[0])],
    ['Date of Service', formatDate(invoice.service_date)],
    ['Status', invoice.status?.toUpperCase() || 'DRAFT'],
  ]

  metaRows.forEach(([label, value], i) => {
    const y = metaY + i * 7
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...BRAND.gray)
    doc.text(label, col1, y)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...BRAND.dark)
    doc.text(value || '', col2, y)
  })

  // ── Bill To ──────────────────────────────────────────────────────────
  const billY = 56
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
  doc.text(invoice.client_name || '', margin, billY + 9)

  if (invoice.client_email) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...BRAND.gray)
    doc.text(invoice.client_email, margin, billY + 16)
  }

  // ── Line items table ─────────────────────────────────────────────────
  const tableStartY = 88
  const services = Array.isArray(invoice.services) ? invoice.services : []

  autoTable(doc, {
    startY: tableStartY,
    margin: { left: margin, right: margin },
    head: [['Service', 'Description', 'Qty', 'Rate', 'Amount']],
    body: services.map(item => [
      item.service_name || '',
      item.description || '',
      item.quantity || 1,
      formatCAD(item.rate || 0),
      formatCAD((item.quantity || 1) * (item.rate || 0)),
    ]),
    headStyles: {
      fillColor: BRAND.navy,
      textColor: BRAND.white,
      fontStyle: 'bold',
      fontSize: 8.5,
      cellPadding: 4,
    },
    bodyStyles: {
      fontSize: 8.5,
      textColor: BRAND.dark,
      cellPadding: 3.5,
    },
    alternateRowStyles: {
      fillColor: [241, 245, 249],
    },
    columnStyles: {
      0: { cellWidth: 42, fontStyle: 'bold' },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 14, halign: 'center' },
      3: { cellWidth: 24, halign: 'right' },
      4: { cellWidth: 28, halign: 'right', fontStyle: 'bold' },
    },
    styles: { overflow: 'linebreak', lineColor: [226, 232, 240], lineWidth: 0.3 },
    didParseCell: (data) => {
      if (data.row.section === 'head') {
        data.cell.styles.fillColor = BRAND.navy
      }
    },
  })

  // ── Totals block ─────────────────────────────────────────────────────
  const totalsY = doc.lastAutoTable.finalY + 8
  const totalsX = pageW - margin - 70
  const totalsW = 70

  // Totals background
  doc.setFillColor(...BRAND.white)
  doc.roundedRect(totalsX, totalsY, totalsW, invoice.discount_amount > 0 ? (invoice.gst_enabled ? 46 : 38) : (invoice.gst_enabled ? 38 : 30), 3, 3, 'F')

  let ty = totalsY + 9
  const leftCol = totalsX + 5
  const rightCol = totalsX + totalsW - 5

  const addTotalsRow = (label, value, bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.setFontSize(9)
    doc.setTextColor(bold ? ...BRAND.dark : ...BRAND.gray)
    doc.text(label, leftCol, ty)
    doc.text(formatCAD(value), rightCol, ty, { align: 'right' })
    ty += 7
  }

  addTotalsRow('Subtotal', invoice.subtotal || 0)

  if (invoice.discount_amount > 0) {
    const label = invoice.discount_type === 'percent'
      ? `Discount (${invoice.discount_value}%)`
      : 'Discount'
    doc.setTextColor(22, 163, 74) // green
    addTotalsRow(label, -Math.abs(invoice.discount_amount || 0))
  }

  if (invoice.gst_enabled) {
    addTotalsRow('GST (5%)', invoice.gst_amount || 0)
  }

  // Divider
  doc.setDrawColor(...BRAND.lightBlue)
  doc.setLineWidth(0.5)
  doc.line(leftCol, ty - 2, rightCol, ty - 2)

  // Total
  doc.setFillColor(...BRAND.navy)
  doc.roundedRect(totalsX, ty - 1, totalsW, 12, 2, 2, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...BRAND.white)
  doc.text('TOTAL DUE', leftCol, ty + 6.5)
  doc.text(formatCAD(invoice.total || 0), rightCol, ty + 6.5, { align: 'right' })

  // ── Notes ────────────────────────────────────────────────────────────
  if (invoice.notes) {
    const notesY = totalsY
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(...BRAND.blue)
    doc.text('NOTES', margin, notesY)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(...BRAND.gray)
    const lines = doc.splitTextToSize(invoice.notes, totalsX - margin - 10)
    doc.text(lines, margin, notesY + 7)
  }

  // ── Footer ───────────────────────────────────────────────────────────
  const footY = pageH - 16
  doc.setFillColor(...BRAND.navy)
  doc.rect(0, footY, pageW, 16, 'F')

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(180, 200, 240)
  doc.text('Thank you for choosing AI with Robert!', pageW / 2, footY + 6, { align: 'center' })
  doc.text('aiwithrobert.com  ·  info@aiwithrobert.com  ·  514-250-8491', pageW / 2, footY + 11.5, { align: 'center' })

  // GST note
  doc.setTextColor(150, 170, 210)
  doc.setFontSize(6.5)
  doc.text('GST/HST not applicable at this time.', margin, footY + 6)

  // ── Save ─────────────────────────────────────────────────────────────
  const filename = `Invoice-${invoice.invoice_number}-${invoice.client_name?.replace(/\s+/g, '-')}.pdf`
  doc.save(filename)
}

async function fetchImageAsBase64(url) {
  const res = await fetch(url)
  const blob = await res.blob()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}
