// Client-facing invoice wording (PDF, public link, email). Quebec French for 'fr'.
// Only labels live here — service names, descriptions and notes are whatever Robert types.

export const LANGS = [
  { id: 'en', label: 'English' },
  { id: 'fr', label: 'Français' },
]
export const DEFAULT_LANG = 'en'

// Accepts 'fr' / 'en' or an invoice row ({ language }). Anything else -> 'en'.
export function langOf(x) {
  const v = typeof x === 'string' ? x : x?.language
  return v === 'fr' ? 'fr' : 'en'
}

export const LOCALES = { en: 'en-CA', fr: 'fr-CA' }
export const localeOf = x => LOCALES[langOf(x)]

const STR = {
  en: {
    invoice: 'INVOICE',
    for_seniors: 'for Seniors',
    for_business: 'for Business',
    invoiceNo: 'Invoice #',
    dateIssued: 'Date Issued',
    dateOfService: 'Date of Service',
    status: 'Status',
    status_draft: 'DRAFT',
    status_sent: 'SENT',
    status_paid: 'PAID',
    billTo: 'BILL TO',
    attn: 'Attn:',
    service: 'Service',
    description: 'Description',
    qty: 'Qty',
    qtyPeople: 'Qty / People',
    rate: 'Rate',
    amount: 'Amount',
    subtotal: 'Subtotal',
    discount: 'Discount',
    totalDue: 'TOTAL DUE',
    totalDueCad: 'Total Due (CAD)',
    notes: 'NOTES',
    thanks: 'Thank you for choosing AI with Robert!',
    taxApplied: '{label} applied at {rate}',
    taxAt: '{label} at {rate}',
    taxNA: 'GST/QST/HST not applicable at this time.',
    workshopQty: '{p} ppl x {s} session(s)',
    workshopQtyShort: '{p}p × {s}s',
    pdfPrefix: 'Invoice',
    downloadPdf: 'Download PDF',
    generating: 'Generating…',
    pdfFailed: 'PDF generation failed: ',
    questions: 'Questions? Contact us at',
    notFoundTitle: 'Invoice Not Found',
    notFoundBody: 'This invoice link may have expired or is no longer available. Please contact AI with Robert directly.',
    // email
    emailSubject: 'Invoice {num} from AI with Robert',
    dear: 'Dear',
    trust: 'Thank you for placing your trust with the {brand} team.',
    pleaseFind: 'Please find below your invoice for',
    paymentReceived: 'PAYMENT RECEIVED',
    amountPending: 'AMOUNT PENDING:',
    emailLinkPre: 'You can also',
    emailLinkText: 'view and download a PDF copy of your invoice',
    rights: 'All rights reserved.',
  },
  fr: {
    invoice: 'FACTURE',
    for_seniors: 'pour aînés',
    for_business: 'pour entreprises',
    invoiceNo: 'N° de facture',
    dateIssued: "Date d'émission",
    dateOfService: 'Date du service',
    status: 'Statut',
    status_draft: 'BROUILLON',
    status_sent: 'ENVOYÉE',
    status_paid: 'PAYÉE',
    billTo: 'FACTURÉ À',
    attn: "À l'attention de :",
    service: 'Service',
    description: 'Description',
    qty: 'Qté',
    qtyPeople: 'Qté / Personnes',
    rate: 'Taux',
    amount: 'Montant',
    subtotal: 'Sous-total',
    discount: 'Rabais',
    totalDue: 'TOTAL À PAYER',
    totalDueCad: 'Total à payer (CAD)',
    notes: 'NOTES',
    thanks: "Merci d'avoir choisi AI with Robert !",
    taxApplied: '{label} appliquée à {rate}',
    taxAt: '{label} à {rate}',
    taxNA: 'TPS/TVQ/TVH non applicables.',
    workshopQty: '{p} pers. x {s} séance(s)',
    workshopQtyShort: '{p}p × {s}s',
    pdfPrefix: 'Facture',
    downloadPdf: 'Télécharger le PDF',
    generating: 'Génération…',
    pdfFailed: 'Échec de la génération du PDF : ',
    questions: 'Des questions ? Écrivez-nous à',
    notFoundTitle: 'Facture introuvable',
    notFoundBody: "Ce lien de facture a peut-être expiré ou n'est plus disponible. Veuillez communiquer directement avec AI with Robert.",
    emailSubject: 'Facture {num} de AI with Robert',
    dear: 'Bonjour',
    trust: "Merci d'avoir fait confiance à l'équipe de {brand}.",
    pleaseFind: 'Veuillez trouver ci-dessous votre facture pour le',
    paymentReceived: 'PAIEMENT REÇU',
    amountPending: 'MONTANT À PAYER :',
    emailLinkPre: 'Vous pouvez aussi',
    emailLinkText: 'consulter et télécharger une copie PDF de votre facture',
    rights: 'Tous droits réservés.',
  },
}

export function t(lang, key, vars) {
  const s = STR[langOf(lang)][key] ?? STR.en[key] ?? key
  return vars ? s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? '')) : s
}

// 14.975 -> "14.975%" (en) / "14,975 %" (fr, with a non-breaking space)
export function fmtPct(n, lang) {
  const v = Number(n).toLocaleString(localeOf(lang), { maximumFractionDigits: 3 })
  return langOf(lang) === 'fr' ? `${v} %` : `${v}%`
}

// jsPDF's built-in Helvetica can't draw U+00A0 / U+202F (fr-CA uses them as
// thousands/currency separators) — swap them for a plain space.
export const pdfSafe = s => String(s).replace(/[  ]/g, ' ')
