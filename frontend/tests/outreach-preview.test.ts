import assert from 'node:assert/strict'
import test from 'node:test'
import { outreachPreview } from '../src/lib/outreach-preview'
import type { OutreachItem } from '../src/lib/api'

const draft = { id: 'draft-1', prospectName: 'Named Contact', email: null, company: 'Evidence Co', subject: 'Supported', body: 'Supported body', status: 'DRAFT', channel: 'email', contentRevision: 1, approvedRevision: null } as OutreachItem
const lead = { id: 'lead-1', company: 'Evidence Co', qualificationStatus: 'needs_review' } as import('../src/lib/api').Lead

test('draft preview is read-only and explains every send blocker', () => {
  const preview = outreachPreview(draft, { configured: true, connected: false, senderEmail: null })
  assert.equal(preview.subject, draft.subject)
  assert.equal(preview.recipient, 'Unknown recipient')
  assert.equal(preview.canSend, false)
  assert.equal(preview.blocking.length, 5)
  assert.equal(draft.status, 'DRAFT')
})

test('approval applies to the exact saved revision and confirmed recipient', () => {
  const ready = { ...draft, leadId: lead.id, status: 'APPROVED', email: 'recipient@example.invalid', recipientConfirmedAt: '2026-01-01T00:00:00Z', recipientSource: 'MANUALLY_CONFIRMED', approvedRevision: 1 } as OutreachItem
  const gmail = { configured: true, connected: true, senderEmail: 'sender@example.invalid' }
  assert.equal(outreachPreview(ready, gmail, lead).canSend, true)
  assert.equal(outreachPreview({ ...ready, contentRevision: 2 }, gmail, lead).canSend, false)
  assert.equal(outreachPreview({ ...ready, email: null }, gmail, lead).canSend, false)
  assert.equal(outreachPreview(ready, gmail, { ...lead, qualificationIcpStale: true }).canSend, true)
  assert.equal(outreachPreview(ready, gmail, { ...lead, qualificationStatus: 'not_qualified' }).canSend, true)
  assert.equal(outreachPreview(ready, gmail, { ...lead, qualificationStatus: undefined }).canSend, true)
  assert.equal(outreachPreview({ ...ready, recipientConfirmedAt: null, recipientSource: null }, gmail, lead).recipient, 'recipient@example.invalid')
  assert.equal(outreachPreview({ ...ready, recipientConfirmedAt: null, recipientSource: null }, gmail, lead).canSend, false)
})
