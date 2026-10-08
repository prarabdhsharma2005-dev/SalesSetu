import { SalesGeminiService } from './gemini.service'
import { checkOutreachQualification } from './qualification-guard.service'
import {
  buildFollowUpContext,
  canGenerateSequenceStep,
  claimFollowUpDraft,
  isFollowUpStepNumber,
  requiredPredecessorStatus,
} from './outreach-workflow.service'
import {
  GoogleSheetsService,
  normalizeCadenceAnchorAt,
  type SheetFollowUpSequence,
  type SheetFollowUpStep,
} from './sheets.service'

const DAY_MS = 24 * 60 * 60 * 1000

export function calculateFollowUpDueAt(anchor: unknown, dayOffset: number): string | null {
  const normalizedAnchor = normalizeCadenceAnchorAt(anchor)
  if (!normalizedAnchor || !Number.isInteger(dayOffset) || dayOffset < 0) return null
  return new Date(Date.parse(normalizedAnchor) + dayOffset * DAY_MS).toISOString()
}

type FollowUpDraftContext = Parameters<typeof SalesGeminiService.draftFollowUp>[0]
type FollowUpDraft = Awaited<ReturnType<typeof SalesGeminiService.draftFollowUp>>
type QualificationResult = Awaited<ReturnType<typeof checkOutreachQualification>>

export interface FollowUpProcessingDetail {
  sequenceId: string
  step?: number
  outcome: 'processed' | 'skipped' | 'error'
  dueAt?: string
  reason?: string
  errorType?: string
}

export interface FollowUpProcessingResult {
  processed: number
  skipped: number
  errors: number
  details: FollowUpProcessingDetail[]
}

export interface FollowUpAutomationDependencies {
  getSequences: () => Promise<SheetFollowUpSequence[]>
  getOutreach: () => ReturnType<typeof GoogleSheetsService.getOutreach>
  updateSequence: (id: string, updates: Partial<SheetFollowUpSequence>, expectedUpdatedAt?: string) => ReturnType<typeof GoogleSheetsService.updateSequence>
  checkQualification: (leadId: unknown, company: unknown) => Promise<QualificationResult>
  draftFollowUp: (context: FollowUpDraftContext) => Promise<FollowUpDraft>
}

export interface ProcessDueFollowUpsOptions {
  /** Injectable clock/dependencies are used by focused tests; the API route supplies neither. */
  now?: Date
  dependencies?: Partial<FollowUpAutomationDependencies>
}

function ineligibilityReason(sequence: SheetFollowUpSequence, step: SheetFollowUpStep, now: Date): { reason: string; dueAt?: string } | null {
  if (sequence.status !== 'ACTIVE') return { reason: 'Sequence is not active.' }
  if (!isFollowUpStepNumber(step.step)) return { reason: 'Step is not an automatable follow-up.' }
  if (!canGenerateSequenceStep(sequence, step)) return { reason: 'Step already has content or is not an empty DRAFT.' }
  const anchor = normalizeCadenceAnchorAt(sequence.cadenceAnchorAt)
  if (!anchor) return { reason: sequence.anchorPolicy === 'GMAIL_SENT' ? 'Cadence waits for confirmed initial Gmail sending.' : 'Cadence anchor unavailable; initial outreach must be DELIVERY_READY with a valid deliveryReadyAt.' }
  const dueAt = calculateFollowUpDueAt(anchor, step.dayOffset)
  if (!dueAt) return { reason: 'Step due time is invalid.' }
  if (now.getTime() < Date.parse(dueAt)) return { reason: 'Step is not due yet.', dueAt }
  const predecessor = sequence.steps.find(candidate => candidate.step === step.step - 1)
  if (!predecessor || predecessor.status !== requiredPredecessorStatus(sequence)) return { reason: sequence.anchorPolicy === 'GMAIL_SENT' ? 'Preceding step has not been confirmed SENT.' : 'Preceding step is not delivery-ready.', dueAt }
  return null
}

function stepOf(sequence: SheetFollowUpSequence, stepNumber: number) {
  return sequence.steps.find(step => step.step === stepNumber)
}

/** Processes due steps into DRAFT only; Gmail cadence requires confirmed sending. */
export async function processDueFollowUps(options: ProcessDueFollowUpsOptions = {}): Promise<FollowUpProcessingResult> {
  const dependencies: FollowUpAutomationDependencies = {
    getSequences: () => GoogleSheetsService.getSequences(),
    getOutreach: () => GoogleSheetsService.getOutreach(),
    updateSequence: (id, updates, expectedUpdatedAt) => GoogleSheetsService.updateSequence(id, updates, expectedUpdatedAt),
    checkQualification: (leadId, company) => checkOutreachQualification(leadId, company),
    draftFollowUp: context => SalesGeminiService.draftFollowUp(context),
    ...options.dependencies,
  }
  const now = options.now ? new Date(options.now) : new Date()
  const result: FollowUpProcessingResult = { processed: 0, skipped: 0, errors: 0, details: [] }
  const sequences = await dependencies.getSequences()

  for (const sequence of sequences) {
    if (sequence.status !== 'ACTIVE') {
      result.skipped += 1
      result.details.push({ sequenceId: sequence.id, outcome: 'skipped', reason: 'Sequence is not active.' })
      continue
    }

    if (!normalizeCadenceAnchorAt(sequence.cadenceAnchorAt)) {
      result.skipped += 1
      result.details.push({
        sequenceId: sequence.id,
        outcome: 'skipped',
        reason: sequence.anchorPolicy === 'GMAIL_SENT' ? 'Cadence waits for confirmed initial Gmail sending.' : 'Cadence anchor unavailable; initial outreach must be DELIVERY_READY with a valid deliveryReadyAt.',
      })
      continue
    }

    for (const snapshotStep of sequence.steps.filter(candidate => candidate.step > 1)) {
      const snapshotReason = ineligibilityReason(sequence, snapshotStep, now)
      if (snapshotReason) {
        result.skipped += 1
        result.details.push({ sequenceId: sequence.id, step: snapshotStep.step, outcome: 'skipped', ...snapshotReason })
        continue
      }

      const release = claimFollowUpDraft(sequence.id, snapshotStep.step)
      if (!release) {
        result.skipped += 1
        result.details.push({ sequenceId: sequence.id, step: snapshotStep.step, outcome: 'skipped', reason: 'Step is already being processed in this server process.' })
        continue
      }

      try {
        // Re-read after claiming so repeated endpoint calls observe prior saves/state changes.
        let currentSequence = (await dependencies.getSequences()).find(candidate => candidate.id === sequence.id)
        let currentStep = currentSequence && stepOf(currentSequence, snapshotStep.step)
        if (!currentSequence || !currentStep) {
          result.skipped += 1
          result.details.push({ sequenceId: sequence.id, step: snapshotStep.step, outcome: 'skipped', reason: 'Sequence step no longer exists.' })
          continue
        }
        const currentReason = ineligibilityReason(currentSequence, currentStep, now)
        if (currentReason) {
          result.skipped += 1
          result.details.push({ sequenceId: sequence.id, step: snapshotStep.step, outcome: 'skipped', ...currentReason })
          continue
        }

        const gate = await dependencies.checkQualification(currentSequence.leadId, currentSequence.company)
        if (!gate?.lead || 'error' in gate) {
          result.skipped += 1
          result.details.push({ sequenceId: sequence.id, step: snapshotStep.step, outcome: 'skipped', reason: gate && 'error' in gate ? gate.error : 'Qualification is unavailable.' })
          continue
        }
        const initial = (await dependencies.getOutreach()).find(item => item.id === currentSequence!.outreachId)
        if (!initial) {
          result.errors += 1
          result.details.push({ sequenceId: sequence.id, step: snapshotStep.step, outcome: 'error', reason: 'Initial outreach record was not found.' })
          continue
        }
        if (currentSequence.anchorPolicy === 'GMAIL_SENT' && initial.status !== 'SENT') {
          result.skipped += 1
          result.details.push({ sequenceId: sequence.id, step: snapshotStep.step, outcome: 'skipped', reason: 'Initial Gmail sending has not been confirmed.' })
          continue
        }

        const context = buildFollowUpContext({ initial, lead: gate.lead, sequence: currentSequence, step: currentStep, tone: 'consultative' })
        const draft = await dependencies.draftFollowUp(context)

        // Re-check state after the provider call; never save if a sequence was paused or advanced meanwhile.
        currentSequence = (await dependencies.getSequences()).find(candidate => candidate.id === sequence.id)
        currentStep = currentSequence && stepOf(currentSequence, snapshotStep.step)
        const afterGenerationReason = currentSequence && currentStep
          ? ineligibilityReason(currentSequence, currentStep, now)
          : { reason: 'Sequence step no longer exists.' }
        if (!currentSequence || !currentStep || afterGenerationReason) {
          result.skipped += 1
          result.details.push({ sequenceId: sequence.id, step: snapshotStep.step, outcome: 'skipped', ...(afterGenerationReason || { reason: 'Sequence step no longer exists.' }) })
          continue
        }
        const currentGate = await dependencies.checkQualification(currentSequence.leadId, currentSequence.company)
        if (!currentGate?.lead || 'error' in currentGate) {
          result.skipped += 1
          result.details.push({ sequenceId: sequence.id, step: snapshotStep.step, outcome: 'skipped', reason: 'Qualification changed or is unavailable; generated draft was not saved.' })
          continue
        }

        const timestamp = new Date().toISOString()
        const updatedSteps = currentSequence.steps.map(item => item.id === currentStep!.id
          ? { ...item, ...draft, status: 'DRAFT' as const, createdAt: timestamp, updatedAt: timestamp }
          : item)
        const updated = await dependencies.updateSequence(currentSequence.id, { steps: updatedSteps }, currentSequence.updatedAt)
        if (!updated) {
          result.errors += 1
          result.details.push({ sequenceId: sequence.id, step: snapshotStep.step, outcome: 'error', reason: 'Draft could not be persisted.' })
          continue
        }
        result.processed += 1
        result.details.push({ sequenceId: sequence.id, step: snapshotStep.step, outcome: 'processed', dueAt: calculateFollowUpDueAt(currentSequence.cadenceAnchorAt, currentStep.dayOffset) || undefined })
      } catch (error) {
        result.errors += 1
        result.details.push({ sequenceId: sequence.id, step: snapshotStep.step, outcome: 'error', errorType: error instanceof Error ? error.name : 'UNKNOWN_ERROR', reason: 'Follow-up draft generation or persistence failed.' })
      } finally {
        release()
      }
    }
  }

  return result
}
