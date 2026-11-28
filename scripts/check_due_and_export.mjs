// Checks due dates / overdue and the accountant CSV. Run: node scripts/check_due_and_export.mjs
import { readFileSync } from 'node:fs'
const load = f => readFileSync(new URL('../src/lib/' + f, import.meta.url), 'utf8')
const utilsSrc = load('invoiceUtils.js')
  .replace(/^import .*$/m, 'const brandOf = b => ({ numberPrefix: b === "business" ? "AWR-B-" : "AWR-" }); const DEFAULT_BRAND = "seniors";')
  .replace(/^export /gm, '')
const u = new Function(utilsSrc + '\nreturn { addDays, daysOverdue, isOverdue, getTaxBreakdown, round2 }')()
const { addDays, daysOverdue, isOverdue, getTaxBreakdown } = u
const exportSrc = load('accountantExport.js').replace(/^import .*$/m, 'const { getTaxBreakdown, round2 } = __u;').replace(/^export /gm, '')
const { inPeriod, summarizeByBrand, buildAccountantCsv } = new Function('__u', exportSrc + '\nreturn { inPeriod, summarizeByBrand, buildAccountantCsv }')(u)
const tnSrc = load('taxNumbers.js').replace(/^export /gm, '')
const tn = new Function(tnSrc + '\nreturn { TAX_NUMBERS, taxNumberLines, taxNumberText, taxNumbersProblem }')()
const bad = []
const eq = (name, got, want) => { if (JSON.stringify(got) !== JSON.stringify(want)) bad.push(`${name}: got ${JSON.stringify(got)}, expected ${JSON.stringify(want)}`) }

eq('addDays +15', addDays('2026-11-27', 15), '2026-12-12')
eq('addDays over year end', addDays('2026-12-25', 10), '2027-01-04')
eq('addDays leap day', addDays('2028-02-28', 1), '2028-02-29')
const sent = { status: 'sent', due_date: '2026-11-20' }
eq('overdue days', daysOverdue(sent, '2026-11-27'), 7)
eq('due today is not overdue', daysOverdue(sent, '2026-11-20'), 0)
eq('before due is not overdue', daysOverdue(sent, '2026-11-19'), 0)
eq('paid is never overdue', isOverdue({ ...sent, status: 'paid' }, '2026-12-31'), false)
eq('draft is never overdue', isOverdue({ ...sent, status: 'draft' }, '2026-12-31'), false)
eq('no due date is never overdue', isOverdue({ status: 'sent', due_date: null }, '2026-12-31'), false)

eq('year filter', inPeriod('2026-03-10', 2026, 'all'), true)
eq('wrong year', inPeriod('2025-03-10', 2026, 'all'), false)
eq('Q1 holds March', inPeriod('2026-03-31', 2026, 'Q1'), true)
eq('Q1 excludes April', inPeriod('2026-04-01', 2026, 'Q1'), false)
eq('Q4 holds December', inPeriod('2026-12-31', 2026, 'Q4'), true)

const qc  = { invoice_number: 'AWR-B-202611-001', brand: 'business', client_name: 'Dupont, Marie', client_company: 'Dupont "Dental"', service_date: '2026-11-10', status: 'paid', province: 'QC', gst_enabled: true, subtotal: 2000, discount_amount: 0, gst_amount: 299.5, total: 2299.5 }
const sen = { invoice_number: 'AWR-202611-001', brand: 'seniors', client_name: 'Ann', service_date: '2026-11-02', status: 'paid', province: 'QC', gst_enabled: false, subtotal: 120, discount_amount: 0, gst_amount: 0, total: 120 }
const old = { invoice_number: 'AWR-202501-001', client_name: 'Old', service_date: '2026-01-02', status: 'paid', province: '', gst_enabled: false, subtotal: 60, discount_amount: 0, gst_amount: 0, total: 60 }
const b = getTaxBreakdown(qc)
eq('QC split', [b.gstToCRA, b.qstToRevQC], [100, 199.5])
const s = summarizeByBrand([qc, sen, old])
eq('business totals', [s.business.count, s.business.taxable, s.business.gst, s.business.qst, s.business.total], [1, 2000, 100, 199.5, 2299.5])
eq('rows without brand count as seniors', [s.seniors.count, s.seniors.total], [2, 180])
const csv = buildAccountantCsv([qc, sen, old], { year: 2026, period: 'all', includeLabel: 'Paid only' })
const lines = csv.trim().split('\r\n')
eq('csv has summary + details', lines.length, 1 + 1 + 1 + 1 + 2 + 1 + 1 + 1 + 3)
eq('csv quotes commas and quotes', csv.includes('"Dupont, Marie","Dupont ""Dental"""'), true)
eq('csv both-brand line', lines.find(l => l.startsWith('Both brands')), 'Both brands,3,2180.00,100.00,0.00,199.50,2479.50')
eq('csv detail sorted by date', lines.slice(-3).map(l => l.split(',')[0]), ['AWR-202501-001', 'AWR-202611-001', 'AWR-B-202611-001'])
eq('tax numbers: none printed when blank', tn.taxNumberLines('en', { gst: '', qst: '' }), [])
eq('tax numbers: EN line', tn.taxNumberText('en', { gst: '123456789 RT0001', qst: '1234567890 TQ0001' }), 'GST/HST no. 123456789 RT0001  |  QST no. 1234567890 TQ0001')
eq('tax numbers: FR label, one number', tn.taxNumberText('fr', { gst: '123456789 RT0001', qst: '' }), 'N° TPS/TVH 123456789 RT0001')
eq('tax numbers: good format passes', tn.taxNumbersProblem({ gst: '123456789 RT0001', qst: '1234567890 TQ0001' }), '')
eq('tax numbers: bad gst caught', tn.taxNumbersProblem({ gst: '12345', qst: '' }) !== '', true)
eq('tax numbers: the saved config is valid', tn.taxNumbersProblem(tn.TAX_NUMBERS), '')
if (bad.length) { console.error('FAIL: due dates / accountant export'); bad.forEach(x => console.error(' - ' + x)); process.exit(1) }
console.log('OK: due dates, overdue and accountant export.')
