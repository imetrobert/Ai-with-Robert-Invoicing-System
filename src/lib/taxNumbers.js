// GST/HST and QST registration numbers of the AIWithRobert master corp (both brands bill under it).
// THE ONLY PLACE TO TYPE THEM. Leave a value empty ('') and nothing is printed anywhere.
// Once filled they appear automatically: PDF footer, client invoice page, invoice email footer.
//   gst: Canada Revenue Agency number, 9 digits + "RT0001"   e.g. '123456789 RT0001'
//   qst: Revenu Quebec number, 10 digits + "TQ0001"           e.g. '1234567890 TQ0001'
// After editing: run `node scripts/check_due_and_export.mjs` (it checks the format) and see docs/common-edits.md "Add the GST/QST numbers".
export const TAX_NUMBERS = {
  gst: '',
  qst: '',
}

const LABELS = {
  en: { gst: 'GST/HST no.', qst: 'QST no.' },
  fr: { gst: 'N° TPS/TVH', qst: 'N° TVQ' },
}

// Returns [{ label, value }] for the numbers that are filled in; [] when none are.
export function taxNumberLines(lang = 'en', nums = TAX_NUMBERS) {
  const L = LABELS[lang === 'fr' ? 'fr' : 'en']
  return ['gst', 'qst'].filter(k => String(nums[k] || '').trim()).map(k => ({ label: L[k], value: String(nums[k]).trim() }))
}

// One line of text, e.g. "GST/HST no. 123456789 RT0001  |  QST no. 1234567890 TQ0001"; '' when none are filled in.
export function taxNumberText(lang = 'en', nums = TAX_NUMBERS) {
  return taxNumberLines(lang, nums).map(x => `${x.label} ${x.value}`).join('  |  ')
}

// Format check used by scripts/check_due_and_export.mjs. Empty is allowed (not registered yet).
export function taxNumbersProblem(nums = TAX_NUMBERS) {
  if (nums.gst && !/^\d{9}\s?RT\s?\d{4}$/i.test(nums.gst.trim())) return 'gst must look like 123456789 RT0001'
  if (nums.qst && !/^\d{10}\s?TQ\s?\d{4}$/i.test(nums.qst.trim())) return 'qst must look like 1234567890 TQ0001'
  return ''
}
