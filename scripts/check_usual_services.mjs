// Checks the "usual services" pre-fill logic. Run: node scripts/check_usual_services.mjs
import { usualServiceLines } from '../src/lib/usualServices.js'
const bad = []
const eq = (name, got, want) => { if (JSON.stringify(got) !== JSON.stringify(want)) bad.push(`${name}: got ${JSON.stringify(got)}, expected ${JSON.stringify(want)}`) }
const ws = (people, extra = {}) => ({ service_id: 'group-workshop', service_name: 'Group Workshop', description: 'd', quantity: 1, people, rate: 35, ...extra })
const inh = { service_id: 'inhome-session', service_name: 'In-Home', description: 'x', quantity: 2, people: 1, rate: 65 }
const row = (services, brand = 'seniors') => ({ brand, services })

eq('no history', usualServiceLines([], 'seniors'), [])
eq('single invoice is copied', usualServiceLines([row([ws(8)])], 'seniors').map(l => [l.service_id, l.people]), [['group-workshop', 8]])
eq('always 8 people', usualServiceLines([row([ws(8)]), row([ws(8)]), row([ws(8)])], 'seniors')[0].people, 8)
eq('varying people uses the most common', usualServiceLines([row([ws(6)]), row([ws(8)]), row([ws(8)])], 'seniors')[0].people, 8)
eq('tie goes to newest', usualServiceLines([row([ws(10)]), row([ws(8)])], 'seniors')[0].people, 10)
eq('service not on every invoice is dropped', usualServiceLines([row([ws(8), inh]), row([ws(8)])], 'seniors').map(l => l.service_id), ['group-workshop'])
eq('nothing repeats', usualServiceLines([row([ws(8)]), row([inh])], 'seniors'), [])
eq('other brand ignored', usualServiceLines([row([ws(8)], 'business')], 'seniors'), [])
eq('old rows without brand are seniors', usualServiceLines([{ services: [ws(8)] }], 'seniors').length, 1)
eq('custom business lines match by name', usualServiceLines([row([{ service_id: 'custom', service_name: 'Workflow Setup', quantity: 1, people: 1, rate: 2000 }], 'business'), row([{ service_id: 'custom', service_name: 'workflow setup', quantity: 1, people: 1, rate: 2000 }], 'business')], 'business').length, 1)
eq('rate keeps what was usually charged', usualServiceLines([row([ws(8, { rate: 30 })]), row([ws(8, { rate: 30 })])], 'seniors')[0].rate, 30)

if (bad.length) { console.log('PROBLEMS:\n - ' + bad.join('\n - ')); process.exit(1) }
console.log('OK: usual-services pre-fill behaves as expected')
