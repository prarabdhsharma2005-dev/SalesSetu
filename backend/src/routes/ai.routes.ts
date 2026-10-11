import { Router } from 'express'
import { GeminiMalformedMeetingMomError, SalesGeminiService } from '../services/gemini.service'
import { checkOutreachQualification } from '../services/qualification-guard.service'
import { GoogleSheetsService } from '../services/sheets.service'
import { TavilyService } from '../services/tavily.service'
import { buildFollowUpContext, canGenerateSequenceStep, claimFollowUpDraft, followUpAssociationValid, isFollowUpStepNumber, requiredPredecessorStatus } from '../services/outreach-workflow.service'
import { MeetingWorkflowConflictError, MeetingWorkflowValidationError, parseMomGenerationRequest } from '../services/meeting-workflow.service'
import { POCVerificationCache } from '../services/poc-verification-cache.service'
import { calculateFollowUpDueAt } from '../services/follow-up-automation.service'
import { workspaceMode } from '../services/workspace-context.service'
import { geminiQuotaDetails } from '../services/provider-quota.service'

export const aiRouter = Router()

aiRouter.get('/test', async (_req, res) => {
  if (workspaceMode()) return res.status(404).json({ error: 'Provider diagnostics are unavailable in private workspaces.' })
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
  const salesContext = workspaceMode() ? await GoogleSheetsService.getSalesContext() : null
  if (workspaceMode() && !salesContext) return res.status(409).json({ code: 'SELLER_CONTEXT_REQUIRED', error: 'Save your seller and product context in Outreach before drafting.' })
  const savedResearch = gate.lead.companyResearch
  if (workspaceMode() && (!savedResearch?.summary?.trim() || !savedResearch.sources?.some(source => /^https?:\/\//i.test(source.url)))) {
    return res.status(409).json({ code: 'COMPANY_RESEARCH_REQUIRED', error: 'Research this saved lead and review its sources before drafting.' })
  }
  const poc = prospect.poc
  if (!poc || typeof poc.name !== 'string' || typeof poc.sourceUrl !== 'string') {
    return res.status(400).json({ error: 'Select a discovered, sourced POC before generating outreach.' })
  }
  let providerStage: 'Gemini' | 'Tavily' = 'Gemini'
  try {
    let selected = poc.verificationToken === undefined
      ? POCVerificationCache.find(gate.lead.id, poc.name, poc.sourceUrl)
      : POCVerificationCache.verify(gate.lead, poc)
    if (!selected && poc.verificationToken === undefined) {
      try {
        const discovered = await TavilyService.searchPOCs(gate.lead.company, gate.lead.website)
        const verifiedPocs = await SalesGeminiService.identifyPOCs({ name: gate.lead.company, website: gate.lead.website }, discovered)
        selected = verifiedPocs.find(item => item.name === poc.name && item.sourceUrl === poc.sourceUrl) || null
      } catch {
        return res.status(503).json({ code: 'POC_VERIFICATION_UNAVAILABLE', error: 'POC verification provider is unavailable. No draft was generated.' })
      }
    }
    if (!selected) return res.status(409).json({ code: 'POC_SELECTION_STALE', error: 'Selected POC evidence is stale or changed. Refresh discovered POCs and select the contact again.' })
    let research: { summary: string; sources: Array<{ title: string; url: string }> } | undefined = savedResearch
    if (!workspaceMode()) {
      providerStage = 'Tavily'
      const researchResults = await TavilyService.searchCompany(gate.lead.company, gate.lead.website)
      if (researchResults.length === 0) return res.status(503).json({ error: 'Company research is unavailable; no evidence-backed outreach draft was generated.' })
      providerStage = 'Gemini'
      research = await SalesGeminiService.researchCompany({
        name: gate.lead.company, website: gate.lead.website, industry: gate.lead.industry,
        city: gate.lead.city, country: gate.lead.country, intentSignal: gate.lead.intentSignal,
      }, researchResults)
    }
    if (!research) return res.status(409).json({ error: 'Research this saved lead before drafting.' })
    const sourced = savedResearch?.facts
    const sourcedIntent = gate.lead.qualificationEvidence?.some(item => item.criterion.includes('intent') && item.origin === 'source_backed' && Boolean(item.sourceUrl))
    const result = await SalesGeminiService.draftPersonalizedEmail({
      name: selected.name, title: selected.role || '', pocDepartment: selected.department,
      pocRelevance: selected.relevanceReason, company: gate.lead.company,
      industry: workspaceMode() ? String(sourced?.industry?.value || '') : gate.lead.industry,
      location: workspaceMode() ? String(sourced?.city?.value || '') : [gate.lead.city, gate.lead.country].filter(Boolean).join(', '),
      employees: workspaceMode() ? sourced?.employees?.value : gate.lead.employees,
      intentSignal: workspaceMode() && !sourcedIntent ? '' : gate.lead.intentSignal,
      intentEvidence: gate.lead.qualificationEvidence?.filter(item => item.criterion.includes('intent') && (!workspaceMode() || item.origin === 'source_backed')).map(item => item.value).join('; '),
      researchSummary: research.summary, researchSources: research.sources.map(source => source.url),
      qualificationStatus: gate.lead.qualificationStatus,
      qualificationScore: gate.lead.qualificationScore,
      qualificationReasons: gate.lead.qualificationReasons,
      qualificationEvidence: gate.lead.qualificationEvidence,
      channel: ['email', 'linkedin', 'whatsapp'].includes(prospect.channel) ? prospect.channel : 'email',
      tone: typeof prospect.tone === 'string' ? prospect.tone.slice(0, 40) : 'consultative',
      senderName: salesContext?.sellerName || (workspaceMode() ? null : process.env.SALES_SENDER_NAME?.trim() || null),
      senderCompany: salesContext?.sellerCompany || (workspaceMode() ? null : process.env.SALES_SENDER_COMPANY?.trim() || null),
      productName: salesContext?.productName || null,
      productDescription: salesContext?.productDescription || null,
    })
    return res.json({ ...result, poc: selected, researchSources: research.sources, reviewRequired: gate.reviewRequired })
  } catch (err) {
    console.error('[Outreach] Evidence-backed draft generation failed:', err instanceof Error ? err.name : 'UNKNOWN_ERROR')
    if (typeof err === 'object' && err !== null && 'status' in err && err.status === 429) {
      if (providerStage === 'Tavily') return res.status(429).json({ code: 'SEARCH_PROVIDER_QUOTA', error: 'Company research search provider quota was reached. No draft was generated.' })
      const quota = geminiQuotaDetails(err)
      console.warn('[Outreach] Gemini quota:', quota)
      if (quota.retrySeconds) res.set('Retry-After', String(quota.retrySeconds))
      return res.status(429).json({ code: 'AI_QUOTA', error: 'Gemini quota or rate limit reached. No draft was generated.', ...quota })
    }
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
  if (!step || !isFollowUpStepNumber(stepNumber)) return res.status(400).json({ error: 'Follow-up step is invalid.' })
  if (sequence.status !== 'ACTIVE') return res.status(409).json({ error: 'Sequence is stopped or paused; no further follow-up can be generated.' })
  if (step.body.trim()) return res.status(409).json({ error: 'A draft already exists for this sequence step.' })
  if (!canGenerateSequenceStep(sequence, step)) return res.status(409).json({ error: 'Follow-up step is not available for drafting.' })
  const dueAt = calculateFollowUpDueAt(sequence.cadenceAnchorAt, step.dayOffset)
  if (!dueAt || Date.now() < Date.parse(dueAt)) return res.status(409).json({ error: dueAt ? `Follow-up is not due until ${dueAt}.` : 'Cadence is waiting for a confirmed initial send or legacy delivery-ready anchor.' })
  const release = claimFollowUpDraft(sequenceId, stepNumber)
  if (!release) return res.status(409).json({ error: 'This follow-up step is already being generated.' })
  try {
    const currentSequence = (await GoogleSheetsService.getSequences()).find(item => item.id === sequenceId)
    const currentStep = currentSequence?.steps.find(item => item.step === stepNumber)
    if (!currentSequence || !currentStep || !canGenerateSequenceStep(currentSequence, currentStep)) {
      return res.status(409).json({ error: 'This follow-up step already has a draft or is no longer available.' })
    }
    const currentDueAt = calculateFollowUpDueAt(currentSequence.cadenceAnchorAt, currentStep.dayOffset)
    if (!currentDueAt || Date.now() < Date.parse(currentDueAt)) return res.status(409).json({ error: 'Follow-up is no longer due.' })
    if (currentSequence.steps.find(item => item.step === stepNumber - 1)?.status !== requiredPredecessorStatus(currentSequence)) return res.status(409).json({ error: currentSequence.anchorPolicy === 'GMAIL_SENT' ? 'The previous step must be confirmed sent before generating this follow-up.' : 'The immediate predecessor must be delivery-ready before generating this follow-up.' })
    const gate = await checkOutreachQualification(currentSequence.leadId, currentSequence.company)
    if (!gate || 'error' in gate) return res.status(gate?.status || 409).json({ error: gate?.error || 'The associated stored lead is unavailable.' })
    const initial = await GoogleSheetsService.getOutreach().then(items => items.find(item => item.id === currentSequence.outreachId))
    if (!followUpAssociationValid(currentSequence, initial)) return res.status(409).json({ error: 'Initial lead or POC association changed. Review the sequence before drafting.' })
    const draft = await SalesGeminiService.draftFollowUp(buildFollowUpContext({
      initial: initial!, lead: gate.lead, sequence: currentSequence, step: currentStep, tone: 'consultative',
    }))
    const latestSequence = (await GoogleSheetsService.getSequences()).find(item => item.id === sequenceId)
    const latestStep = latestSequence?.steps.find(item => item.step === stepNumber)
    if (!latestSequence || !latestStep || !canGenerateSequenceStep(latestSequence, latestStep) || latestSequence.steps.find(item => item.step === stepNumber - 1)?.status !== requiredPredecessorStatus(latestSequence) || !calculateFollowUpDueAt(latestSequence.cadenceAnchorAt, latestStep.dayOffset) || Date.now() < Date.parse(calculateFollowUpDueAt(latestSequence.cadenceAnchorAt, latestStep.dayOffset)!)) {
      return res.status(409).json({ error: 'Follow-up state changed during generation; the draft was not saved.' })
    }
    const latestGate = await checkOutreachQualification(latestSequence.leadId, latestSequence.company)
    if (!latestGate || 'error' in latestGate) return res.status(409).json({ error: 'The associated stored lead changed during generation; the draft was not saved.' })
    const latestInitial = (await GoogleSheetsService.getOutreach()).find(item => item.id === latestSequence.outreachId)
    if (!followUpAssociationValid(latestSequence, latestInitial)) return res.status(409).json({ error: 'Initial lead or POC association changed during generation; the draft was not saved.' })
    const updatedSteps = latestSequence.steps.map(item => item.id === latestStep.id
      ? { ...item, ...draft, status: 'DRAFT' as const, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
      : item)
    const updated = await GoogleSheetsService.updateSequence(latestSequence.id, { steps: updatedSteps }, latestSequence.updatedAt)
    return res.json({ sequence: updated, step: updated?.steps.find(item => item.id === latestStep.id) })
  } catch (err) {
    console.error('[Outreach] Follow-up generation failed:', err instanceof Error ? err.name : 'UNKNOWN_ERROR')
    return res.status(503).json({ error: 'Follow-up generation is unavailable. No draft was generated.' })
  } finally {
    release()
  }
})

aiRouter.post('/meetings/:id/mom/generate', async (req, res) => {
  try {
    const request = parseMomGenerationRequest(req.body)
    const workflow = await GoogleSheetsService.getMeetingWorkflow(req.params.id)
    if (!workflow) return res.status(404).json({ error: 'Meeting not found.' })
    const generated = await SalesGeminiService.extractMoM({
      notes: request.notes,
      meeting: {
        id: workflow.meeting.id, title: workflow.meeting.title, company: workflow.meeting.company,
        pocName: workflow.meeting.poc?.name || null, scheduledAt: workflow.meeting.scheduledAt || null,
        meetingType: workflow.meeting.meetingType || null,
      },
    })
    const mom = await GoogleSheetsService.saveGeneratedMeetingMom(req.params.id, {
      ...request, replaceExisting: request.replaceExisting ?? false, replaceReviewed: request.replaceReviewed ?? false, generated,
    })
    if (!mom) return res.status(404).json({ error: 'Meeting not found.' })
    return res.json(mom)
  } catch (err) {
    if (err instanceof MeetingWorkflowValidationError) return res.status(400).json({ error: err.message })
    if (err instanceof MeetingWorkflowConflictError) return res.status(409).json({ error: err.message })
    if (err instanceof GeminiMalformedMeetingMomError) return res.status(502).json({ error: err.message })
    console.error('[MeetingMoM] Draft generation failed:', err instanceof Error ? err.name : 'UNKNOWN_ERROR')
    return res.status(503).json({ error: 'Meeting MoM generation is unavailable. No draft was saved.' })
  }
})

aiRouter.post('/extract-mom', (_req, res) => {
  return res.status(400).json({ error: 'A stored meeting ID is required. Use the meeting MoM generation workflow.' })
})
