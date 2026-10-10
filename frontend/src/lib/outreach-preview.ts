import type { OutreachItem, GmailConnection, Lead } from './api'

/** A read-only view of the saved revision. The send endpoint rechecks every condition. */
export function outreachPreview(item: OutreachItem, gmail: GmailConnection | undefined, lead?: Lead) {
  const blocking: string[] = []
  if (!lead || lead.id !== item.leadId || lead.company !== item.company) blocking.push('The saved lead association is unavailable; check this workspace.')
  else if (lead.qualificationIcpStale || lead.qualificationResearchStale) blocking.push('The lead needs requalification after an ICP or Research change.')
  else if (lead.qualificationStatus !== 'qualified' && lead.qualificationStatus !== 'needs_review') blocking.push('Qualify this lead before sending.')
  if (item.channel !== 'email') blocking.push('Only email can be sent through Gmail.')
  if (item.status !== 'APPROVED') blocking.push('Human approval of this saved draft is required.')
  if (item.approvedRevision !== (item.contentRevision || 1)) blocking.push('The current draft revision has not been approved.')
  if (!item.email || !item.recipientConfirmedAt || item.recipientSource !== 'MANUALLY_CONFIRMED') blocking.push('Confirm the selected POC recipient address before sending.')
  if (!gmail?.connected) blocking.push('Connect this workspace to Gmail before sending.')
  return {
    sender: gmail?.connected ? gmail.senderEmail || 'Unknown sender' : 'Gmail not connected',
    recipient: item.email || 'Unknown recipient',
    subject: item.subject,
    body: item.body,
    status: item.status,
    revision: item.contentRevision || 1,
    blocking,
    canSend: blocking.length === 0,
  }
}
