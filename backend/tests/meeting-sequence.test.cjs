const test = require('node:test')
const assert = require('node:assert/strict')
const { GoogleSheetsService: store } = require('../dist/services/sheets.service')
const { sheetsRouter } = require('../dist/routes/sheets.routes')

const time = '2026-10-01T10:00:00.000Z'
function fixture() {
  const sequence = { id: 's1', leadId: 'l1', outreachId: 'o1', company: 'Example', status: 'ACTIVE', updatedAt: time, cadenceAnchorAt: time, steps: [{ id: 'initial', step: 1, status: 'DELIVERY_READY', body: 'Initial' }, { id: 'draft', step: 2, status: 'PENDING_APPROVAL', body: 'Follow up' }] }
  return { leads: [{ id: 'l1', company: 'Example', qualificationStatus: 'needs_review' }], meetings: [{ id: 'm1', leadId: 'l1', outreachId: 'o1', pocId: 'p1', company: 'Example', status: 'SCHEDULED', scheduledAt: time, updatedAt: time }], outreach: [{ id: 'o1', leadId: 'l1', pocId: 'p1', company: 'Example', reviewAcknowledged: true }], deals: [], followUpSequences: [sequence, { ...structuredClone(sequence), id: 's2' }, { ...structuredClone(sequence), id: 'other', outreachId: 'o2', leadId: 'l2' }] }
}
async function isolated(run) {
  let disk = JSON.stringify(fixture())
  const original = { readData: store.readData, writeData: store.writeData, syncToGoogleSheet: store.syncToGoogleSheet }
  store.readData = () => JSON.parse(disk)
  store.writeData = data => { disk = JSON.stringify(data) }
  store.syncToGoogleSheet = async () => ({ synced: false })
  try { await run(() => JSON.parse(disk), data => { disk = JSON.stringify(data) }) } finally { Object.assign(store, original) }
}
async function linkAndReview(status = 'MEETING_BOOKED') {
  await store.linkMeetingSequence('m1', { sequenceId: 's1', expectedUpdatedAt: time, confirmed: true })
  const outcome = await store.saveMeetingOutcome('m1', { notes: 'Meeting booked by operator.', proposedChanges: {}, sequenceStatus: status, expectedRevision: 0 })
  return store.reviewMeetingOutcome('m1', { expectedRevision: outcome.revision })
}
test('explicit stable-ID selection, review, confirmation and idempotent application preserve all other records', async () => isolated(async read => {
  const before = read()
  const workflow = await store.getMeetingWorkflow('m1')
  assert.deepEqual(workflow.compatibleSequences.map(item => item.id), ['s1','s2'])
  assert.equal(workflow.sequence, null)
  await assert.rejects(store.linkMeetingSequence('m1', { sequenceId: 'other', expectedUpdatedAt: time, confirmed: true }), /must match/)
  const reviewed = await linkAndReview()
  await assert.rejects(store.applyMeetingSequenceOutcome('m1', { expectedRevision: reviewed.revision, confirmed: false }), /Invalid literal/)
  const applied = await store.applyMeetingSequenceOutcome('m1', { expectedRevision: reviewed.revision, confirmed: true })
  assert.equal(applied.application.status, 'MEETING_BOOKED')
  assert.equal((await store.applyMeetingSequenceOutcome('m1', { expectedRevision: reviewed.revision, confirmed: true })).repeated, true)
  const after = read()
  assert.equal(after.meetingSequenceApplications.length, 1)
  assert.deepEqual(after.followUpSequences[0].steps, before.followUpSequences[0].steps)
  assert.equal(after.followUpSequences[0].cadenceAnchorAt, time)
  assert.deepEqual(after.followUpSequences.slice(1), before.followUpSequences.slice(1))
  assert.deepEqual(after.outreach, before.outreach)
  await store.updateMeeting('m1', { status: 'COMPLETED' })
  assert.equal(read().followUpSequences[0].status, 'MEETING_BOOKED')
}))
test('stale sequence or meeting, unreviewed outcomes and incompatible POC cannot mutate a sequence', async () => isolated(async (read, write) => {
  let data = read(); data.meetings[0].pocId = 'wrong'; write(data)
  await assert.rejects(store.linkMeetingSequence('m1', { sequenceId: 's1', expectedUpdatedAt: time, confirmed: true }), /must match/)
  data.meetings[0].pocId = 'p1'; write(data)
  const reviewed = await linkAndReview('PAUSED')
  await store.updateSequence('s1', { status: 'PAUSED' })
  await assert.rejects(store.applyMeetingSequenceOutcome('m1', { expectedRevision: reviewed.revision, confirmed: true }), /changed after review/)
  await assert.rejects(store.applyMeetingSequenceOutcome('m1', { expectedRevision: 1, confirmed: true }), /Review the current/)
  assert.equal(read().meetingSequenceApplications, undefined)
}))
test('MEETING_BOOKED requires a scheduled meeting and terminal sequences cannot be reactivated', async () => isolated(async (read, write) => {
  const data = read(); data.meetings[0].status = 'COMPLETED'; write(data)
  await assert.rejects(linkAndReview(), /scheduled meeting/)
}))
test('follow-up approval rechecks qualification and prevents edits bundled with an approval', async () => isolated(async (read, write) => {
  const handler = sheetsRouter.stack.find(item => item.route?.path === '/follow-up-sequences/:id/steps/:step').route.stack[0].handle
  async function request(body) {
    const result = { status: 200 }
    const res = { status(code) { result.status=code; return this }, json(body) { result.body=body; return this } }
    await handler({ params: { id:'s1', step:'2' }, body }, res); return result
  }
  assert.equal((await request({ status:'APPROVED', body:'Changed after review' })).status, 400)
  let data=read(); data.leads[0].qualificationStatus='not_qualified'; write(data)
  assert.notEqual((await request({ status:'APPROVED' })).status,200)
  data=read(); data.leads[0].qualificationStatus='needs_review'; data.outreach[0].reviewAcknowledged=false; write(data)
  assert.equal((await request({ status:'APPROVED' })).status,409)
  data=read(); data.outreach[0].reviewAcknowledged=true; write(data)
  assert.equal((await request({ status:'APPROVED' })).status,200)
  assert.equal(read().followUpSequences[0].steps[1].status,'APPROVED')
}))
