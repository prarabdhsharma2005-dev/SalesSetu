import { Router, type Response } from 'express'
import { GoogleSheetsService } from '../services/sheets.service'
import { checkOutreachQualification } from '../services/qualification-guard.service'
import { allowedFollowUpStepTransition, allowedOutreachTransition, checkOutreachQuality, deliveryTargetAvailable, requiredPredecessorStatus, reviewAcknowledgementAllowed, sequenceStatusAllowed } from '../services/outreach-workflow.service'
import { normalizeCadenceAnchorAt, type SheetOutreach, type SheetFollowUpStep } from '../services/sheets.service'
import { TavilyService } from '../services/tavily.service'
import { SalesGeminiService } from '../services/gemini.service'
import { POCVerificationCache } from '../services/poc-verification-cache.service'
import { processDueFollowUps } from '../services/follow-up-automation.service'
import { MeetingValidationError } from '../services/meeting.service'
import { MeetingWorkflowConflictError, MeetingWorkflowValidationError, parseDealLink } from '../services/meeting-workflow.service'
import { recommendNextActions } from '../services/next-best-action.service'

export const sheetsRouter = Router()

sheetsRouter.get('/next-best-actions', async (_req, res) => {
  try { return res.json({ recommendations: recommendNextActions(await GoogleSheetsService.getRecommendationData()) }) }
  catch { return res.status(500).json({ error: 'Recommendations could not be loaded.' }) }
})

sheetsRouter.post('/meetings/:id/link-sequence', async (req, res) => {
  try {
    const meeting = await GoogleSheetsService.linkMeetingSequence(req.params.id, req.body)
    return meeting ? res.json(meeting) : res.status(404).json({ error: 'Meeting not found.' })
  } catch (err) { return meetingWorkflowError(res, err) }
})
sheetsRouter.post('/meetings/:id/outcome/apply-sequence', async (req, res) => {
  try {
    const result = await GoogleSheetsService.applyMeetingSequenceOutcome(req.params.id, req.body)
    return result ? res.json(result) : res.status(404).json({ error: 'Meeting not found.' })
  } catch (err) { return meetingWorkflowError(res, err) }
})

function meetingWorkflowError(res: Response, err: unknown) {
  if (err instanceof MeetingWorkflowValidationError) return res.status(400).json({ error: err.message })
  if (err instanceof MeetingWorkflowConflictError) return res.status(409).json({ error: err.message })
  return res.status(500).json({ error: 'Meeting workflow operation failed.' })
}

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
  try {
    const meetings = await GoogleSheetsService.getMeetings()
    res.json({ total: meetings.length, meetings })
  } catch {
    res.status(500).json({ error: 'Could not load meetings.' })
  }
})

sheetsRouter.post('/meetings', async (req, res) => {
  try {
    const meeting = await GoogleSheetsService.appendMeeting(req.body)
    res.status(201).json(meeting)
  } catch (err) {
    if (err instanceof MeetingValidationError) return res.status(400).json({ error: err.message })
    res.status(500).json({ error: 'Could not save meeting.' })
  }
})

sheetsRouter.patch('/meetings/:id', async (req, res) => {
  try {
    const meeting = await GoogleSheetsService.updateMeeting(req.params.id, req.body)
    if (!meeting) return res.status(404).json({ error: 'Meeting not found.' })
    res.json(meeting)
  } catch (err) {
    if (err instanceof MeetingValidationError) return res.status(400).json({ error: err.message })
    res.status(500).json({ error: 'Could not update meeting.' })
  }
})

sheetsRouter.get('/meetings/:id/workflow', async (req, res) => {
  try {
    const workflow = await GoogleSheetsService.getMeetingWorkflow(req.params.id)
    if (!workflow) return res.status(404).json({ error: 'Meeting not found.' })
    return res.json(workflow)
  } catch (err) { return meetingWorkflowError(res, err) }
})

sheetsRouter.put('/meetings/:id/mom', async (req, res) => {
  try {
    const mom = await GoogleSheetsService.saveMeetingMom(req.params.id, req.body)
    if (!mom) return res.status(404).json({ error: 'Meeting not found.' })
    return res.json(mom)
  } catch (err) { return meetingWorkflowError(res, err) }
})

sheetsRouter.post('/meetings/:id/mom/review', async (req, res) => {
  try {
    const mom = await GoogleSheetsService.reviewMeetingMom(req.params.id, req.body)
    if (!mom) return res.status(404).json({ error: 'Meeting not found.' })
    return res.json(mom)
  } catch (err) { return meetingWorkflowError(res, err) }
})

sheetsRouter.post('/meetings/:id/mom/tasks', async (req, res) => {
  try {
    const result = await GoogleSheetsService.createMeetingTask(req.params.id, req.body)
    if (!result) return res.status(404).json({ error: 'Meeting not found.' })
    return res.status(result.created ? 201 : 200).json(result)
  } catch (err) { return meetingWorkflowError(res, err) }
})

sheetsRouter.patch('/meeting-tasks/:id', async (req, res) => {
  try {
    const task = await GoogleSheetsService.updateMeetingTask(req.params.id, req.body)
    if (!task) return res.status(404).json({ error: 'Meeting task not found.' })
    return res.json(task)
  } catch (err) { return meetingWorkflowError(res, err) }
})

sheetsRouter.put('/meetings/:id/outcome', async (req, res) => {
  try {
    const outcome = await GoogleSheetsService.saveMeetingOutcome(req.params.id, req.body)
    if (!outcome) return res.status(404).json({ error: 'Meeting not found.' })
    return res.json(outcome)
  } catch (err) { return meetingWorkflowError(res, err) }
})

sheetsRouter.post('/meetings/:id/link-deal', async (req, res) => {
  try {
    const { dealId } = parseDealLink(req.body)
    const meeting = await GoogleSheetsService.linkMeetingDeal(req.params.id, dealId)
    if (!meeting) return res.status(404).json({ error: 'Meeting not found.' })
    return res.json(meeting)
  } catch (err) { return meetingWorkflowError(res, err) }
})

sheetsRouter.post('/meetings/:id/outcome/review', async (req, res) => {
  try {
    const outcome = await GoogleSheetsService.reviewMeetingOutcome(req.params.id, req.body)
    if (!outcome) return res.status(404).json({ error: 'Meeting not found.' })
    return res.json(outcome)
  } catch (err) { return meetingWorkflowError(res, err) }
})

sheetsRouter.post('/meetings/:id/outcome/apply', async (req, res) => {
  try {
    const result = await GoogleSheetsService.applyMeetingOutcome(req.params.id, req.body)
    if (!result) return res.status(404).json({ error: 'Meeting not found.' })
    return res.json(result)
  } catch (err) { return meetingWorkflowError(res, err) }
})

// Outreach from Google Sheets
sheetsRouter.get('/outreach', async (_req, res) => {
  const outreach = await GoogleSheetsService.getOutreach()
  res.json({ total: outreach.length, outreach })
})

sheetsRouter.post('/outreach', async (req, res) => {
  try {
    if (req.body.status !== 'DRAFT') return res.status(400).json({ error: 'New outreach must be saved as a draft first.' })
    const clientDraftId = typeof req.body.clientDraftId === 'string' && /^[0-9a-f-]{36}$/i.test(req.body.clientDraftId) ? req.body.clientDraftId : null
    if (req.body.clientDraftId !== undefined && !clientDraftId) return res.status(400).json({ error: 'Client draft ID must be a UUID.' })
    const gate = await checkOutreachQualification(req.body.leadId, req.body.company)
    if (gate && gate.error) return res.status(gate.status).json({ error: gate.error })
    if (!gate?.lead) return res.status(400).json({ error: 'A real stored lead is required for outreach.' })
    const { poc, channel, body, subject } = req.body
    if (!poc || typeof poc.name !== 'string' || typeof poc.sourceUrl !== 'string') return res.status(400).json({ error: 'A discovered POC with a source is required.' })
    if (!['email', 'linkedin', 'whatsapp'].includes(channel)) return res.status(400).json({ error: 'Unsupported outreach channel.' })
    const existing = await GoogleSheetsService.getOutreach()
    const previous = clientDraftId ? existing.find(item => item.clientDraftId === clientDraftId) : undefined
    if (previous) return previous.leadId === gate.lead.id && previous.poc?.name === poc.name && previous.poc?.sourceUrl === poc.sourceUrl && previous.body === body?.trim()
      ? res.json(previous) : res.status(409).json({ error: 'Draft ID was already used for different content.' })
    try {
      const parsedSource = new URL(poc.sourceUrl)
      if (!['http:', 'https:'].includes(parsedSource.protocol)) throw new Error('invalid')
    } catch { return res.status(400).json({ error: 'POC source URL is invalid.' }) }
    let verifiedPoc = poc.verificationToken === undefined
      ? POCVerificationCache.find(gate.lead.id, poc.name, poc.sourceUrl)
      : POCVerificationCache.verify(gate.lead, poc)
    if (!verifiedPoc && poc.verificationToken === undefined) {
      try {
        const pocEvidence = await TavilyService.searchPOCs(gate.lead.company, gate.lead.website)
        verifiedPoc = (await SalesGeminiService.identifyPOCs({ name: gate.lead.company, website: gate.lead.website }, pocEvidence))
          .find(person => person.name === poc.name && person.sourceUrl === poc.sourceUrl) || null
      } catch {
        return res.status(503).json({ code: 'POC_VERIFICATION_UNAVAILABLE', error: 'POC verification provider is unavailable. No draft was saved.' })
      }
    }
    if (!verifiedPoc) return res.status(409).json({ code: 'POC_SELECTION_STALE', error: 'Selected POC evidence is stale or changed. Refresh discovered POCs and select the contact again.' })
    if (typeof body !== 'string' || !body.trim() || (channel === 'email' && (typeof subject !== 'string' || !subject.trim()))) return res.status(400).json({ error: 'A message body and email subject are required.' })
    const pocId = `${verifiedPoc.name.toLowerCase()}|${verifiedPoc.sourceUrl}`
    if ((await GoogleSheetsService.getOutreach()).some(item => item.leadId === gate.lead.id && item.pocId === pocId && item.channel === channel && item.body === body.trim() && !['REJECTED'].includes(item.status))) {
      return res.status(409).json({ error: 'This draft already exists.' })
    }
    const draft = {
      prospectName: verifiedPoc.name, email: null, company: gate.lead.company, subject: typeof subject === 'string' ? subject.trim() : '',
      body: body.trim(), status: 'DRAFT' as const, leadId: gate.lead.id, pocId,
      poc: { name: verifiedPoc.name, role: verifiedPoc.role, department: verifiedPoc.department, relevance: verifiedPoc.relevanceReason, profileUrl: verifiedPoc.profileUrl, sourceUrl: verifiedPoc.sourceUrl, confidence: verifiedPoc.confidence },
      channel, qualificationStatus: gate.lead.qualificationStatus as 'qualified' | 'needs_review',
      qualificationScore: gate.lead.qualificationScore ?? null, reviewRequired: gate.reviewRequired, reviewAcknowledged: false,
      contentRevision: 1, approvedRevision: null, clientDraftId: clientDraftId || undefined,
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
    if (typeof req.body?.expectedUpdatedAt !== 'string') return res.status(400).json({ error: 'Current outreach revision is required. Reload and retry.' })
    if (req.body.expectedUpdatedAt !== item.updatedAt) return res.status(409).json({ error: 'Outreach changed since it was loaded. Reload and review the current revision.' })
    const editing = req.body.body !== undefined || req.body.subject !== undefined || req.body.email !== undefined
    if (editing && req.body.status !== undefined) return res.status(400).json({ error: 'Save content or recipient edits separately before changing approval status.' })
    if (editing) {
      if (!['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED'].includes(item.status)) return res.status(409).json({ error: 'Sent or delivery-pending content cannot be edited.' })
      const email = req.body.email === undefined ? item.email : req.body.email
      if (email !== null && (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))) return res.status(400).json({ error: 'Enter a valid recipient email or leave it unknown.' })
      if (email !== item.email && email && req.body.recipientConfirmed !== true) return res.status(400).json({ error: 'Confirm the manually entered recipient email before saving.' })
      const candidate = { ...item, body: typeof req.body.body === 'string' ? req.body.body.trim() : item.body, subject: typeof req.body.subject === 'string' ? req.body.subject.trim() : item.subject, email: typeof email === 'string' ? email.trim() : null }
      const qualityChecks = checkOutreachQuality(candidate)
      if (qualityChecks.some(check => check.status === 'BLOCKED')) return res.status(400).json({ error: 'Message failed required quality checks.', qualityChecks })
      if (candidate.body === item.body && candidate.subject === item.subject && candidate.email === item.email) return res.json(item)
      const updated = await GoogleSheetsService.updateOutreach(item.id, {
        body: candidate.body, subject: candidate.subject, email: candidate.email, qualityChecks,
        status: 'DRAFT', approvedRevision: null, approvedAt: undefined, reviewAcknowledged: false,
        contentRevision: (item.contentRevision || 1) + 1,
        recipientConfirmedAt: candidate.email ? new Date().toISOString() : null,
        recipientSource: candidate.email ? 'MANUALLY_CONFIRMED' : null,
      }, item.updatedAt)
      return res.json(updated)
    }
    const status = req.body.status as SheetOutreach['status']
    if (!allowedOutreachTransition(item.status, status)) return res.status(409).json({ error: 'Invalid outreach status transition.' })
    const gate = ['REJECTED', 'DRAFT'].includes(status) ? null : await checkOutreachQualification(item.leadId, item.company)
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
        approvedRevision: null, approvedAt: undefined,
      }, item.updatedAt)
      return res.json(updated)
    }
    if (status === 'DELIVERY_READY') {
      if (item.channel === 'email') return res.status(409).json({ error: 'Email requires explicit Gmail sending; delivery-ready is not proof of sending.' })
      if (!deliveryTargetAvailable(item)) return res.status(409).json({ error: 'Recipient is unknown for this channel; the approved record cannot become delivery-ready.' })
      if (item.approvedRevision !== (item.contentRevision || 1)) return res.status(409).json({ error: 'The current content must be approved before delivery readiness.' })
      const deliveryReadyAt = new Date().toISOString()
      const updated = await GoogleSheetsService.updateOutreach(item.id, { status, deliveryReadyAt }, item.updatedAt)
      const sequences = (await GoogleSheetsService.getSequences()).filter(sequence => sequence.outreachId === item.id)
      for (const sequence of sequences) {
        const steps = sequence.steps.map(step => step.step === 1
          ? { ...step, status: 'DELIVERY_READY' as const, deliveryReadyAt, updatedAt: deliveryReadyAt }
          : step)
        await GoogleSheetsService.updateSequence(sequence.id, { cadenceAnchorAt: deliveryReadyAt, steps })
      }
      return res.json(updated)
    }
    if (status === 'APPROVED') {
      const qualityChecks = checkOutreachQuality(item)
      if (qualityChecks.some(check => check.status === 'BLOCKED')) return res.status(400).json({ error: 'Draft failed required quality checks.', qualityChecks })
    }
    const updated = await GoogleSheetsService.updateOutreach(item.id, {
      status,
      ...(status === 'APPROVED' ? { approvedAt: new Date().toISOString(), approvedBy: null, approvedRevision: item.contentRevision || 1 } : {}),
      ...(status === 'REJECTED' || status === 'DRAFT' ? { approvedRevision: null, approvedAt: undefined, reviewAcknowledged: false } : {}),
    }, item.updatedAt)
    return res.json(updated)
  } catch (err) {
    if (err instanceof MeetingWorkflowConflictError) return res.status(409).json({ error: err.message })
    res.status(500).json({ error: 'Failed to update outreach status', details: String(err) })
  }
})

sheetsRouter.get('/follow-up-sequences', async (_req, res) => {
  const sequences = await GoogleSheetsService.getSequences()
  res.json({ total: sequences.length, sequences })
})

sheetsRouter.get('/follow-up-sequences/scheduler-status', (_req, res) => {
  res.json({ enabled: process.env.FOLLOW_UP_SCHEDULER_ENABLED?.trim().toLowerCase() === 'true' })
})

sheetsRouter.post('/follow-up-sequences/process-due', async (_req, res) => {
  if (process.env.NODE_ENV === 'production') return res.status(404).json({ error: 'Manual due-step processing is available only in non-production environments.' })
  try {
    const result = await processDueFollowUps()
    return res.json(result)
  } catch {
    return res.status(500).json({ error: 'Due follow-up processing is unavailable.' })
  }
})

sheetsRouter.post('/follow-up-sequences', async (req, res) => {
  const outreachId = typeof req.body?.outreachId === 'string' ? req.body.outreachId : ''
  const outreach = (await GoogleSheetsService.getOutreach()).find(item => item.id === outreachId)
  if (!outreach) return res.status(404).json({ error: 'Outreach record not found.' })
  if ((outreach.channel === 'email' ? outreach.status !== 'SENT' : !['APPROVED', 'DELIVERY_READY'].includes(outreach.status)) || !outreach.leadId) return res.status(409).json({ error: outreach.channel === 'email' ? 'Confirm Gmail sending before creating an email cadence.' : 'Approve a persisted real-lead outreach draft before creating a sequence.' })
  const gate = await checkOutreachQualification(outreach.leadId, outreach.company)
  if (gate && gate.error) return res.status(gate.status).json({ error: gate.error })
  if (!gate?.lead) return res.status(409).json({ error: 'The associated stored lead is unavailable.' })
  try {
    const sequence = await GoogleSheetsService.createSequence(outreach)
    const automationEligible = Boolean(normalizeCadenceAnchorAt(sequence.cadenceAnchorAt))
    return res.status(201).json({
      ...sequence,
      automationEligible,
      ...(!automationEligible ? { automationReason: sequence.anchorPolicy === 'GMAIL_SENT' ? 'Initial Gmail sending must be confirmed before follow-up processing.' : 'Initial outreach must be DELIVERY_READY with a valid deliveryReadyAt before automatic follow-up processing is eligible.' } : {}),
    })
  } catch (err) {
    return res.status(409).json({ error: err instanceof Error ? err.message : 'Could not create follow-up sequence.' })
  }
})

sheetsRouter.patch('/follow-up-sequences/:id', async (req, res) => {
  const status = req.body?.status
  if (!sequenceStatusAllowed(status)) return res.status(400).json({ error: 'Invalid follow-up sequence status.' })
  const sequence = (await GoogleSheetsService.getSequences()).find(item => item.id === req.params.id)
  if (!sequence) return res.status(404).json({ error: 'Follow-up sequence not found.' })
  if (typeof req.body?.expectedUpdatedAt !== 'string' || req.body.expectedUpdatedAt !== sequence.updatedAt) return res.status(409).json({ error: 'Sequence changed since it was loaded. Reload and review its state.' })
  if (['REPLIED', 'MEETING_BOOKED', 'STOPPED', 'COMPLETED'].includes(sequence.status) && status !== sequence.status) return res.status(409).json({ error: 'A stopped sequence cannot be reactivated.' })
  try { return res.json(await GoogleSheetsService.updateSequence(sequence.id, { status }, sequence.updatedAt)) }
  catch (error) { return meetingWorkflowError(res, error) }
})

sheetsRouter.patch('/follow-up-sequences/:id/steps/:step', async (req, res) => {
  try {
  const sequence = (await GoogleSheetsService.getSequences()).find(item => item.id === req.params.id)
  if (!sequence) return res.status(404).json({ error: 'Follow-up sequence not found.' })
  if (typeof req.body?.expectedUpdatedAt !== 'string' || req.body.expectedUpdatedAt !== sequence.updatedAt) return res.status(409).json({ error: 'Sequence changed since it was loaded. Reload and review the current step.' })
  if (sequence.status !== 'ACTIVE') return res.status(409).json({ error: 'Paused or stopped sequences cannot progress.' })
  const number = Number(req.params.step)
  const step = sequence.steps.find(item => item.step === number)
  if (!step || number === 1) return res.status(404).json({ error: 'Follow-up step not found.' })
  const status = req.body?.status as SheetFollowUpStep['status']
  if (status && (req.body?.body !== undefined || req.body?.subject !== undefined)) return res.status(400).json({ error: 'Save draft edits separately before changing approval status.' })
  if (status && !['REJECTED', 'DRAFT'].includes(status)) {
    const gate = await checkOutreachQualification(sequence.leadId, sequence.company)
    if (!gate || 'error' in gate) return res.status(gate?.status || 409).json({ error: gate?.error || 'Qualification is required.' })
    const initial = (await GoogleSheetsService.getOutreach()).find(item => item.id === sequence.outreachId)
    if (gate.reviewRequired && initial?.reviewAcknowledged !== true) return res.status(409).json({ error: 'NEEDS REVIEW qualification must be acknowledged on the initial outreach before follow-up approval.' })
    const predecessor = sequence.steps.find(item => item.step === number - 1)
    if (predecessor?.status !== requiredPredecessorStatus(sequence)) return res.status(409).json({ error: sequence.anchorPolicy === 'GMAIL_SENT' ? 'The previous step must be confirmed SENT.' : 'Immediate predecessor must be delivery-ready before this step can progress.' })
  }
  if (status === 'PENDING_APPROVAL') {
    if (!allowedFollowUpStepTransition(step.status, status) || !step.body.trim() || (sequence.anchorPolicy === 'GMAIL_SENT' && !step.subject.trim())) return res.status(409).json({ error: 'A generated follow-up draft with subject and body is required.' })
  } else if (status === 'APPROVED') {
    if (!allowedFollowUpStepTransition(step.status, status)) return res.status(409).json({ error: 'Follow-up must be pending approval.' })
  } else if (status === 'DELIVERY_READY') {
    if (!allowedFollowUpStepTransition(step.status, status)) return res.status(409).json({ error: 'Follow-up must be approved first.' })
    if (sequence.anchorPolicy === 'GMAIL_SENT') return res.status(409).json({ error: 'Email follow-ups require explicit Gmail sending.' })
    const initial = (await GoogleSheetsService.getOutreach()).find(item => item.id === sequence.outreachId)
    if (!initial || !deliveryTargetAvailable(initial)) return res.status(409).json({ error: 'The recipient is unknown for this channel; the follow-up cannot become delivery-ready.' })
  } else if (status === 'REJECTED') {
    if (!allowedFollowUpStepTransition(step.status, status)) return res.status(409).json({ error: 'Follow-up must be pending approval.' })
  } else if (status === 'DRAFT') {
    if (!allowedFollowUpStepTransition(step.status, status)) return res.status(409).json({ error: 'Only a rejected follow-up can be reopened as a draft.' })
  } else if (req.body?.body !== undefined || req.body?.subject !== undefined) {
    if (!['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED'].includes(step.status)) return res.status(409).json({ error: 'Sent or delivery-pending follow-ups cannot be edited.' })
  } else return res.status(400).json({ error: 'Invalid follow-up step transition.' })
  const contentChanged = (typeof req.body?.body === 'string' && req.body.body !== step.body) || (typeof req.body?.subject === 'string' && req.body.subject !== step.subject)
  const steps = sequence.steps.map(item => item.id === step.id ? {
    ...item,
    ...(typeof req.body?.body === 'string' ? { body: req.body.body } : {}),
    ...(typeof req.body?.subject === 'string' ? { subject: req.body.subject } : {}),
    ...(contentChanged ? { status: 'DRAFT' as const, contentRevision: (item.contentRevision || 1) + 1, approvedRevision: null, approvedAt: undefined } : {}),
    ...(status ? { status, ...(status === 'APPROVED' ? { approvedAt: new Date().toISOString(), approvedRevision: item.contentRevision || 1 } : {}), ...(status === 'DELIVERY_READY' ? { deliveryReadyAt: new Date().toISOString() } : {}), ...(status === 'REJECTED' || status === 'DRAFT' ? { approvedRevision: null, approvedAt: undefined } : {}) } : {}),
    updatedAt: new Date().toISOString(),
  } : item)
  const updated = await GoogleSheetsService.updateSequence(sequence.id, { steps }, sequence.updatedAt)
  return res.json({ sequence: updated, step: updated?.steps.find(item => item.id === step.id) })
  } catch (err) { return meetingWorkflowError(res, err) }
})
