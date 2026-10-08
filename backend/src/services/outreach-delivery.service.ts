import { randomUUID } from 'crypto'
import { GmailError, GmailService } from './gmail.service'
import { checkOutreachQualification } from './qualification-guard.service'
import { GoogleSheetsService, type SheetFollowUpSequence, type SheetOutreach } from './sheets.service'
import { requiredPredecessorStatus } from './outreach-workflow.service'

export class DeliveryValidationError extends Error {
  constructor(message: string, readonly status = 409) { super(message) }
}

const sending = new Set<string>()
function claim(key: string) {
  if (sending.has(key)) throw new DeliveryValidationError('This message is already being sent.')
  sending.add(key)
  return () => sending.delete(key)
}

function requireRevision(expected: unknown, current: string | undefined) {
  if (typeof expected !== 'string' || !current || expected !== current) throw new DeliveryValidationError('Record changed since preview. Reload and confirm the current content.')
}

function requireConnection() {
  const status = GmailService.status()
  if (!status.connected || !status.senderEmail) throw new DeliveryValidationError('Connect Gmail before sending.')
  return status.senderEmail
}

function requireRecipient(item: SheetOutreach) {
  if (!item.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item.email) || item.recipientSource !== 'MANUALLY_CONFIRMED' || !item.recipientConfirmedAt) {
    throw new DeliveryValidationError('Enter and confirm the selected POC recipient email before sending.')
  }
  return item.email
}

async function requireQualification(item: SheetOutreach) {
  const gate = await checkOutreachQualification(item.leadId, item.company)
  if (!gate || 'error' in gate) throw new DeliveryValidationError(gate?.error || 'Qualification is unavailable.')
  if (gate.reviewRequired && item.reviewAcknowledged !== true) throw new DeliveryValidationError('NEEDS REVIEW requires explicit acknowledgement before sending.')
}

export async function sendApprovedOutreach(id: string, expectedUpdatedAt: unknown, confirmed: unknown) {
  if (confirmed !== true) throw new DeliveryValidationError('Preview and explicitly confirm the send.', 400)
  const release = claim(`outreach:${id}`)
  try {
    const item = (await GoogleSheetsService.getOutreach()).find(record => record.id === id)
    if (!item) throw new DeliveryValidationError('Outreach record not found.', 404)
    requireRevision(expectedUpdatedAt, item.updatedAt)
    if (item.status !== 'APPROVED' || item.channel !== 'email') throw new DeliveryValidationError('Only an approved email can be sent through Gmail.')
    if (item.approvedRevision !== (item.contentRevision || 1)) throw new DeliveryValidationError('Current content and recipient require fresh human approval.')
    const to = requireRecipient(item)
    const senderEmail = requireConnection()
    await requireQualification(item)
    const attemptId = randomUUID()
    const reserved = await GoogleSheetsService.updateOutreach(id, { status: 'SENDING', sendAttemptId: attemptId, sendStartedAt: new Date().toISOString(), senderEmail }, item.updatedAt)
    if (!reserved) throw new DeliveryValidationError('Outreach record not found.', 404)
    try {
      const confirmation = await GmailService.send({ to, subject: item.subject, body: item.body })
      return await GoogleSheetsService.confirmOutreachSent(id, attemptId, confirmation)
    } catch (error) {
      if (error instanceof GmailError) {
        await GoogleSheetsService.updateOutreach(id, { status: error.ambiguous ? 'DELIVERY_UNKNOWN' : 'APPROVED' })
        throw error
      }
      // A local persistence failure after provider acceptance is ambiguous; leave SENDING locked.
      throw new GmailError('Delivery outcome is unknown. Check Gmail and the stored record before retrying.', true)
    }
  } finally { release() }
}

export async function sendApprovedFollowUp(sequenceId: string, stepNumber: number, expectedUpdatedAt: unknown, confirmed: unknown) {
  if (confirmed !== true) throw new DeliveryValidationError('Preview and explicitly confirm the send.', 400)
  const release = claim(`follow-up:${sequenceId}:${stepNumber}`)
  try {
    const sequence = (await GoogleSheetsService.getSequences()).find(item => item.id === sequenceId)
    if (!sequence) throw new DeliveryValidationError('Follow-up sequence not found.', 404)
    requireRevision(expectedUpdatedAt, sequence.updatedAt)
    if (sequence.status !== 'ACTIVE' || sequence.anchorPolicy !== 'GMAIL_SENT') throw new DeliveryValidationError('Only active Gmail-anchored sequences can send follow-ups.')
    const step = sequence.steps.find(item => item.step === stepNumber)
    if (!step || stepNumber < 2 || step.status !== 'APPROVED' || step.approvedRevision !== (step.contentRevision || 1)) throw new DeliveryValidationError('The current follow-up revision needs human approval.')
    const predecessor = sequence.steps.find(item => item.step === stepNumber - 1)
    if (predecessor?.status !== requiredPredecessorStatus(sequence)) throw new DeliveryValidationError('The previous step must be confirmed SENT.')
    const initial = (await GoogleSheetsService.getOutreach()).find(item => item.id === sequence.outreachId)
    if (!initial || initial.status !== 'SENT' || initial.leadId !== sequence.leadId) throw new DeliveryValidationError('The initial message has not been confirmed sent.')
    const to = requireRecipient(initial)
    requireConnection()
    await requireQualification(initial)
    const attemptId = randomUUID()
    const steps = sequence.steps.map(item => item.id === step.id ? { ...item, status: 'SENDING' as const, sendAttemptId: attemptId, sendStartedAt: new Date().toISOString() } : item)
    const reserved = await GoogleSheetsService.updateSequence(sequenceId, { steps }, sequence.updatedAt)
    if (!reserved) throw new DeliveryValidationError('Follow-up sequence not found.', 404)
    try {
      const sameSubject = step.subject.trim() === initial.subject.trim()
      const confirmation = await GmailService.send({ to, subject: step.subject, body: step.body, ...(sameSubject && predecessor?.gmailThreadId && predecessor.rfcMessageId ? { threadId: predecessor.gmailThreadId, inReplyTo: predecessor.rfcMessageId } : {}) })
      const saved = await GoogleSheetsService.confirmFollowUpSent(sequenceId, stepNumber, attemptId, confirmation)
      return { sequence: saved, step: saved.steps.find(item => item.id === step.id) }
    } catch (error) {
      if (error instanceof GmailError) {
        const latest = (await GoogleSheetsService.getSequences()).find(item => item.id === sequenceId)
        if (latest) await GoogleSheetsService.updateSequence(sequenceId, { steps: latest.steps.map(item => item.id === step.id ? { ...item, status: error.ambiguous ? 'DELIVERY_UNKNOWN' as const : 'APPROVED' as const } : item) }, latest.updatedAt)
        throw error
      }
      throw new GmailError('Follow-up delivery outcome is unknown. Check Gmail before retrying.', true)
    }
  } finally { release() }
}

export function deliveryError(error: unknown) {
  if (error instanceof DeliveryValidationError || error instanceof GmailError) return { status: error.status, error: error.message }
  return { status: 500, error: 'Delivery operation failed. Check the saved state before retrying.' }
}
