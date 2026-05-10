import emailjs from '@emailjs/browser'
import { formatCAD, formatDate } from './invoiceUtils'

const SERVICE_ID  = import.meta.env.VITE_EMAILJS_SERVICE_ID
const TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID
const PUBLIC_KEY  = import.meta.env.VITE_EMAILJS_PUBLIC_KEY

export async function sendInvoiceEmail(invoice, pdfBase64) {
  if (!SERVICE_ID || !TEMPLATE_ID || !PUBLIC_KEY) {
    throw new Error('EmailJS credentials not configured. Add VITE_EMAILJS_SERVICE_ID, VITE_EMAILJS_TEMPLATE_ID, and VITE_EMAILJS_PUBLIC_KEY to your GitHub Secrets.')
  }
  if (!invoice.client_email) {
    throw new Error('This invoice has no client email address. Add one to send by email.')
  }

  const services = Array.isArray(invoice.services) ? invoice.services : []
  const servicesList = services.map(s => {
    const qty = s.people ? `${s.people} people × ${s.quantity} session(s)` : `${s.quantity}`
    return `${s.service_name} — ${qty} @ ${formatCAD(s.rate)} = ${formatCAD((s.people || 1) * (s.quantity || 1) * (s.rate || 0))}`
  }).join('\n')

  const templateParams = {
    to_email:       invoice.client_email,
    to_name:        invoice.client_name,
    from_name:      'AI with Robert',
    reply_to:       'invoices@aiwithrobert.com',
    invoice_number: invoice.invoice_number,
    service_date:   formatDate(invoice.service_date),
    services_list:  servicesList,
    subtotal:       formatCAD(invoice.subtotal || 0),
    discount:       invoice.discount_amount > 0 ? formatCAD(invoice.discount_amount) : 'None',
    gst:            invoice.gst_enabled ? formatCAD(invoice.gst_amount || 0) : 'Not applicable',
    total:          formatCAD(invoice.total || 0),
    // PDF as base64 attachment — strip the data URI prefix
    pdf_content:    pdfBase64.split('base64,')[1] || '',
    pdf_name:       `Invoice-${invoice.invoice_number}-${invoice.client_name?.replace(/\s+/g, '-')}.pdf`,
  }

  return emailjs.send(SERVICE_ID, TEMPLATE_ID, templateParams, PUBLIC_KEY)
}
