// Brand (sub-brand) configuration. Both brands are billed under the same
// AIWithRobert master corp; the brand only changes the logo, colours, tagline,
// website and invoice-number sequence on the document.
//
// To add a third brand later: add an entry here, add it to the CHECK constraint
// in supabase/migrations (invoices_brand_check), and give it a logo in public/logos/.

const BASE = import.meta.env.BASE_URL || '/'

export const CONTACT = {
  email:   'invoices@aiwithrobert.com',
  phone:   '(514) 250-8491',
  address: '5550 Lyndale, Cote Saint-Luc, Quebec  H4V 2L5',
}

export const BRANDS = {
  seniors: {
    id: 'seniors',
    label: 'Seniors',
    name: 'AI with Robert',
    tagline: 'AI & Technology Training for Seniors',
    website: 'seniors.aiwithrobert.com',
    logo: `${BASE}logos/seniors.png`,
    numberPrefix: 'AWR-',            // AWR-YYYYMM-001
    navy: '#11304C',
    accent: '#3FA7E0',               // sky
    accentText: '#1F77AE',           // sky, text-safe
    tint: '#EAF5FC',
  },
  business: {
    id: 'business',
    label: 'Business',
    name: 'AI with Robert',
    tagline: 'AI Consulting & Automation for Small Business',
    website: 'biz.aiwithrobert.com',
    logo: `${BASE}logos/business.png`,
    numberPrefix: 'AWR-B-',          // AWR-B-YYYYMM-001
    navy: '#11304C',
    accent: '#C9A227',               // gold
    accentText: '#8A6D0B',           // gold, text-safe
    tint: '#FBF6E6',
  },
}

export const DEFAULT_BRAND = 'seniors'
export const BRAND_LIST = Object.values(BRANDS)

// Accepts an invoice row, a brand id, or nothing. Unknown/missing -> seniors,
// which is what every invoice created before the brand column existed is.
export function brandOf(x) {
  const id = typeof x === 'string' ? x : x?.brand
  return BRANDS[id] || BRANDS[DEFAULT_BRAND]
}

export function hexToRgb(hex) {
  const h = hex.replace('#', '')
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16))
}

// Inline CSS variables so a themed invoice document picks up its brand's
// colours without touching the rest of the app.
export function brandCssVars(brand) {
  return { '--navy': brand.navy, '--blue': brand.accentText, '--blue-light': brand.accent, '--blue-pale': brand.tint }
}
