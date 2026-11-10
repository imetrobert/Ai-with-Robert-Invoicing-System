export const SERVICES = [
  {
    id: 'online-session',
    name: 'One-on-One Online Session',
    description: 'Personalized AI & technology training via video call',
    rate: 60.00,
    unit: 'hour',
    unitLabel: '/hr',
  },
  {
    id: 'inhome-session',
    name: 'One-on-One In-Home Session',
    description: 'Personalized AI & technology training at your home in Côte Saint-Luc area',
    rate: 65.00,
    unit: 'hour',
    unitLabel: '/hr',
  },
  {
    id: 'starter-package',
    name: 'Starter Package (5 Hours)',
    description: '5 hours of personalized AI & technology training — save $25',
    rate: 275.00,
    unit: 'flat',
    unitLabel: 'flat',
  },
  {
    id: 'complete-package',
    name: 'Complete Package (10 Hours)',
    description: '10 hours of comprehensive AI & technology training — save $100',
    rate: 500.00,
    unit: 'flat',
    unitLabel: 'flat',
  },
  {
    id: 'group-workshop',
    name: 'Group Workshop (90 min)',
    description: 'Small group AI & technology workshop for 2–6 seniors',
    rate: 35.00,
    unit: 'person',
    unitLabel: '/person',
  },
  {
    id: 'discovery-call',
    name: 'Free Discovery Call (30 min)',
    description: 'Complimentary introductory call to discuss goals and options',
    rate: 0.00,
    unit: 'flat',
    unitLabel: 'free',
  },
  {
    id: 'custom',
    name: 'Custom Service',
    description: '',
    rate: 0.00,
    unit: 'flat',
    unitLabel: '',
  },
]

// Business invoices are open-ended: each line is a service name, a description,
// a quantity and a rate, so there is no fixed price list yet. To add a saved
// catalog later, add entries here (same shape as SERVICES); the Business form
// then shows a "Quick add" picker above the open-ended fields automatically.
export const BUSINESS_SERVICES = []

export function getServices(brand) {
  return brand === 'business' ? BUSINESS_SERVICES : SERVICES
}
