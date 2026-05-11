import emailjs from '@emailjs/browser'
import { formatCAD, formatDate, getProvinceTaxLabel, getProvinceTaxRate } from './invoiceUtils'

const SERVICE_ID  = import.meta.env.VITE_EMAILJS_SERVICE_ID
const TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID
const PUBLIC_KEY  = import.meta.env.VITE_EMAILJS_PUBLIC_KEY

export async function sendInvoiceEmail(invoice) {
  if (!SERVICE_ID || !TEMPLATE_ID || !PUBLIC_KEY) {
    throw new Error('EmailJS credentials not configured. Check your GitHub Secrets.')
  }
  if (!invoice.client_email) {
    throw new Error('No client email address on this invoice.')
  }

  const services = Array.isArray(invoice.services) ? invoice.services : []
  const taxLabel = getProvinceTaxLabel(invoice.province)
  const taxRate  = getProvinceTaxRate(invoice.province)

  // Build HTML rows for each service
  const serviceRows = services.map(s => {
    const isWorkshop = s.service_id === 'group-workshop'
    const qtyLabel = isWorkshop
      ? `${s.people || 1} people &times; ${s.quantity || 1} session(s)`
      : `${s.quantity || 1}`
    const amount = isWorkshop
      ? (s.people || 1) * (s.quantity || 1) * (s.rate || 0)
      : (s.quantity || 1) * (s.rate || 0)
    return `
      <tr>
        <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;font-weight:600;">${s.service_name || ''}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:13px;">${s.description || ''}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;text-align:center;">${qtyLabel}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;text-align:right;">${formatCAD(s.rate || 0)}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:700;">${formatCAD(amount)}</td>
      </tr>`
  }).join('')

  // Build totals rows
  let totalsRows = `
    <tr>
      <td colspan="4" style="padding:8px 14px;text-align:right;color:#64748b;">Subtotal</td>
      <td style="padding:8px 14px;text-align:right;font-weight:600;">${formatCAD(invoice.subtotal || 0)}</td>
    </tr>`

  if (invoice.discount_amount > 0) {
    const discLabel = invoice.discount_type === 'percent'
      ? `Discount (${invoice.discount_value}%)`
      : 'Discount'
    totalsRows += `
    <tr>
      <td colspan="4" style="padding:8px 14px;text-align:right;color:#15803d;">${discLabel}</td>
      <td style="padding:8px 14px;text-align:right;color:#15803d;font-weight:600;">-${formatCAD(invoice.discount_amount)}</td>
    </tr>`
  }

  if (invoice.gst_enabled) {
    totalsRows += `
    <tr>
      <td colspan="4" style="padding:8px 14px;text-align:right;color:#64748b;">${taxLabel} (${taxRate}%)</td>
      <td style="padding:8px 14px;text-align:right;font-weight:600;">${formatCAD(invoice.gst_amount || 0)}</td>
    </tr>`
  }

  totalsRows += `
    <tr style="background:#153457;">
      <td colspan="4" style="padding:12px 14px;text-align:right;color:white;font-weight:700;font-size:15px;">TOTAL DUE</td>
      <td style="padding:12px 14px;text-align:right;color:white;font-weight:700;font-size:15px;">${formatCAD(invoice.total || 0)}</td>
    </tr>`

  const notesSection = invoice.notes ? `
    <div style="margin-top:24px;padding:14px 16px;background:#f8fafc;border-left:3px solid #2563eb;border-radius:4px;">
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#2563eb;font-weight:700;margin-bottom:6px;">Notes</div>
      <p style="margin:0;color:#64748b;font-size:14px;">${invoice.notes}</p>
    </div>` : ''

  const taxFooter = invoice.gst_enabled
    ? `${taxLabel} applied at ${taxRate}%`
    : 'GST/QST/HST not applicable at this time.'


  const isPaid = invoice.status === 'paid'
  const serviceYear = invoice.service_date ? invoice.service_date.split('-')[0] : new Date().getFullYear()

  const statusBanner = isPaid
    ? `<div style="margin:0 0 24px;padding:20px 28px;background:#dcfce7;border-radius:8px;text-align:center;border:1px solid #86efac;">
        <div style="color:#15803d;font-size:26px;font-weight:800;letter-spacing:2px;">✓ PAYMENT RECEIVED</div>
        <div style="color:#166534;font-size:14px;margin-top:6px;">Thank you — this invoice has been settled.</div>
      </div>`
    : `<div style="margin:0 0 24px;padding:20px 28px;background:#fef9c3;border-radius:8px;text-align:center;border:1px solid #fde68a;">
        <div style="color:#92400e;font-size:22px;font-weight:800;letter-spacing:1px;">⏳ AMOUNT PENDING</div>
        <div style="color:#78350f;font-size:20px;font-weight:700;margin-top:8px;">${formatCAD(invoice.total || 0)}</div>
        <div style="color:#92400e;font-size:13px;margin-top:4px;">Please arrange payment at your earliest convenience.</div>
      </div>`

  const greeting = `
    <div style="padding:28px 28px 0;">
      <p style="margin:0 0 8px;font-size:16px;color:#0f172a;">Dear <strong>${invoice.client_name}</strong>,</p>
      <p style="margin:0 0 20px;font-size:15px;color:#334155;line-height:1.6;">
        Thank you for placing your trust with the <strong>AI with Robert</strong> team.
        Please find below your invoice for services rendered on <strong>${formatDate(invoice.service_date)}</strong>.
      </p>
      ${statusBanner}
    </div>`

  // Full HTML email — this IS the invoice, beautifully formatted
  const html_body = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 0;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:white;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.1);max-width:600px;width:100%;">

      <!-- Header -->
      <tr>
        <td style="background:linear-gradient(135deg,#153457 0%,#1e4a8a 100%);padding:24px 28px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td>
                <div style="color:white;font-size:20px;font-weight:700;margin-bottom:4px;">AI with Robert</div>
                <div style="color:rgba(200,220,255,0.9);font-size:12px;">AI &amp; Technology Training for Seniors</div>
                <div style="color:rgba(200,220,255,0.9);font-size:12px;">invoices@aiwithrobert.com &nbsp;&middot;&nbsp; 514-250-8491</div>
              </td>
              <td align="right">
                <div style="color:white;font-size:28px;font-weight:800;letter-spacing:2px;">INVOICE</div>
                <div style="color:rgba(200,220,255,0.8);font-size:13px;font-family:monospace;">${invoice.invoice_number}</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- Blue accent bar -->
      <tr><td style="background:#2563eb;height:3px;font-size:0;">&nbsp;</td></tr>

      <!-- Greeting -->
      <tr><td>${greeting}</td></tr>

      <!-- Bill To + Meta -->
      <tr>
        <td style="padding:24px 28px 16px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="vertical-align:top;">
                <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#2563eb;font-weight:700;margin-bottom:8px;">Bill To</div>
                <div style="font-size:18px;font-weight:700;color:#0f172a;margin-bottom:4px;">${invoice.client_name}</div>
                ${invoice.client_email ? `<div style="color:#64748b;font-size:13px;">${invoice.client_email}</div>` : ''}
                ${invoice.province ? `<div style="color:#64748b;font-size:13px;">${invoice.province}</div>` : ''}
              </td>
              <td style="vertical-align:top;text-align:right;">
                <table cellpadding="3" cellspacing="0" style="margin-left:auto;">
                  <tr>
                    <td style="font-size:11px;text-transform:uppercase;color:#64748b;padding-right:8px;">Date of Service</td>
                    <td style="font-size:13px;font-weight:600;color:#0f172a;">${formatDate(invoice.service_date)}</td>
                  </tr>
                  <tr>
                    <td style="font-size:11px;text-transform:uppercase;color:#64748b;padding-right:8px;">Date Issued</td>
                    <td style="font-size:13px;font-weight:600;color:#0f172a;">${formatDate(invoice.created_at?.split('T')[0] || new Date().toISOString().split('T')[0])}</td>
                  </tr>
                  <tr>
                    <td style="font-size:11px;text-transform:uppercase;color:#64748b;padding-right:8px;">Status</td>
                    <td style="font-size:13px;font-weight:600;color:#1d4ed8;">${(invoice.status || 'DRAFT').toUpperCase()}</td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- Services table -->
      <tr>
        <td style="padding:0 28px 8px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
            <thead>
              <tr style="background:#153457;">
                <th style="padding:10px 14px;text-align:left;color:white;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Service</th>
                <th style="padding:10px 14px;text-align:left;color:white;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Description</th>
                <th style="padding:10px 14px;text-align:center;color:white;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Qty</th>
                <th style="padding:10px 14px;text-align:right;color:white;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Rate</th>
                <th style="padding:10px 14px;text-align:right;color:white;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${serviceRows}
            </tbody>
            <tfoot>
              ${totalsRows}
            </tfoot>
          </table>
        </td>
      </tr>

      <!-- Notes -->
      ${notesSection ? `<tr><td style="padding:0 28px 8px;">${notesSection}</td></tr>` : ''}

      <!-- Footer -->
      <tr>
        <td style="background:#153457;padding:16px 28px;text-align:center;margin-top:8px;">
          <div style="color:rgba(180,200,240,0.9);font-size:12px;margin-bottom:4px;">Thank you for choosing AI with Robert!</div>
          <div style="color:rgba(255,255,255,0.85);font-size:11px;">aiwithrobert.com &nbsp;&middot;&nbsp; invoices@aiwithrobert.com &nbsp;&middot;&nbsp; 514-250-8491</div>
          <div style="color:rgba(255,255,255,0.65);font-size:10px;margin-top:4px;">${taxFooter}</div>
        </td>
      </tr>

    </table>
  </td></tr>
</table>
</body>
</html>`

  const templateParams = {
    to_email:       invoice.client_email,
    to_name:        invoice.client_name,
    from_name:      'AI with Robert',
    reply_to:       'invoices@aiwithrobert.com',
    invoice_number: invoice.invoice_number,
    total:          formatCAD(invoice.total || 0),
    html_body,     // The full HTML invoice — your EmailJS template must render this
  }

  // Check payload size — EmailJS free tier limit is 50KB
  const payloadSize = new TextEncoder().encode(JSON.stringify(templateParams)).length / 1024
  if (payloadSize > 49) {
    throw new Error(`Email payload is ${payloadSize.toFixed(1)}KB which exceeds EmailJS free tier 50KB limit. Upgrade to Personal plan ($9/mo) for larger emails.`)
  }

  return emailjs.send(SERVICE_ID, TEMPLATE_ID, templateParams, PUBLIC_KEY)
}
