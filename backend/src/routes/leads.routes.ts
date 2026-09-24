import { Router } from 'express'

export const leadsRouter = Router()

// Mock data store for leads
const MOCK_LEADS = [
  { id: '1', company: 'HyperScale AI', domain: 'hyperscale.ai', score: 94, intent: 'HIRING_ENGINEERS', city: 'Bengaluru', country: 'India', employees: 120 },
  { id: '2', company: 'PayFlow Technologies', domain: 'payflow.in', score: 88, intent: 'FUNDING_SERIES_B', city: 'Mumbai', country: 'India', employees: 340 },
  { id: '3', company: 'CloudNexus Global', domain: 'cloudnexus.io', score: 91, intent: 'EXPANSION_APAC', city: 'Delhi-NCR', country: 'India', employees: 210 },
  { id: '4', company: 'LogiFleet Logistics', domain: 'logifleet.co', score: 76, intent: 'TECH_ADOPTION', city: 'Hyderabad', country: 'India', employees: 85 },
]

leadsRouter.get('/', (req, res) => {
  const { query, minScore } = req.query
  let leads = [...MOCK_LEADS]
  if (query) {
    leads = leads.filter(l => l.company.toLowerCase().includes(String(query).toLowerCase()))
  }
  if (minScore) {
    leads = leads.filter(l => l.score >= Number(minScore))
  }
  res.json({ total: leads.length, leads })
})

leadsRouter.get('/:id', (req, res) => {
  const lead = MOCK_LEADS.find(l => l.id === req.params.id)
  if (!lead) return res.status(404).json({ error: 'Lead not found' })
  res.json(lead)
})
