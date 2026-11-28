import { brandOf, DEFAULT_BRAND } from './brands'

// Generate invoice number. Each brand has its own sequence and prefix:
//   seniors  -> AWR-YYYYMM-001
//   business -> AWR-B-YYYYMM-001
// The prefix always ends with "-YYYYMM-", so the seniors prefix can never match
// a business number (the "B-" sits before the date) and vice versa.
export function generateInvoiceNumber(existingNumbers = [], brand = DEFAULT_BRAND) {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const prefix = `${brandOf(brand).numberPrefix}${year}${month}-`
  const existing = existingNumbers
    .filter(n => n && n.startsWith(prefix))
    .map(n => parseInt(n.replace(prefix, '')) || 0)
  const next = existing.length > 0 ? Math.max(...existing) + 1 : 1
  return `${prefix}${String(next).padStart(3, '0')}`
}

// ── Timezone-aware date helpers ───────────────────────────────────────────────

const ET_LOCALE = 'en-CA'
const ET_TZ     = 'America/Toronto'   // covers both EST and EDT automatically

/**
 * Convert a UTC ISO timestamp (e.g. Supabase created_at / emailed_at) to an
 * Eastern date string in YYYY-MM-DD format so it never rolls back a day.
 */
export function utcToETDateStr(isoString) {
  if (!isoString) return ''
  return new Date(isoString).toLocaleDateString('en-CA', {
    timeZone: ET_TZ,
    year: 'numeric', month: '2-digit', day: '2-digit',
  })
}

/**
 * Format a plain YYYY-MM-DD date string for display (no timezone shift).
 * Uses noon to avoid any UTC-boundary edge cases.
 */
export function formatDate(dateStr, lang = 'en') {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString(lang === 'fr' ? 'fr-CA' : ET_LOCALE, { year: 'numeric', month: 'long', day: 'numeric' })
}

export function formatDateShort(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString(ET_LOCALE)
}

// Calculate invoice totals — handles group workshop (people x sessions x rate)
// Accepts 'fixed' OR 'amount' for fixed discount (Gemini changed the value to 'amount')
export function calculateTotals(lineItems, discountType, discountValue, gstEnabled, province) {
  const subtotal = lineItems.reduce((sum, item) => {
    const people = item.service_id === 'group-workshop' ? (parseFloat(item.people) || 1) : 1
    return sum + (people * parseFloat(item.quantity || 1) * parseFloat(item.rate || 0))
  }, 0)

  let discountAmount = 0
  if (discountType === 'percent') {
    discountAmount = subtotal * (parseFloat(discountValue || 0) / 100)
  } else if (discountType === 'fixed' || discountType === 'amount') {
    discountAmount = parseFloat(discountValue || 0)
  }

  const afterDiscount = Math.max(0, subtotal - discountAmount)
  const taxRate = gstEnabled ? getProvinceTaxRate(province) / 100 : 0
  const gstAmount = afterDiscount * taxRate
  const total = afterDiscount + gstAmount

  return {
    subtotal:       round2(subtotal),
    discountAmount: round2(discountAmount),
    afterDiscount:  round2(afterDiscount),
    gstAmount:      round2(gstAmount),
    total:          round2(total),
  }
}

export function getProvinceTaxRate(province) {
  const p = (province || '').toUpperCase()
  if (p === 'ON') return 13
  if (['NB', 'NS', 'NL', 'PE'].includes(p)) return 15
  if (p === 'QC') return 14.975
  return 5
}

export function getProvinceTaxLabel(province, lang = 'en') {
  const fr = lang === 'fr'
  const p = (province || '').toUpperCase()
  if (['ON', 'NB', 'NS', 'NL', 'PE'].includes(p)) return fr ? 'TVH' : 'HST'
  if (p === 'QC') return fr ? 'TPS + TVQ' : 'GST + QST'
  return fr ? 'TPS' : 'GST'
}

export function round2(n) {
  return Math.round(n * 100) / 100
}

export function formatCAD(amount, lang = 'en') {
  return new Intl.NumberFormat(lang === 'fr' ? 'fr-CA' : 'en-CA', {
    style: 'currency',
    currency: 'CAD',
    minimumFractionDigits: 2,
  }).format(amount)
}

// ── Payment terms and overdue ────────────────────────────────────────────────
// due_date is a plain date (YYYY-MM-DD). An invoice is overdue when it has been
// SENT, has a due date, and that date is before today (Eastern Time).
export const PAYMENT_TERMS = [
  { id: 'receipt', label: 'Due on receipt', days: 0 },
  { id: 'net7',    label: 'Net 7',          days: 7 },
  { id: 'net15',   label: 'Net 15',         days: 15 },
  { id: 'net30',   label: 'Net 30',         days: 30 },
]
export const DEFAULT_TERMS_DAYS = 15

export function todayET() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Toronto' })
}

export function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}

export function daysOverdue(inv, today = todayET()) {
  if (!inv || !inv.due_date || inv.status !== 'sent') return 0
  const diff = Math.round((Date.parse(today) - Date.parse(inv.due_date)) / 86400000)
  return diff > 0 ? diff : 0
}

export const isOverdue = (inv, today) => daysOverdue(inv, today) > 0

export const STATUS_COLORS = {
  draft: { bg: '#f1f5f9', text: '#64748b', label: 'Draft' },
  sent:  { bg: '#dbeafe', text: '#1d4ed8', label: 'Sent' },
  paid:  { bg: '#dcfce7', text: '#15803d', label: 'Paid' },
}

export const CANADIAN_PROVINCES = [
  { code: '', label: '-- Select Province --' },
  { code: 'AB', label: 'Alberta (GST 5%)' },
  { code: 'BC', label: 'British Columbia (GST 5%)' },
  { code: 'MB', label: 'Manitoba (GST 5%)' },
  { code: 'NB', label: 'New Brunswick (HST 15%)' },
  { code: 'NL', label: 'Newfoundland (HST 15%)' },
  { code: 'NS', label: 'Nova Scotia (HST 15%)' },
  { code: 'ON', label: 'Ontario (HST 13%)' },
  { code: 'PE', label: 'Prince Edward Island (HST 15%)' },
  { code: 'QC', label: 'Quebec (GST+QST 14.975%)' },
  { code: 'SK', label: 'Saskatchewan (GST 5%)' },
]

// ── Tax breakdown per invoice (used by Tax Summary and the accountant export) ──
const GST_RATE = 0.05
const QST_RATE = 0.09975
const HST_PROVINCES = ['ON', 'NB', 'NS', 'NL', 'PE']

export function getTaxBreakdown(invoice) {
  const province = (invoice.province || '').toUpperCase()
  const taxable  = round2((invoice.subtotal || 0) - (invoice.discount_amount || 0))
  const taxCollected = invoice.gst_amount || 0

  if (!invoice.gst_enabled || taxCollected === 0) {
    return { taxable, gstToCRA: 0, hstToCRA: 0, qstToRevQC: 0, province }
  }
  if (province === 'QC') {
    return { taxable, gstToCRA: round2(taxable * GST_RATE), hstToCRA: 0, qstToRevQC: round2(taxable * QST_RATE), province }
  }
  if (HST_PROVINCES.includes(province)) {
    return { taxable, gstToCRA: 0, hstToCRA: taxCollected, qstToRevQC: 0, province }
  }
  // GST-only provinces (AB, BC, MB, SK, etc.)
  return { taxable, gstToCRA: taxCollected, hstToCRA: 0, qstToRevQC: 0, province }
}
