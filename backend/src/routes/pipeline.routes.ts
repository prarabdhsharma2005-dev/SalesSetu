import { Router } from 'express'

export const pipelineRouter = Router()

const MOCK_DEALS = [
  { id: 'deal-1', title: 'Enterprise AI Suite Expansion', company: 'HyperScale AI', value: 45000, stage: 'PROPOSAL', probability: 75, health: 'STRONG' },
  { id: 'deal-2', title: 'Sales Automation Pilot', company: 'PayFlow Technologies', value: 24000, stage: 'DISCOVERY', probability: 40, health: 'NEEDS_ATTENTION' },
  { id: 'deal-3', title: 'Global Outreach Rollout', company: 'CloudNexus Global', value: 72000, stage: 'NEGOTIATION', probability: 85, health: 'STRONG' },
]

pipelineRouter.get('/deals', (_req, res) => {
  const totalPipelineValue = MOCK_DEALS.reduce((acc, d) => acc + d.value, 0)
  res.json({ totalPipelineValue, deals: MOCK_DEALS })
})
