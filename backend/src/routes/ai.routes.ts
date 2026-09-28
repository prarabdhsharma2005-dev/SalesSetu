import { Router } from 'express'
import { SalesGeminiService } from '../services/gemini.service'
import { checkOutreachQualification } from '../services/qualification-guard.service'
import { GoogleSheetsService } from '../services/sheets.service'
import { TavilyService } from '../services/tavily.service'

export const aiRouter = Router()

aiRouter.get('/test', async (_req, res) => {
  const result = await SalesGeminiService.testConnection()
  return res.json(result)
})

aiRouter.post('/icp-parse', async (req, res) => {
  const { query } = req.body
  if (!query) {
    return res.status(400).json({ error: 'Query is required' })
  }
  const result = await SalesGeminiService.parseICPQuery(query)
  return res.json(result)
})

aiRouter.post('/parse-icp', async (req, res) => {
  const { query } = req.body
  if (!query) {
    return res.status(400).json({ error: 'Query is required' })
  }
  const result = await SalesGeminiService.parseICPQuery(query)
  return res.json(result)
})

aiRouter.post('/draft-email', async (req, res) => {
  const { prospect } = req.body
  if (!prospect) {
    return res.status(400).json({ error: 'Prospect data is required' })
  }
  const gate = await checkOutreachQualification(prospect.leadId, prospect.company)
  if (gate && gate.error) return res.status(gate.status).json({ error: gate.error })
  if (!gate?.lead) return res.status(400).json({ error: 'Outreach drafting requires an existing stored lead.' })
  const poc = prospect.poc
  if (!poc || typeof poc.name !== 'string' || typeof poc.sourceUrl !== 'string') {
    return res.status(400).json({ error: 'Select a discovered, sourced POC before generating outreach.' })
  }
  try {
    const discovered = await TavilyService.searchPOCs(gate.lead.company, gate.lead.website)
    const verifiedPocs = await SalesGeminiService.identifyPOCs({ name: gate.lead.company, website: gate.lead.website }, discovered)
    const selected = verifiedPocs.find(item => item.name === poc.name && item.sourceUrl === poc.sourceUrl)
    if (!selected) return res.status(400).json({ error: 'The selected POC could not be verified against current sourced discovery results.' })
    const researchResults = await TavilyService.searchCompany(gate.lead.company, gate.lead.website)
    if (researchResults.length === 0) return res.status(503).json({ error: 'Company research is unavailable; no evidence-backed outreach draft was generated.' })
    const research = await SalesGeminiService.researchCompany({
      name: gate.lead.company, website: gate.lead.website, industry: gate.lead.industry,
      city: gate.lead.city, country: gate.lead.country, intentSignal: gate.lead.intentSignal,
    }, researchResults)
    const result = await SalesGeminiService.draftPersonalizedEmail({
      name: selected.name, title: selected.role || '', pocDepartment: selected.department,
      pocRelevance: selected.relevanceReason, company: gate.lead.company,
      industry: gate.lead.industry, location: [gate.lead.city, gate.lead.country].filter(Boolean).join(', '),
      employees: gate.lead.employees, intentSignal: gate.lead.intentSignal,
      intentEvidence: gate.lead.qualificationEvidence?.filter(item => item.criterion.includes('intent')).map(item => item.value).join('; '),
      researchSummary: research.summary, researchSources: research.sources.map(source => source.url),
      qualificationStatus: gate.lead.qualificationStatus,
      qualificationScore: gate.lead.qualificationScore,
      qualificationReasons: gate.lead.qualificationReasons,
      qualificationEvidence: gate.lead.qualificationEvidence,
      channel: ['email', 'linkedin', 'whatsapp'].includes(prospect.channel) ? prospect.channel : 'email',
      tone: typeof prospect.tone === 'string' ? prospect.tone.slice(0, 40) : 'consultative',
    })
    return res.json({ ...result, poc: selected, researchSources: research.sources, reviewRequired: gate.reviewRequired })
  } catch (err) {
    console.error('[Outreach] Evidence-backed draft generation failed:', err instanceof Error ? err.name : 'UNKNOWN_ERROR')
    return res.status(503).json({ error: 'Outreach generation is unavailable. No draft was generated.' })
  }
})

aiRouter.post('/follow-up-draft', async (req, res) => {
  const sequenceId = typeof req.body?.sequenceId === 'string' ? req.body.sequenceId : ''
  const stepNumber = Number(req.body?.step)
  const sequences = await GoogleSheetsService.getSequences()
  const sequence = sequences.find(item => item.id === sequenceId)
  if (!sequence) return res.status(404).json({ error: 'Follow-up sequence not found.' })
  const step = sequence.steps.find(item => item.step === stepNumber)
  if (!step || ![2, 3].includes(stepNumber)) return res.status(400).json({ error: 'Follow-up step is invalid.' })
  if (sequence.status !== 'ACTIVE') return res.status(409).json({ error: 'Sequence is stopped or paused; no further follow-up can be generated.' })
  if (step.body.trim()) return res.status(409).json({ error: 'A draft already exists for this sequence step.' })
  const gate = await checkOutreachQualification(sequence.leadId, sequence.company)
  if (!gate || 'error' in gate) return res.status(gate?.status || 409).json({ error: gate?.error || 'Qualification is required.' })
  try {
    const initial = await GoogleSheetsService.getOutreach().then(items => items.find(item => item.id === sequence.outreachId))
    if (!initial) return res.status(404).json({ error: 'Initial outreach record not found.' })
    const draft = await SalesGeminiService.draftFollowUp({
      original: initial.body, company: sequence.company, recipient: sequence.prospectName,
      step: stepNumber, intentSignal: gate.lead.intentSignal, tone: 'consultative',
    })
    const updatedSteps = sequence.steps.map(item => item.id === step.id
      ? { ...item, ...draft, status: 'DRAFT' as const, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
      : item)
    const updated = await GoogleSheetsService.updateSequence(sequence.id, { steps: updatedSteps })
    return res.json({ sequence: updated, step: updated?.steps.find(item => item.id === step.id) })
  } catch (err) {
    console.error('[Outreach] Follow-up generation failed:', err instanceof Error ? err.name : 'UNKNOWN_ERROR')
    return res.status(503).json({ error: 'Follow-up generation is unavailable. No draft was generated.' })
  }
})

aiRouter.post('/extract-mom', async (req, res) => {
  const { transcript } = req.body
  if (!transcript) {
    return res.status(400).json({ error: 'Transcript or notes are required' })
  }
  const result = await SalesGeminiService.extractMoM(transcript)
  return res.json(result)
})
