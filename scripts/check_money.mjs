// Checks the money rules without installing anything: GST/QST/HST rates, discounts and invoice numbers.
// Run:  node scripts/check_money.mjs      (prints OK or the exact failing case; exit code 1 on failure)
import { readFileSync } from 'node:fs'
const src = readFileSync(new URL('../src/lib/invoiceUtils.js', import.meta.url), 'utf8')
  .replace(/^import .*$/m, 'const brandOf = b => ({ numberPrefix: b === "business" ? "AWR-B-" : "AWR-" }); const DEFAULT_BRAND = "seniors";')
  .replace(/^export /gm, '')
const u = new Function(src + '\nreturn { calculateTotals, getProvinceTaxRate, generateInvoiceNumber }')()
const bad = []
const eq = (name, got, want) => { if (JSON.stringify(got) !== JSON.stringify(want)) bad.push(`${name}: got ${JSON.stringify(got)}, expected ${JSON.stringify(want)}`) }
const one = (rate, q = 1) => [{ quantity: q, rate }]

eq('QC rate', u.getProvinceTaxRate('QC'), 14.975)
eq('ON rate', u.getProvinceTaxRate('ON'), 13)
eq('AB rate', u.getProvinceTaxRate('AB'), 5)
eq('NS rate', u.getProvinceTaxRate('NS'), 15)
// $2,000 workflow in Quebec: GST 100.00 + QST 199.50 = 299.50
eq('QC $2000', u.calculateTotals(one(2000), 'none', 0, true, 'QC'), { subtotal: 2000, discountAmount: 0, afterDiscount: 2000, gstAmount: 299.5, total: 2299.5 })
// 10% discount comes off before tax
eq('QC $900 -10%', u.calculateTotals(one(900), 'percent', 10, true, 'QC'), { subtotal: 900, discountAmount: 90, afterDiscount: 810, gstAmount: 121.3, total: 931.3 })
eq('no tax', u.calculateTotals(one(60, 2), 'none', 0, false, 'QC').total, 120)
eq('fixed discount floor', u.calculateTotals(one(50), 'fixed', 80, false, 'QC').total, 0)
// invoice numbers: separate sequences per brand
const d = new Date(), ym = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`
eq('seniors number', u.generateInvoiceNumber([], 'seniors'), `AWR-${ym}-001`)
eq('business number', u.generateInvoiceNumber([`AWR-B-${ym}-001`], 'business'), `AWR-B-${ym}-002`)
eq('brands do not mix', u.generateInvoiceNumber([`AWR-B-${ym}-005`], 'seniors'), `AWR-${ym}-001`)

if (bad.length) { console.log('PROBLEMS:\n - ' + bad.join('\n - ')); process.exit(1) }
console.log('OK: tax rates, discounts and invoice numbers behave as expected')
