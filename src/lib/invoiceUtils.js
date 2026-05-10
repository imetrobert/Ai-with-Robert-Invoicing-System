// Generate invoice number: AWR-YYYYMM-XXX
export function generateInvoiceNumber(existingNumbers = []) {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const prefix = `AWR-${year}${month}-`

  const existing = existingNumbers
    .filter(n => n && n.startsWith(prefix))
    .map(n => parseInt(n.replace(prefix, '')) || 0)

  const next = existing.length > 0 ? Math.max(...existing) + 1 : 1
  return `${prefix}${String(next).padStart(3, '0')}`
}

// Calculate invoice totals — handles group workshop (people × sessions × rate)
export function calculateTotals(lineItems, discountType, discountValue, gstEnabled) {
  const subtotal = lineItems.reduce((sum, item) => {
    const people = item.service_id === 'group-workshop' ? (parseFloat(item.people) || 1) : 1
    return sum + (people * parseFloat(item.quantity || 1) * parseFloat(item.rate || 0))
  }, 0)

  let discountAmount = 0
  if (discountType === 'percent') {
    discountAmount = subtotal * (parseFloat(discountValue || 0) / 100)
  } else if (discountType === 'fixed') {
    discountAmount = parseFloat(discountValue || 0)
  }

  const afterDiscount = Math.max(0, subtotal - discountAmount)
  const gstAmount = gstEnabled ? afterDiscount * 0.05 : 0
  const total = afterDiscount + gstAmount

  return {
    subtotal: round2(subtotal),
    discountAmount: round2(discountAmount),
    afterDiscount: round2(afterDiscount),
    gstAmount: round2(gstAmount),
    total: round2(total),
  }
}

export function round2(n) {
  return Math.round(n * 100) / 100
}

export function formatCAD(amount) {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    minimumFractionDigits: 2,
  }).format(amount)
}

export function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric' })
}

export function formatDateShort(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-CA')
}

export const STATUS_COLORS = {
  draft: { bg: '#f1f5f9', text: '#64748b', label: 'Draft' },
  sent: { bg: '#dbeafe', text: '#1d4ed8', label: 'Sent' },
  paid: { bg: '#dcfce7', text: '#15803d', label: 'Paid' },
}
