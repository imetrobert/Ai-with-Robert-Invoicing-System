import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { formatCAD, formatDate } from './invoiceUtils'

const BRAND = {
  navy:      [21, 52, 95],
  blue:      [37, 99, 235],
  lightBlue: [219, 234, 254],
  gray:      [100, 116, 139],
  lightGray: [248, 250, 252],
  dark:      [15, 23, 42],
  white:     [255, 255, 255],
}

async function buildPDF(invoice) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const margin = 20

  doc.setFillColor(...BRAND.lightGray)
  doc.rect(0, 0, pageW, pageH, 'F')
  doc.setFillColor(...BRAND.navy)
  doc.rect(0, 0, pageW, 44, 'F')
  doc.setFillColor(...BRAND.blue)
  doc.rect(0, 44, pageW, 3, 'F')

  try {
    const imgData = await fetchImageAsBase64('https://aiwithrobert.com/logo.PNG')
    if (imgData) doc.addImage(imgData, 'PNG', margin, 8, 28, 28, undefined, 'FAST')
  } catch (_) {}

  doc.setTextColor(...BRAND.white)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.text('AI with Robert', margin + 32, 22)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(200, 220, 255)
  doc.text('AI & Technology Training for Seniors', margin + 32, 28)
  doc.text('Cote Saint-Luc, Quebec', margin + 32, 33)
  doc.text('invoices@aiwithrobert.com  .  514-250-8491  .  aiwithrobert.com', margin + 32, 38)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(26)
  doc.setTextColor(...BRAND.white)
  doc.text('INVOICE', pageW - margin, 26, { align: 'right' })

  const metaY = 56
  const col1 = pageW - margin - 80
  const col2 = col1 + 36
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

  const services = Array.isArray(invoice.services) ? invoice.services : []
  autoTable(doc, {
    startY: 88,
    margin: { left: margin, right: margin },
    head: [['Service', 'Description', 'Qty / People', 'Rate', 'Amount']],
    body: services.map(item => {
      const isWorkshop = item.service_id === 'group-workshop'
      const qtyLabel = isWorkshop
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
    const label = invoice.discount_type === 'percent' ? `Discount (${invoice.discount_value}%)` : 'Discount'
    addRow(label, -Math.abs(invoice.discount_amount || 0), [22, 163, 74])
  }
  if (invoice.gst_enabled) addRow('GST (5%)', invoice.gst_amount || 0)

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

  if (invoice.notes) {
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

  const footY = pageH - 16
  doc.setFillColor(...BRAND.navy)
  doc.rect(0, footY, pageW, 16, 'F')
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(180, 200, 240)
  doc.text('Thank you for choosing AI with Robert!', pageW / 2, footY + 6, { align: 'center' })
  doc.text('aiwithrobert.com  .  invoices@aiwithrobert.com  .  514-250-8491', pageW / 2, footY + 11.5, { align: 'center' })
  doc.setTextColor(150, 170, 210)
  doc.setFontSize(6.5)
  doc.text('GST/HST not applicable at this time.', margin, footY + 6)

  return doc
}

export async function generateInvoicePDF(invoice) {
  const doc = await buildPDF(invoice)
  const filename = `Invoice-${invoice.invoice_number}-${invoice.client_name?.replace(/\s+/g, '-')}.pdf`
  doc.save(filename)
}

export async function generateInvoicePDFBase64(invoice) {
  const doc = await buildPDF(invoice)
  return doc.output('datauristring')
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
