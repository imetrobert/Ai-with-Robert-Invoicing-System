import { supabase } from './supabase'

// Records one row per email sent in public.email_send_log so the dashboard's
// EmailJS quota stays accurate even if the invoice is later deleted.
// Never throws: a logging problem must not make a sent email look failed.
export async function logEmailSend(invoice) {
  try {
    const { error } = await supabase.from('email_send_log').insert({
      invoice_number: invoice.invoice_number || null,
      brand: invoice.brand || null,
      recipient: invoice.client_email || null,
    })
    if (error) console.warn('email_send_log insert failed:', error.message)
  } catch (e) {
    console.warn('email_send_log insert failed:', e)
  }
}
