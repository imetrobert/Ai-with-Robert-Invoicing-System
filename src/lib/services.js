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

// Business quick-add catalog. Mirrors the Pricing section on biz.aiwithrobert.com
// (and FX_PRICE in the toolkit repo): keep the three equal. Prices are CAD before
// GST/QST. Rate x Quantity is the line total, so per-person and per-hour items use
// Quantity. Each line stays editable (name, description, quantity, rate) after
// picking, and "Custom" is still available for anything not listed.
export const BUSINESS_SERVICES = [
  {
    id: 'biz-assessment-small',
    name: 'AI Opportunity Assessment (up to 5 people)',
    description: 'Your needs checked against your AI plan, written assessment, workflow shortlist and proposal',
    rate: 900.00, unit: 'flat', unitLabel: '',
  },
  {
    id: 'biz-assessment-large',
    name: 'AI Opportunity Assessment (6 to 20 people)',
    description: 'Your needs checked against your AI plan, written assessment, workflow shortlist and proposal',
    rate: 1800.00, unit: 'flat', unitLabel: '',
  },
  {
    id: 'biz-workflow',
    name: 'AI Workflow Setup (per workflow)',
    description: 'Workflow document, saved instructions set up in your AI account, tested on a real example, handover',
    rate: 2000.00, unit: 'flat', unitLabel: '/workflow',
  },
  {
    id: 'biz-condition',
    name: 'Workflow condition (extra setup on your plan)',
    description: 'Additional setup for a need your plan supports only partly, quoted in the proposal',
    rate: 500.00, unit: 'flat', unitLabel: '/condition',
  },
  {
    id: 'biz-training',
    name: 'Team Training Session (up to 10 people, 3 hours)',
    description: 'Live hands-on session, workbook and slides, take-home handout and feedback survey',
    rate: 1500.00, unit: 'flat', unitLabel: '',
  },
  {
    id: 'biz-training-extra',
    name: 'Team Training: additional person',
    description: 'Each person beyond the first 10 in a training session (set Quantity to the number of extra people)',
    rate: 100.00, unit: 'person', unitLabel: '/person',
  },
  {
    id: 'biz-bundle',
    name: 'Starter Bundle',
    description: 'Assessment (up to 5 people), one workflow set up and tested, one training session (up to 10 people)',
    rate: 3950.00, unit: 'flat', unitLabel: '',
  },
  {
    id: 'biz-talk',
    name: 'Talk for a business group',
    description: 'Presentation for your group or event (price is a starting price, confirmed in the proposal)',
    rate: 500.00, unit: 'flat', unitLabel: '',
  },
  {
    id: 'biz-support',
    name: 'Monthly support (about 2 hours)',
    description: 'Ongoing help with your AI workflows',
    rate: 300.00, unit: 'month', unitLabel: '/month',
  },
  {
    id: 'biz-hourly',
    name: 'Extra help (hourly)',
    description: 'Additional hands-on help outside a package',
    rate: 150.00, unit: 'hour', unitLabel: '/hr',
  },
]

export function getServices(brand) {
  return brand === 'business' ? BUSINESS_SERVICES : SERVICES
}
