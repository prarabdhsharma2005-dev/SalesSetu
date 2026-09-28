import { Router } from 'express'
import { GoogleSheetsService } from '../services/sheets.service'
import { checkOutreachQualification } from '../services/qualification-guard.service'
import { allowedOutreachTransition, checkOutreachQuality, deliveryTargetAvailable, reviewAcknowledgementAllowed, sequenceStatusAllowed } from '../services/outreach-workflow.service'
import type { SheetOutreach, SheetFollowUpStep } from '../services/sheets.service'
import { TavilyService } from '../services/tavily.service'
import { SalesGeminiService } from '../services/gemini.service'

export const sheetsRouter = Router()

// Get connection status
sheetsRouter.get('/status', (_req, res) => {
  res.json(GoogleSheetsService.getStatus())
})

// Leads from Google Sheets
sheetsRouter.get('/leads', async (_req, res) => {
  const leads = await GoogleSheetsService.getLeads()
  res.json({ total: leads.length, leads })
})

sheetsRouter.post('/leads', async (req, res) => {
  try {
    const lead = await GoogleSheetsService.appendLead(req.body)
    res.status(201).json(lead)
  } catch (err) {
    res.status(500).json({ error: 'Failed to append lead to sheets', details: String(err) })
  }
})

// Deals from Google Sheets
sheetsRouter.get('/deals', async (_req, res) => {
  const deals = await GoogleSheetsService.getDeals()
  const totalPipelineValue = deals.reduce((acc, d) => acc + (Number(d.value) || 0), 0)
  res.json({ totalPipelineValue, deals })
})

sheetsRouter.post('/deals', async (req, res) => {
  try {
    const deal = await GoogleSheetsService.appendDeal(req.body)
    res.status(201).json(deal)
  } catch (err) {
    res.status(500).json({ error: 'Failed to append deal to sheets', details: String(err) })
  }
})

sheetsRouter.patch('/deals/:id', async (req, res) => {
  try {
    const { stage } = req.body
    const updated = await GoogleSheetsService.updateDealStage(req.params.id, stage)
    if (!updated) return res.status(404).json({ error: 'Deal not found' })
    res.json(updated)
  } catch (err) {
    res.status(500).json({ error: 'Failed to update deal stage', details: String(err) })
  }
})

// Meetings from Google Sheets
sheetsRouter.get('/meetings', async (_req, res) => {
  const meetings = await GoogleSheetsService.getMeetings()
  res.json({ total: meetings.length, meetings })
})

sheetsRouter.post('/meetings', async (req, res) => {
  try {
    const meeting = await GoogleSheetsService.appendMeeting(req.body)
    res.status(201).json(meeting)
  } catch (err) {
    res.status(500).json({ error: 'Failed to append meeting to sheets', details: String(err) })
  }
})

// Outreach from Google Sheets
sheetsRouter.get('/outreach', async (_req, res) => {
  const outreach = await GoogleSheetsService.getOutreach()
  res.json({ total: outreach.length, outreach })
})

sheetsRouter.post('/outreach', async (req, res) => {
  try {
    if (req.body.status !== 'DRAFT') return res.status(400).json({ error: 'New outreach must be saved as a draft first.' })
    const gate = await checkOutreachQualification(req.body.leadId, req.body.company)
    if (gate && gate.error) return res.status(gate.status).json({ error: gate.error })
    if (!gate?.lead) return res.status(400).json({ error: 'A real stored lead is required for outreach.' })
    const { poc, channel, body, subject } = req.body
    if (!poc || typeof poc.name !== 'string' || typeof poc.sourceUrl !== 'string') return res.status(400).json({ error: 'A discovered POC with a source is required.' })
    if (!['email', 'linkedin', 'whatsapp'].includes(channel)) return res.status(400).json({ error: 'Unsupported outreach channel.' })
    try {
      const parsedSource = new URL(poc.sourceUrl)
      if (!['http:', 'https:'].includes(parsedSource.protocol)) throw new Error('invalid')
    } catch { return res.status(400).json({ error: 'POC source URL is invalid.' }) }
    const pocEvidence = await TavilyService.searchPOCs(gate.lead.company, gate.lead.website)
    const verifiedPoc = (await SalesGeminiService.identifyPOCs({ name: gate.lead.company, website: gate.lead.website }, pocEvidence))
      .find(person => person.name === poc.name && person.sourceUrl === poc.sourceUrl)
    if (!verifiedPoc) return res.status(400).json({ error: 'POC could not be verified against current sourced discovery results.' })
    if (typeof body !== 'string' || !body.trim() || (channel === 'email' && (typeof subject !== 'string' || !subject.trim()))) return res.status(400).json({ error: 'A message body and email subject are required.' })
    const pocId = `${verifiedPoc.name.toLowerCase()}|${verifiedPoc.sourceUrl}`
    const existing = await GoogleSheetsService.getOutreach()
    if (existing.some(item => item.leadId === gate.lead.id && item.pocId === pocId && item.channel === channel && item.body === body.trim() && !['REJECTED'].includes(item.status))) {
      return res.status(409).json({ error: 'This draft already exists.' })
    }
    const draft = {
      prospectName: verifiedPoc.name, email: null, company: gate.lead.company, subject: typeof subject === 'string' ? subject.trim() : '',
      body: body.trim(), status: 'DRAFT' as const, leadId: gate.lead.id, pocId,
      poc: { name: verifiedPoc.name, role: verifiedPoc.role, department: verifiedPoc.department, profileUrl: verifiedPoc.profileUrl, sourceUrl: verifiedPoc.sourceUrl, confidence: verifiedPoc.confidence },
      channel, qualificationStatus: gate.lead.qualificationStatus as 'qualified' | 'needs_review',
      qualificationScore: gate.lead.qualificationScore ?? null, reviewRequired: gate.reviewRequired, reviewAcknowledged: false,
    }
    const qualityChecks = checkOutreachQuality(draft)
    if (qualityChecks.some(check => check.status === 'BLOCKED')) return res.status(400).json({ error: 'Draft failed required quality checks.', qualityChecks })
    const item = await GoogleSheetsService.appendOutreach({
      ...draft, qualityChecks,
    })
    res.status(201).json(item)
  } catch (err) {
    res.status(500).json({ error: 'Failed to append outreach to sheets', details: String(err) })
  }
})

sheetsRouter.patch('/outreach/:id', async (req, res) => {
  try {
    const item = (await GoogleSheetsService.getOutreach()).find(outreach => outreach.id === req.params.id)
    if (!item) return res.status(404).json({ error: 'Outreach item not found' })
    if (req.body.body !== undefined || req.body.subject !== undefined) {
      if (!['DRAFT', 'PENDING_APPROVAL'].includes(item.status)) return res.status(409).json({ error: 'Only drafts awaiting approval can be edited.' })
      const candidate = { ...item, body: typeof req.body.body === 'string' ? req.body.body : item.body, subject: typeof req.body.subject === 'string' ? req.body.subject : item.subject }
      const qualityChecks = checkOutreachQuality(candidate)
      if (qualityChecks.some(check => check.status === 'BLOCKED')) return res.status(400).json({ error: 'Message failed required quality checks.', qualityChecks })
      const updated = await GoogleSheetsService.updateOutreach(item.id, { body: candidate.body, subject: candidate.subject, qualityChecks })
      return res.json(updated)
    }
    const status = req.body.status as SheetOutreach['status']
    if (!allowedOutreachTransition(item.status, status)) return res.status(409).json({ error: 'Invalid outreach status transition.' })
    const gate = await checkOutreachQualification(item.leadId, item.company)
    if (gate && gate.error) return res.status(gate.status).json({ error: gate.error })
    if (['PENDING_APPROVAL', 'APPROVED', 'DELIVERY_READY'].includes(status) && !gate?.lead) {
      return res.status(400).json({ error: 'A real stored lead is required to advance outreach.' })
    }
    if (['APPROVED', 'DELIVERY_READY'].includes(status) && gate?.reviewRequired && item.reviewAcknowledged !== true) {
      return res.status(409).json({ error: 'Qualification review must be acknowledged before outreach can be approved.' })
    }
    if (status === 'PENDING_APPROVAL') {
      if (!gate?.lead) return res.status(400).json({ error: 'A real stored lead is required.' })
      if (!reviewAcknowledgementAllowed(item.reviewAcknowledged, gate.reviewRequired, req.body.reviewAcknowledged)) {
        return res.status(409).json({ error: 'Review the qualification reasons and acknowledge the review before submitting for approval.' })
      }
      const qualityChecks = checkOutreachQuality(item)
      if (qualityChecks.some(check => check.status === 'BLOCKED')) return res.status(400).json({ error: 'Draft failed required quality checks.', qualityChecks })
      const updated = await GoogleSheetsService.updateOutreach(item.id, {
        status, qualityChecks,
        qualificationStatus: gate.lead.qualificationStatus as 'qualified' | 'needs_review',
        qualificationScore: gate.lead.qualificationScore ?? null,
        reviewRequired: gate.reviewRequired,
        reviewAcknowledged: gate.reviewRequired ? req.body.reviewAcknowledged === true || item.reviewAcknowledged === true : false,
      })
      return res.json(updated)
    }
    if (status === 'DELIVERY_READY') {
      if (!deliveryTargetAvailable(item)) return res.status(409).json({ error: 'Recipient is unknown for this channel; the approved record cannot become delivery-ready.' })
      const updated = await GoogleSheetsService.updateOutreach(item.id, { status, deliveryReadyAt: new Date().toISOString() })
      return res.json(updated)
    }
    const updated = await GoogleSheetsService.updateOutreach(item.id, {
      status,
      ...(status === 'APPROVED' ? { approvedAt: new Date().toISOString(), approvedBy: null } : {}),
    })
    return res.json(updated)
  } catch (err) {
    res.status(500).json({ error: 'Failed to update outreach status', details: String(err) })
  }
})

sheetsRouter.get('/follow-up-sequences', async (_req, res) => {
  const sequences = await GoogleSheetsService.getSequences()
  res.json({ total: sequences.length, sequences })
})

sheetsRouter.post('/follow-up-sequences', async (req, res) => {
  const outreachId = typeof req.body?.outreachId === 'string' ? req.body.outreachId : ''
  const outreach = (await GoogleSheetsService.getOutreach()).find(item => item.id === outreachId)
  if (!outreach) return res.status(404).json({ error: 'Outreach record not found.' })
  if (!['APPROVED', 'DELIVERY_READY'].includes(outreach.status) || !outreach.leadId) return res.status(409).json({ error: 'Approve a persisted real-lead outreach draft before creating a sequence.' })
  const gate = await checkOutreachQualification(outreach.leadId, outreach.company)
  if (gate && gate.error) return res.status(gate.status).json({ error: gate.error })
  if (!gate?.lead) return res.status(409).json({ error: 'The associated stored lead is unavailable.' })
  try {
    const sequence = await GoogleSheetsService.createSequence(outreach)
    return res.status(201).json(sequence)
  } catch (err) {
    return res.status(409).json({ error: err instanceof Error ? err.message : 'Could not create follow-up sequence.' })
  }
})

sheetsRouter.patch('/follow-up-sequences/:id', async (req, res) => {
  const status = req.body?.status
  if (!sequenceStatusAllowed(status)) return res.status(400).json({ error: 'Invalid follow-up sequence status.' })
  const sequence = (await GoogleSheetsService.getSequences()).find(item => item.id === req.params.id)
  if (!sequence) return res.status(404).json({ error: 'Follow-up sequence not found.' })
  if (['REPLIED', 'MEETING_BOOKED', 'STOPPED', 'COMPLETED'].includes(sequence.status) && status !== sequence.status) return res.status(409).json({ error: 'A stopped sequence cannot be reactivated.' })
  const updated = await GoogleSheetsService.updateSequence(sequence.id, { status })
  return res.json(updated)
})

sheetsRouter.patch('/follow-up-sequences/:id/steps/:step', async (req, res) => {
  const sequence = (await GoogleSheetsService.getSequences()).find(item => item.id === req.params.id)
  if (!sequence) return res.status(404).json({ error: 'Follow-up sequence not found.' })
  if (sequence.status !== 'ACTIVE') return res.status(409).json({ error: 'Paused or stopped sequences cannot progress.' })
  const number = Number(req.params.step)
  const step = sequence.steps.find(item => item.step === number)
  if (!step || number === 1) return res.status(404).json({ error: 'Follow-up step not found.' })
  const status = req.body?.status as SheetFollowUpStep['status']
  if (status === 'PENDING_APPROVAL') {
    if (step.status !== 'DRAFT' || !step.body.trim()) return res.status(409).json({ error: 'A generated follow-up draft is required.' })
  } else if (status === 'APPROVED') {
    if (step.status !== 'PENDING_APPROVAL') return res.status(409).json({ error: 'Follow-up must be pending approval.' })
  } else if (status === 'DELIVERY_READY') {
    if (step.status !== 'APPROVED') return res.status(409).json({ error: 'Follow-up must be approved first.' })
    const initial = (await GoogleSheetsService.getOutreach()).find(item => item.id === sequence.outreachId)
    if (!initial || !deliveryTargetAvailable(initial)) return res.status(409).json({ error: 'The recipient is unknown for this channel; the follow-up cannot become delivery-ready.' })
  } else if (status === 'REJECTED') {
    if (step.status !== 'PENDING_APPROVAL') return res.status(409).json({ error: 'Follow-up must be pending approval.' })
  } else if (req.body?.body !== undefined || req.body?.subject !== undefined) {
    if (step.status !== 'DRAFT') return res.status(409).json({ error: 'Only unsubmitted follow-up drafts can be edited.' })
  } else return res.status(400).json({ error: 'Invalid follow-up step transition.' })
  const steps = sequence.steps.map(item => item.id === step.id ? {
    ...item,
    ...(typeof req.body?.body === 'string' ? { body: req.body.body } : {}),
    ...(typeof req.body?.subject === 'string' ? { subject: req.body.subject } : {}),
    ...(status ? { status, ...(status === 'APPROVED' ? { approvedAt: new Date().toISOString() } : {}) } : {}),
    updatedAt: new Date().toISOString(),
  } : item)
  const updated = await GoogleSheetsService.updateSequence(sequence.id, { steps })
  return res.json({ sequence: updated, step: updated?.steps.find(item => item.id === step.id) })
})
