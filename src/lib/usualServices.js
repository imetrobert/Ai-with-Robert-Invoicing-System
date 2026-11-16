// "Usual services" for a client: looks at that client's previous invoices (same brand, newest first)
// and returns the service lines that repeat on EVERY one of the last few invoices, with the quantity,
// people and rate they usually have. No imports on purpose, so scripts/check_usual_services.mjs can test it.
//
// rows: invoice rows, newest first, each { brand, services: [{ service_id, service_name, description, quantity, people, rate }] }

export const USUAL_LOOKBACK = 5

const keyOf = (s) => (s.service_id && s.service_id !== 'custom' ? s.service_id : '') || (s.service_name || '').trim().toLowerCase()
const num = (v, fallback) => { const n = parseFloat(v); return Number.isFinite(n) && n > 0 ? n : fallback }

// Most common value; a tie goes to the newest (values are given newest first).
function usual(values) {
  const counts = new Map()
  values.forEach(v => counts.set(v, (counts.get(v) || 0) + 1))
  let best = values[0], bestN = 0
  for (const v of values) { const n = counts.get(v); if (n > bestN) { best = v; bestN = n } }
  return best
}

export function usualServiceLines(rows, brandId) {
  const recent = (rows || [])
    .filter(r => (r.brand || 'seniors') === brandId && Array.isArray(r.services) && r.services.some(s => s.service_name))
    .slice(0, USUAL_LOOKBACK)
  if (!recent.length) return []

  const lines = recent.map(r => r.services.filter(s => s.service_name))
  const newest = lines[0]
  const out = [], seen = new Set()
  for (const s of newest) {
    const k = keyOf(s)
    if (!k || seen.has(k)) continue
    seen.add(k)
    // Must appear on every considered invoice.
    const matches = lines.map(l => l.find(x => keyOf(x) === k))
    if (matches.some(m => !m)) continue
    out.push({
      service_id: s.service_id || (brandId === 'business' ? 'custom' : ''),
      service_name: s.service_name,
      description: s.description || '',
      quantity: usual(matches.map(m => num(m.quantity, 1))),
      people: usual(matches.map(m => num(m.people, 1))),
      rate: usual(matches.map(m => num(m.rate, 0))),
    })
  }
  return out
}
