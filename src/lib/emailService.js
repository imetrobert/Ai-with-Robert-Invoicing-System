import emailjs from '@emailjs/browser'
import { formatCAD, formatDate, getProvinceTaxLabel, getProvinceTaxRate, utcToETDateStr } from './invoiceUtils'

const SERVICE_ID  = import.meta.env.VITE_EMAILJS_SERVICE_ID
const TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID
const PUBLIC_KEY  = import.meta.env.VITE_EMAILJS_PUBLIC_KEY

export async function sendInvoiceEmail(invoice) {
  const isPaid = invoice.status === 'paid'

  const taxLabel = getProvinceTaxLabel(invoice.province)
  const taxRate  = getProvinceTaxRate(invoice.province)

  const subtotal  = invoice.items?.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0) ?? 0
  const discount  = invoice.discount_amount ?? 0
  const taxable   = subtotal - discount
  const taxAmount = taxable * taxRate
  const total     = taxable + taxAmount

  const greeting = `Dear <strong>${invoice.client_name}</strong>,<br><br>
Thank you for placing your trust with the AI with Robert team.<br>
Please find below your invoice for <strong>${formatDate(utcToETDateStr(invoice.invoice_date))}</strong>.`

  const statusBanner = isPaid
    ? `<div style="margin:24px 0;padding:18px 24px;background:#dcfce7;border:2px solid #16a34a;border-radius:10px;text-align:center;">
        <span style="font-size:22px;font-weight:800;color:#16a34a;letter-spacing:1px;">✅ PAYMENT RECEIVED</span>
       </div>`
    : `<div style="margin:24px 0;padding:18px 24px;background:#fef9c3;border:2px solid #ca8a04;border-radius:10px;text-align:center;">
        <span style="font-size:22px;font-weight:800;color:#ca8a04;letter-spacing:1px;">⏳ AMOUNT PENDING: ${formatCAD(total)}</span>
       </div>`

  // ✅ FIXED: correct public invoice URL (was missing /#/invoice/public/ path)
  const publicUrl = `https://invoices.aiwithrobert.com/#/invoice/public/${invoice.view_token}`

  const itemRows = invoice.items?.map(item => `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;">${item.description}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;text-align:center;">${item.quantity}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;text-align:right;">${formatCAD(item.unit_price)}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;text-align:right;">${formatCAD(item.quantity * item.unit_price)}</td>
    </tr>`).join('') ?? ''

  const discountRow = discount > 0 ? `
    <tr>
      <td colspan="3" style="padding:8px 12px;text-align:right;color:#64748b;">Discount</td>
      <td style="padding:8px 12px;text-align:right;color:#dc2626;">-${formatCAD(discount)}</td>
    </tr>` : ''

  const html_body = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#1e293b 0%,#2563eb 100%);padding:32px 36px;text-align:center;">
            <div style="font-size:26px;font-weight:800;color:#ffffff;letter-spacing:1px;">AI with Robert</div>
            <div style="font-size:13px;color:#93c5fd;margin-top:4px;">invoices@aiwithrobert.com</div>
          </td>
        </tr>

        <!-- Greeting -->
        <tr>
          <td style="padding:32px 36px 8px;">
            <p style="margin:0;font-size:15px;color:#1e293b;line-height:1.7;">${greeting}</p>
            ${statusBanner}
          </td>
        </tr>

        <!-- Invoice Meta -->
        <tr>
          <td style="padding:0 36px 20px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="font-size:13px;color:#64748b;">Invoice #</td>
                <td style="font-size:13px;color:#1e293b;font-weight:600;text-align:right;">${invoice.invoice_number}</td>
              </tr>
              <tr>
                <td style="font-size:13px;color:#64748b;padding-top:4px;">Invoice Date</td>
                <td style="font-size:13px;color:#1e293b;text-align:right;padding-top:4px;">${formatDate(utcToETDateStr(invoice.invoice_date))}</td>
              </tr>
              ${invoice.due_date ? `<tr>
                <td style="font-size:13px;color:#64748b;padding-top:4px;">Due Date</td>
                <td style="font-size:13px;color:#1e293b;text-align:right;padding-top:4px;">${formatDate(utcToETDateStr(invoice.due_date))}</td>
              </tr>` : ''}
            </table>
          </td>
        </tr>

        <!-- Items Table -->
        <tr>
          <td style="padding:0 36px 24px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
              <thead>
                <tr style="background:#f8fafc;">
                  <th style="padding:10px 12px;text-align:left;font-size:12px;color:#64748b;font-weight:600;text-transform:uppercase;">Description</th>
                  <th style="padding:10px 12px;text-align:center;font-size:12px;color:#64748b;font-weight:600;text-transform:uppercase;">Qty</th>
                  <th style="padding:10px 12px;text-align:right;font-size:12px;color:#64748b;font-weight:600;text-transform:uppercase;">Price</th>
                  <th style="padding:10px 12px;text-align:right;font-size:12px;color:#64748b;font-weight:600;text-transform:uppercase;">Amount</th>
                </tr>
              </thead>
              <tbody>
                ${itemRows}
              </tbody>
              <tfoot>
                <tr>
                  <td colspan="3" style="padding:8px 12px;text-align:right;color:#64748b;font-size:13px;">Subtotal</td>
                  <td style="padding:8px 12px;text-align:right;font-size:13px;">${formatCAD(subtotal)}</td>
                </tr>
                ${discountRow}
                <tr>
                  <td colspan="3" style="padding:8px 12px;text-align:right;color:#64748b;font-size:13px;">${taxLabel} (${(taxRate * 100).toFixed(0)}%)</td>
                  <td style="padding:8px 12px;text-align:right;font-size:13px;">${formatCAD(taxAmount)}</td>
                </tr>
                <tr style="background:#f8fafc;">
                  <td colspan="3" style="padding:12px;text-align:right;font-weight:700;font-size:15px;color:#1e293b;">Total</td>
                  <td style="padding:12px;text-align:right;font-weight:700;font-size:15px;color:#2563eb;">${formatCAD(total)}</td>
                </tr>
              </tfoot>
            </table>
          </td>
        </tr>

        <!-- Notes -->
        ${invoice.notes ? `
        <tr>
          <td style="padding:0 36px 24px;">
            <div style="background:#f8fafc;border-left:3px solid #2563eb;border-radius:4px;padding:12px 16px;">
              <div style="font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;margin-bottom:4px;">Notes</div>
              <div style="font-size:13px;color:#1e293b;">${invoice.notes}</div>
            </div>
          </td>
        </tr>` : ''}

        <!-- PDF Download Link -->
        <tr>
          <td style="padding:0 36px 32px;text-align:center;">
            <p style="margin:0 0 16px;font-size:14px;color:#64748b;">
              You can also <a href="${publicUrl}" style="color:#2563eb;font-weight:600;text-decoration:underline;">download a PDF copy of your invoice</a>.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#1e293b;padding:24px 36px;text-align:center;">
            <div style="font-size:13px;color:#94a3b8;">AI with Robert · Côte Saint-Luc, QC · invoices@aiwithrobert.com</div>
            <div style="font-size:12px;color:#64748b;margin-top:6px;">© ${new Date().getFullYear()} AI with Robert. All rights reserved.</div>
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
    invoice_number: invoice.invoice_number,
    total:          formatCAD(total),
    html_body,
  }

  await emailjs.send(SERVICE_ID, TEMPLATE_ID, templateParams, PUBLIC_KEY)
}
