const test = require('node:test')
const assert = require('node:assert/strict')
const { GoogleSheetsService } = require('../dist/services/sheets.service.js')
const { POCVerificationCache } = require('../dist/services/poc-verification-cache.service.js')
const { GmailService, GmailError } = require('../dist/services/gmail.service.js')
const { sheetsRouter } = require('../dist/routes/sheets.routes.js')
const { sendApprovedOutreach, sendApprovedFollowUp } = require('../dist/services/outreach-delivery.service.js')
const { processDueFollowUps } = require('../dist/services/follow-up-automation.service.js')

const lead = { id: 'lead-isolated', company: 'Isolated Co', qualificationStatus: 'needs_review', qualificationScore: 63 }
const poc = { name: 'Source Contact', role: 'Director', department: 'Sales', sourceUrl: 'https://example.com/team', confidence: 0.9, relevanceReason: 'Sales leader' }
const baseData = () => ({ leads: [lead], outreach: [], followUpSequences: [], meetings: [], deals: [] })

async function isolated(run) {
  let disk = JSON.stringify(baseData())
  let syncs = 0
  const originals = {
    readData: GoogleSheetsService.readData, writeData: GoogleSheetsService.writeData,
    syncToGoogleSheet: GoogleSheetsService.syncToGoogleSheet, getLeads: GoogleSheetsService.getLeads,
    gmailStatus: GmailService.status, gmailSend: GmailService.send,
  }
  GoogleSheetsService.readData = () => JSON.parse(disk)
  GoogleSheetsService.writeData = value => { disk = JSON.stringify(value) }
  GoogleSheetsService.syncToGoogleSheet = async () => { syncs++; return { synced: false } }
  GoogleSheetsService.getLeads = async () => [lead]
  GmailService.status = () => ({ configured: true, connected: true, senderEmail: 'sender@example.com' })
  GmailService.send = async () => ({ gmailMessageId: 'message-1', gmailThreadId: 'thread-1', rfcMessageId: '<message-1@example.com>', senderEmail: 'sender@example.com' })
  POCVerificationCache.store(lead.id, [poc])
  try { await run({ read: () => JSON.parse(disk), syncs: () => syncs }) }
  finally {
    Object.assign(GoogleSheetsService, { readData: originals.readData, writeData: originals.writeData, syncToGoogleSheet: originals.syncToGoogleSheet, getLeads: originals.getLeads })
    GmailService.status = originals.gmailStatus
    GmailService.send = originals.gmailSend
    POCVerificationCache.clear()
  }
}

async function request(method, path, body, params = {}) {
  const layer = sheetsRouter.stack.find(item => item.route?.path === path && item.route.methods[method])
  assert.ok(layer, `${method} ${path} route exists`)
  const result = { status: 200, body: null }
  const response = { status(value) { result.status = value; return this }, json(value) { result.body = value; return this } }
  await layer.route.stack[0].handle({ body, params }, response)
  return result
}

async function newDraft() {
  const result = await request('post', '/outreach', {
    clientDraftId: 'dd33c2d7-e10e-4b3f-847c-a2cc0f436abe', status: 'DRAFT', leadId: lead.id,
    company: lead.company, poc, channel: 'email', subject: 'A useful question', body: 'Hello Source Contact, could we discuss your workflow?'
  })
  assert.equal(result.status, 201)
  return result.body
}

async function transition(item, status, extra = {}) {
  const result = await request('patch', '/outreach/:id', { expectedUpdatedAt: item.updatedAt, status, ...extra }, { id: item.id })
  assert.equal(result.status, 200, JSON.stringify(result.body))
  return result.body
}

test('isolated draft save, approval revision, recipient confirmation, Gmail send and sent cadence persist', async () => isolated(async ({ read, syncs }) => {
  let draft = await newDraft()
  assert.equal(draft.email, null)
  assert.equal(draft.leadId, lead.id)
  assert.equal(draft.poc.name, poc.name)
  const duplicate = await request('post', '/outreach', { clientDraftId: draft.clientDraftId, status: 'DRAFT', leadId: lead.id, company: lead.company, poc, channel: 'email', subject: draft.subject, body: draft.body })
  assert.equal(duplicate.status, 200)
  assert.equal(duplicate.body.id, draft.id)
  assert.equal(read().outreach.length, 1)

  const pending = await transition(draft, 'PENDING_APPROVAL', { reviewAcknowledged: true })
  const stale = await request('patch', '/outreach/:id', { expectedUpdatedAt: draft.updatedAt, status: 'APPROVED' }, { id: draft.id })
  assert.equal(stale.status, 409)
  let approved = await transition(pending, 'APPROVED')
  assert.equal(approved.approvedRevision, 1)
  await assert.rejects(sendApprovedOutreach(draft.id, approved.updatedAt, true), /confirm.*recipient email/i)

  const edited = await request('patch', '/outreach/:id', { expectedUpdatedAt: approved.updatedAt, email: 'contact@example.com', recipientConfirmed: true }, { id: draft.id })
  assert.equal(edited.status, 200)
  draft = edited.body
  assert.equal(draft.status, 'DRAFT')
  assert.equal(draft.contentRevision, 2)
  assert.equal(draft.approvedRevision, null)
  assert.equal(draft.recipientSource, 'MANUALLY_CONFIRMED')
  await assert.rejects(sendApprovedOutreach(draft.id, draft.updatedAt, true), /approved email/)
  approved = await transition(await transition(draft, 'PENDING_APPROVAL', { reviewAcknowledged: true }), 'APPROVED')
  assert.equal(approved.approvedRevision, 2)
  const sent = await sendApprovedOutreach(draft.id, approved.updatedAt, true)
  assert.equal(sent.status, 'SENT')
  assert.equal(sent.gmailMessageId, 'message-1')
  assert.ok(sent.sentAt)
  await assert.rejects(sendApprovedOutreach(draft.id, approved.updatedAt, true), /changed since preview/)
  assert.equal(read().outreach.length, 1)
  assert.equal(read().outreach[0].status, 'SENT')

  const created = await request('post', '/follow-up-sequences', { outreachId: draft.id })
  assert.equal(created.status, 201)
  const sequence = created.body
  assert.equal(sequence.anchorPolicy, 'GMAIL_SENT')
  assert.equal(sequence.cadenceAnchorAt, sent.sentAt)
  assert.equal(sequence.steps[0].status, 'SENT')
  assert.equal(sequence.steps[1].status, 'DRAFT')
  assert.ok(syncs() > 0, 'local sync hook was stubbed, never external')
}))

test('Gmail failure states remain truthful and do not retry an ambiguous outcome', async () => isolated(async ({ read }) => {
  let draft = await newDraft()
  const edit = await request('patch', '/outreach/:id', { expectedUpdatedAt: draft.updatedAt, email: 'contact@example.com', recipientConfirmed: true }, { id: draft.id })
  draft = await transition(await transition(edit.body, 'PENDING_APPROVAL', { reviewAcknowledged: true }), 'APPROVED')
  GmailService.send = async () => { throw new GmailError('Ambiguous provider timeout.', true) }
  await assert.rejects(sendApprovedOutreach(draft.id, draft.updatedAt, true), /Ambiguous provider timeout/)
  assert.equal(read().outreach[0].status, 'DELIVERY_UNKNOWN')
  await assert.rejects(sendApprovedOutreach(draft.id, read().outreach[0].updatedAt, true), /Only an approved email/)
  assert.equal(read().outreach[0].sentAt, undefined)
}))

test('rejection and resubmission require review; disconnected and definite provider errors never claim SENT', async () => isolated(async ({ read }) => {
  const draft = await newDraft()
  const pending = await transition(draft, 'PENDING_APPROVAL', { reviewAcknowledged: true })
  const rejected = await transition(pending, 'REJECTED')
  const reopened = await transition(rejected, 'DRAFT')
  const missingAck = await request('patch', '/outreach/:id', { expectedUpdatedAt: reopened.updatedAt, status: 'PENDING_APPROVAL' }, { id: reopened.id })
  assert.equal(missingAck.status, 409)
  const edit = await request('patch', '/outreach/:id', { expectedUpdatedAt: reopened.updatedAt, email: 'contact@example.com', recipientConfirmed: true }, { id: reopened.id })
  let approved = await transition(await transition(edit.body, 'PENDING_APPROVAL', { reviewAcknowledged: true }), 'APPROVED')
  GmailService.status = () => ({ configured: true, connected: false, senderEmail: null })
  await assert.rejects(sendApprovedOutreach(approved.id, approved.updatedAt, true), /Connect Gmail/)
  assert.equal(read().outreach[0].status, 'APPROVED')
  GmailService.status = () => ({ configured: true, connected: true, senderEmail: 'sender@example.com' })
  GmailService.send = async () => { throw new GmailError('Gmail rejected the message (HTTP 403).', false, 403) }
  await assert.rejects(sendApprovedOutreach(approved.id, approved.updatedAt, true), /HTTP 403/)
  approved = read().outreach[0]
  assert.equal(approved.status, 'APPROVED')
  assert.equal(approved.sentAt, undefined)
}))

test('parallel sends claim one attempt and block duplicate provider calls', async () => isolated(async ({ read }) => {
  const draft = await newDraft()
  const edit = await request('patch', '/outreach/:id', { expectedUpdatedAt: draft.updatedAt, email: 'contact@example.com', recipientConfirmed: true }, { id: draft.id })
  const approved = await transition(await transition(edit.body, 'PENDING_APPROVAL', { reviewAcknowledged: true }), 'APPROVED')
  let releaseProvider
  let providerCalls = 0
  GmailService.send = async () => { providerCalls++; return new Promise(resolve => { releaseProvider = () => resolve({ gmailMessageId: 'gmail-1', gmailThreadId: 'thread-1', rfcMessageId: '<gmail-1@example.com>', senderEmail: 'sender@example.com' }) }) }
  const first = sendApprovedOutreach(approved.id, approved.updatedAt, true)
  await new Promise(resolve => setImmediate(resolve))
  await assert.rejects(sendApprovedOutreach(approved.id, approved.updatedAt, true), /already being sent/)
  assert.equal(providerCalls, 1)
  releaseProvider()
  await first
  assert.equal(read().outreach[0].status, 'SENT')
}))

test('confirmed predecessor is required for due drafting and follow-up approval/send', async () => isolated(async ({ read }) => {
  const initial = await GoogleSheetsService.appendOutreach({ prospectName: poc.name, email: 'contact@example.com', company: lead.company, subject: 'Initial', body: 'Initial message', status: 'SENT', leadId: lead.id, pocId: 'poc', poc, channel: 'email', reviewRequired: true, reviewAcknowledged: true, qualificationStatus: 'needs_review', contentRevision: 1, approvedRevision: 1, recipientSource: 'MANUALLY_CONFIRMED', recipientConfirmedAt: new Date().toISOString(), sentAt: '2026-01-01T00:00:00.000Z' })
  let sequence = await GoogleSheetsService.createSequence(initial)
  const due = await processDueFollowUps({ now: new Date('2026-01-05T00:00:00.000Z'), dependencies: {
    getSequences: () => GoogleSheetsService.getSequences(), getOutreach: () => GoogleSheetsService.getOutreach(),
    updateSequence: (id, updates, expected) => GoogleSheetsService.updateSequence(id, updates, expected),
    checkQualification: async () => ({ lead, reviewRequired: true }),
    draftFollowUp: async () => ({ subject: 'Follow-up', body: 'Following up on the initial message.' }),
  } })
  assert.equal(due.processed, 1)
  sequence = read().followUpSequences[0]
  assert.equal(sequence.steps[1].status, 'DRAFT')
  assert.equal(sequence.steps[1].subject, 'Follow-up')
  let response = await request('patch', '/follow-up-sequences/:id/steps/:step', { expectedUpdatedAt: sequence.updatedAt, status: 'PENDING_APPROVAL' }, { id: sequence.id, step: '2' })
  assert.equal(response.status, 200)
  sequence = response.body.sequence
  response = await request('patch', '/follow-up-sequences/:id/steps/:step', { expectedUpdatedAt: sequence.updatedAt, status: 'APPROVED' }, { id: sequence.id, step: '2' })
  assert.equal(response.status, 200)
  sequence = response.body.sequence
  assert.equal(sequence.steps[1].approvedRevision, 1)
  const sent = await sendApprovedFollowUp(sequence.id, 2, sequence.updatedAt, true)
  assert.equal(sent.step.status, 'SENT')
  assert.ok(sent.step.sentAt)
  assert.equal(read().followUpSequences[0].steps[1].status, 'SENT')
}))
