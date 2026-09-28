import type { SheetOutreach, SheetFollowUpSequence, SheetFollowUpStep } from './sheets.service'

export type QualityCheck = NonNullable<SheetOutreach['qualityChecks']>[number]

export function checkOutreachQuality(item: Pick<SheetOutreach, 'leadId' | 'prospectName' | 'company' | 'email' | 'subject' | 'body' | 'channel' | 'poc'>): QualityCheck[] {
  const checks: QualityCheck[] = [
    { key: 'lead', status: item.leadId ? 'PASS' : 'BLOCKED', message: item.leadId ? 'Stored lead is associated.' : 'A stored lead is required.' },
    { key: 'company', status: item.company.trim() ? 'PASS' : 'BLOCKED', message: item.company.trim() ? 'Company is present.' : 'Company is required.' },
    { key: 'poc', status: item.poc?.name && item.poc.sourceUrl ? 'PASS' : 'BLOCKED', message: item.poc?.name && item.poc.sourceUrl ? 'Selected POC includes a source.' : 'Select a discovered POC with a source.' },
    { key: 'recipient', status: item.channel === 'email' ? (item.email ? 'PASS' : 'WARNING') : item.channel === 'linkedin' ? (item.poc?.profileUrl ? 'PASS' : 'WARNING') : 'WARNING', message: item.channel === 'email' ? (item.email ? 'Recipient email is present.' : 'Recipient email is unknown; delivery readiness is blocked.') : item.channel === 'linkedin' ? (item.poc?.profileUrl ? 'Sourced profile URL is present.' : 'Profile URL is unknown; delivery readiness is blocked.') : 'No verified phone number is available; delivery readiness is blocked.' },
    { key: 'message', status: item.body.trim() ? 'PASS' : 'BLOCKED', message: item.body.trim() ? 'Message is non-empty.' : 'Message body is required.' },
    ...(item.channel === 'email' ? [{ key: 'subject', status: item.subject.trim() ? 'PASS' as const : 'BLOCKED' as const, message: item.subject.trim() ? 'Email subject is present.' : 'Email subject is required.' }] : []),
    { key: 'placeholders', status: /prospect@company\.com|decision maker|target account|\[insert|\{\{.*\}\}/i.test(`${item.email || ''} ${item.prospectName} ${item.company} ${item.subject} ${item.body}`) ? 'BLOCKED' : 'PASS', message: /prospect@company\.com|decision maker|target account|\[insert|\{\{.*\}\}/i.test(`${item.email || ''} ${item.prospectName} ${item.company} ${item.subject} ${item.body}`) ? 'Obvious placeholder content must be replaced.' : 'No obvious placeholder content found.' },
  ]
  return checks
}

export function allowedOutreachTransition(current: SheetOutreach['status'], next: SheetOutreach['status']): boolean {
  if (current === 'DRAFT') return next === 'PENDING_APPROVAL'
  if (current === 'PENDING' || current === 'PENDING_APPROVAL') return next === 'APPROVED' || next === 'REJECTED'
  if (current === 'APPROVED') return next === 'DELIVERY_READY'
  return false
}

export function deliveryTargetAvailable(item: SheetOutreach): boolean {
  if (item.channel === 'email') return Boolean(item.email?.trim())
  if (item.channel === 'linkedin') return Boolean(item.poc?.profileUrl)
  return false
}

export function canGenerateSequenceStep(sequence: SheetFollowUpSequence, step: SheetFollowUpStep): boolean {
  return sequence.status === 'ACTIVE' && [2, 3].includes(step.step) && step.status === 'DRAFT' && !step.body.trim()
}

export function sequenceStatusAllowed(status: unknown): status is SheetFollowUpSequence['status'] {
  return ['ACTIVE', 'PAUSED', 'REPLIED', 'MEETING_BOOKED', 'COMPLETED', 'STOPPED'].includes(String(status))
}
