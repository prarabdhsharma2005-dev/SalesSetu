import type { SheetOutreach, SheetFollowUpSequence, SheetFollowUpStep } from './sheets.service'

export type QualityCheck = NonNullable<SheetOutreach['qualityChecks']>[number]

function isHttpUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

function hasEmailAddress(value: unknown): value is string {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

export function checkOutreachQuality(item: Pick<SheetOutreach, 'leadId' | 'prospectName' | 'company' | 'email' | 'subject' | 'body' | 'channel' | 'poc'>): QualityCheck[] {
  const hasSourcedPoc = Boolean(item.poc?.name?.trim() && isHttpUrl(item.poc.sourceUrl))
  const hasPlaceholder = /prospect@company\.com|decision maker|target account|\[insert|\{\{.*\}\}/i.test(`${item.email || ''} ${item.prospectName} ${item.company} ${item.subject} ${item.body}`)
  const checks: QualityCheck[] = [
    { key: 'lead', status: item.leadId?.trim() ? 'PASS' : 'BLOCKED', message: item.leadId?.trim() ? 'Stored lead is associated.' : 'A stored lead is required.' },
    { key: 'company', status: item.company.trim() ? 'PASS' : 'BLOCKED', message: item.company.trim() ? 'Company is present.' : 'Company is required.' },
    { key: 'poc', status: hasSourcedPoc ? 'PASS' : 'BLOCKED', message: hasSourcedPoc ? 'Selected POC includes a valid source URL.' : 'Select a discovered POC with a valid source URL.' },
    { key: 'recipient', status: item.channel === 'email' ? (hasEmailAddress(item.email) ? 'PASS' : 'WARNING') : item.channel === 'linkedin' ? (isHttpUrl(item.poc?.profileUrl) ? 'PASS' : 'WARNING') : 'WARNING', message: item.channel === 'email' ? (hasEmailAddress(item.email) ? 'Recipient email is present; verify it before delivery.' : 'Recipient email is unknown; delivery readiness is blocked.') : item.channel === 'linkedin' ? (isHttpUrl(item.poc?.profileUrl) ? 'Sourced profile URL is present.' : 'Profile URL is unknown; delivery readiness is blocked.') : 'No phone number is available; delivery readiness is blocked.' },
    { key: 'channel', status: ['email', 'linkedin', 'whatsapp'].includes(item.channel || '') ? 'PASS' : 'BLOCKED', message: ['email', 'linkedin', 'whatsapp'].includes(item.channel || '') ? 'A supported draft channel is selected.' : 'Select a supported draft channel.' },
    { key: 'message', status: item.body.trim() ? 'PASS' : 'BLOCKED', message: item.body.trim() ? 'Message is non-empty.' : 'Message body is required.' },
    ...(item.channel === 'email' ? [{ key: 'subject', status: item.subject.trim() ? 'PASS' as const : 'BLOCKED' as const, message: item.subject.trim() ? 'Email subject is present.' : 'Email subject is required.' }] : []),
    { key: 'placeholders', status: hasPlaceholder ? 'BLOCKED' : 'PASS', message: hasPlaceholder ? 'Obvious placeholder content must be replaced.' : 'No obvious placeholder content found.' },
    { key: 'factual-claims', status: 'WARNING', message: 'Factual claims are not automatically verified; check them against the supplied evidence before approval.' },
  ]
  return checks
}

export function reviewAcknowledgementAllowed(alreadyAcknowledged: boolean | undefined, reviewRequired: boolean, requestAcknowledgement: unknown): boolean {
  return !reviewRequired || alreadyAcknowledged === true || requestAcknowledgement === true
}

export function allowedOutreachTransition(current: SheetOutreach['status'], next: SheetOutreach['status']): boolean {
  if (current === 'DRAFT') return next === 'PENDING_APPROVAL'
  if (current === 'PENDING' || current === 'PENDING_APPROVAL') return next === 'APPROVED' || next === 'REJECTED'
  if (current === 'APPROVED') return next === 'DELIVERY_READY'
  return false
}

export function deliveryTargetAvailable(item: SheetOutreach): boolean {
  if (item.channel === 'email') return hasEmailAddress(item.email)
  if (item.channel === 'linkedin') return isHttpUrl(item.poc?.profileUrl)
  return false
}

export function canGenerateSequenceStep(sequence: SheetFollowUpSequence, step: SheetFollowUpStep): boolean {
  return sequence.status === 'ACTIVE' && [2, 3].includes(step.step) && step.status === 'DRAFT' && !step.body.trim()
}

export function sequenceStatusAllowed(status: unknown): status is SheetFollowUpSequence['status'] {
  return ['ACTIVE', 'PAUSED', 'REPLIED', 'MEETING_BOOKED', 'COMPLETED', 'STOPPED'].includes(String(status))
}
