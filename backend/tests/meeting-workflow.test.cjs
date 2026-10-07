const test = require('node:test')
const assert = require('node:assert/strict')
const { GoogleSheetsService } = require('../dist/services/sheets.service.js')
const { MeetingWorkflowConflictError, MeetingWorkflowValidationError } = require('../dist/services/meeting-workflow.service.js')
const { GeminiMalformedMeetingMomError, SalesGeminiService } = require('../dist/services/gemini.service.js')
const { aiRouter } = require('../dist/routes/ai.routes.js')

const meeting = {
  id: 'meeting-a', leadId: 'lead-a', company: 'Example A', pocId: 'poc-a', outreachId: 'outreach-a', dealId: null,
  title: 'Discovery', scheduledAt: '2026-10-10T10:00:00.000Z', date: '2026-10-10T10:00:00.000Z', duration: 30,
  meetingType: 'DISCOVERY', status: 'COMPLETED', source: 'MANUAL', notes: '', attendees: 'Contact A', summary: '', actionItems: '', sentiment: '',
  createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z',
}
const baseData = () => ({
  leads: [{ id: 'lead-a', company: 'Example A', qualificationStatus: 'qualified' }],
  meetings: [structuredClone(meeting)],
  outreach: [{ id: 'outreach-a', leadId: 'lead-a', company: 'Example A', status: 'DELIVERY_READY' }],
  followUpSequences: [{ id: 'sequence-a', leadId: 'lead-a', status: 'ACTIVE', steps: [] }],
  deals: [
    { id: 'deal-a', leadId: 'lead-a', title: 'Deal A', company: 'Example A', stage: 'DISCOVERY', value: 100, probability: 20, health: 'HEALTHY', nextAction: 'Current action' },
    { id: 'deal-legacy', title: 'Legacy Deal', company: 'Example A', stage: 'CONTACTED', value: 200, probability: 30, health: 'HEALTHY', nextAction: 'Legacy action' },
    { id: 'deal-other', leadId: 'lead-other', title: 'Other', company: 'Other Company', stage: 'PROPOSAL', value: 999, probability: 90, health: 'HEALTHY', nextAction: 'Unrelated' },
  ],
})
const momInput = (revision = 0, suffix = '') => ({
  notes: `Customer requested a proposal${suffix}.`, summary: `Proposal discussed${suffix}.`,
  discussionPoints: [`Scope${suffix}`], decisions: [],
  actionItems: [{ description: `Send proposal${suffix}`, owner: null, dueDate: null }], expectedRevision: revision,
})
const generated = suffix => ({ summary: `Generated${suffix}`, discussionPoints: [`Point${suffix}`], decisions: [], actionItems: [{ description: `Action${suffix}`, owner: null, dueDate: null }] })

async function isolated(run, initial = baseData()) {
  let disk = JSON.stringify(initial)
  const syncs = []
  let failWrite = false
  const originals = { readData: GoogleSheetsService.readData, writeData: GoogleSheetsService.writeData, syncToGoogleSheet: GoogleSheetsService.syncToGoogleSheet }
  GoogleSheetsService.readData = () => JSON.parse(disk)
  GoogleSheetsService.writeData = data => { if (failWrite) throw new Error('isolated write failure'); disk = JSON.stringify(data) }
  GoogleSheetsService.syncToGoogleSheet = async (...args) => { syncs.push(args); return { synced: false } }
  try { await run({ read: () => JSON.parse(disk), syncs, failNextWrite: () => { failWrite = true } }) }
  finally { Object.assign(GoogleSheetsService, originals) }
}

async function routeRequest(router, method, path, body, params = {}) {
  const layer = router.stack.find(item => item.route?.path === path && item.route.methods[method])
  assert.ok(layer, `${method} ${path} route exists`)
  const result = { status: 200, body: null }
  const response = { status(value) { result.status = value; return this }, json(value) { result.body = value; return this } }
  await layer.route.stack[0].handle({ body, params }, response)
  return result
}

test('MoM save, reload, review, edit invalidation, revisions, and association derivation are enforced', async () => isolated(async ({ read }) => {
  const saved = await GoogleSheetsService.saveMeetingMom('meeting-a', momInput())
  assert.equal(saved.status, 'DRAFT'); assert.equal(saved.revision, 1); assert.equal(saved.leadId, 'lead-a'); assert.equal(saved.pocId, 'poc-a')
  assert.equal(saved.actionItems[0].owner, null); assert.equal(saved.actionItems[0].dueDate, null)
  assert.deepEqual((await GoogleSheetsService.getMeetingWorkflow('meeting-a')).mom, saved)
  const reviewed = await GoogleSheetsService.reviewMeetingMom('meeting-a', { expectedRevision: 1 })
  assert.equal(reviewed.status, 'REVIEWED'); assert.equal(reviewed.revision, 2); assert.ok(reviewed.reviewedAt)
  const edited = await GoogleSheetsService.saveMeetingMom('meeting-a', { ...momInput(2, ' revised'), actionItems: [{ ...reviewed.actionItems[0], description: 'Human edited action' }] })
  assert.equal(edited.status, 'DRAFT'); assert.equal(edited.reviewedAt, null); assert.equal(edited.revision, 3)
  assert.equal(edited.actionItems[0].id, reviewed.actionItems[0].id)
  await assert.rejects(() => GoogleSheetsService.saveMeetingMom('meeting-a', momInput(2, ' stale')), MeetingWorkflowConflictError)
  assert.equal(read().meetingMoms.length, 1)
  assert.equal(await GoogleSheetsService.saveMeetingMom('unknown', momInput()), null)
  await assert.rejects(() => GoogleSheetsService.saveMeetingMom('meeting-a', { ...momInput(3), notes: '' }), MeetingWorkflowValidationError)
}))

test('regeneration requires explicit replacement and never silently overwrites reviewed or human-edited content', async () => isolated(async () => {
  const human = await GoogleSheetsService.saveMeetingMom('meeting-a', momInput())
  await assert.rejects(() => GoogleSheetsService.saveGeneratedMeetingMom('meeting-a', { notes: 'New notes', generated: generated(' 1'), expectedRevision: human.revision, replaceExisting: false, replaceReviewed: false }), /Confirm replacement/)
  const replaced = await GoogleSheetsService.saveGeneratedMeetingMom('meeting-a', { notes: 'New notes', generated: generated(' 1'), expectedRevision: human.revision, replaceExisting: true, replaceReviewed: false })
  const reviewed = await GoogleSheetsService.reviewMeetingMom('meeting-a', { expectedRevision: replaced.revision })
  await assert.rejects(() => GoogleSheetsService.saveGeneratedMeetingMom('meeting-a', { notes: 'Later notes', generated: generated(' 2'), expectedRevision: reviewed.revision, replaceExisting: true, replaceReviewed: false }), /explicit replacement/)
  await assert.rejects(() => GoogleSheetsService.saveGeneratedMeetingMom('meeting-a', { notes: 'Stale', generated: generated(' stale'), expectedRevision: reviewed.revision - 1, replaceExisting: true, replaceReviewed: true }), /changed during generation/)
  const draft = await GoogleSheetsService.saveGeneratedMeetingMom('meeting-a', { notes: 'Later notes', generated: generated(' 2'), expectedRevision: reviewed.revision, replaceExisting: true, replaceReviewed: true })
  assert.equal(draft.status, 'DRAFT'); assert.equal(draft.reviewedAt, null)
}))

test('reviewed action items create idempotent editable tasks that survive MoM regeneration', async () => isolated(async ({ read }) => {
  const mom = await GoogleSheetsService.saveMeetingMom('meeting-a', momInput())
  await assert.rejects(() => GoogleSheetsService.createMeetingTask('meeting-a', { actionItemId: mom.actionItems[0].id }), /Review/)
  const reviewed = await GoogleSheetsService.reviewMeetingMom('meeting-a', { expectedRevision: mom.revision })
  const first = await GoogleSheetsService.createMeetingTask('meeting-a', { actionItemId: reviewed.actionItems[0].id })
  const repeated = await GoogleSheetsService.createMeetingTask('meeting-a', { actionItemId: reviewed.actionItems[0].id })
  assert.equal(first.created, true); assert.equal(repeated.created, false); assert.equal(first.task.id, repeated.task.id)
  const edited = await GoogleSheetsService.updateMeetingTask(first.task.id, { description: 'Human task edit', owner: 'Owner A', status: 'COMPLETED', expectedUpdatedAt: first.task.updatedAt })
  assert.equal(edited.status, 'COMPLETED'); assert.ok(edited.completedAt); assert.equal(edited.dueDate, null)
  await assert.rejects(() => GoogleSheetsService.updateMeetingTask(first.task.id, { status: 'OPEN', expectedUpdatedAt: first.task.updatedAt }), /changed since/)
  await GoogleSheetsService.saveGeneratedMeetingMom('meeting-a', { notes: 'Regenerated notes', generated: generated(' new'), expectedRevision: reviewed.revision, replaceExisting: true, replaceReviewed: true })
  const workflow = await GoogleSheetsService.getMeetingWorkflow('meeting-a')
  assert.equal(workflow.tasks.length, 1); assert.equal(workflow.tasks[0].description, 'Human task edit'); assert.equal(workflow.tasks[0].status, 'COMPLETED')
  assert.equal(read().meetingTasks.length, 1)
}))

test('outcome linking, review preview, selective atomic application, audit, and repeat safety work', async () => isolated(async ({ read }) => {
  await assert.rejects(() => GoogleSheetsService.linkMeetingDeal('meeting-a', 'deal-other'), /not compatible/)
  const linked = await GoogleSheetsService.linkMeetingDeal('meeting-a', 'deal-legacy')
  assert.equal(linked.dealId, 'deal-legacy'); assert.equal(linked.dealLinkSource, 'USER_CONFIRMED'); assert.ok(linked.dealLinkedAt)
  const saved = await GoogleSheetsService.saveMeetingOutcome('meeting-a', { notes: 'Positive discussion.', proposedChanges: { stage: 'PROPOSAL', nextAction: 'Send proposal', value: 500, probability: 60 }, expectedRevision: 0 })
  const reviewed = await GoogleSheetsService.reviewMeetingOutcome('meeting-a', { expectedRevision: saved.revision })
  assert.equal(reviewed.status, 'REVIEWED'); assert.deepEqual(reviewed.reviewedDealSnapshot, { stage: 'CONTACTED', nextAction: 'Legacy action', value: 200, probability: 30 })
  const applied = await GoogleSheetsService.applyMeetingOutcome('meeting-a', { expectedRevision: reviewed.revision, confirmedFields: ['stage', 'nextAction'] })
  assert.equal(applied.repeated, false); assert.equal(applied.deal.stage, 'PROPOSAL'); assert.equal(applied.deal.nextAction, 'Send proposal')
  assert.equal(applied.deal.value, 200); assert.equal(applied.deal.probability, 30); assert.deepEqual(applied.application.changedFields, { stage: 'PROPOSAL', nextAction: 'Send proposal' })
  const repeated = await GoogleSheetsService.applyMeetingOutcome('meeting-a', { expectedRevision: reviewed.revision, confirmedFields: ['stage', 'nextAction'] })
  assert.equal(repeated.repeated, true); assert.equal(read().meetingDealApplications.length, 1)
  assert.deepEqual(read().deals.find(item => item.id === 'deal-other'), baseData().deals.find(item => item.id === 'deal-other'))
  assert.deepEqual(read().leads, baseData().leads); assert.deepEqual(read().outreach, baseData().outreach); assert.deepEqual(read().followUpSequences, baseData().followUpSequences)
}))

test('outcome edits invalidate review; stale deal/outcome and unreviewed application are rejected', async () => isolated(async () => {
  await GoogleSheetsService.linkMeetingDeal('meeting-a', 'deal-a')
  const saved = await GoogleSheetsService.saveMeetingOutcome('meeting-a', { notes: 'Outcome', proposedChanges: { stage: 'PROPOSAL' }, expectedRevision: 0 })
  await assert.rejects(() => GoogleSheetsService.applyMeetingOutcome('meeting-a', { expectedRevision: saved.revision, confirmedFields: ['stage'] }), /Review/)
  const reviewed = await GoogleSheetsService.reviewMeetingOutcome('meeting-a', { expectedRevision: saved.revision })
  await GoogleSheetsService.updateDealStage('deal-a', 'ENGAGED')
  await assert.rejects(() => GoogleSheetsService.applyMeetingOutcome('meeting-a', { expectedRevision: reviewed.revision, confirmedFields: ['stage'] }), /changed after review/)
  const edited = await GoogleSheetsService.saveMeetingOutcome('meeting-a', { notes: 'Human revision', proposedChanges: { stage: 'NEGOTIATION' }, expectedRevision: reviewed.revision })
  assert.equal(edited.status, 'DRAFT'); assert.equal(edited.reviewedAt, null)
  await assert.rejects(() => GoogleSheetsService.applyMeetingOutcome('meeting-a', { expectedRevision: reviewed.revision, confirmedFields: ['stage'] }), /Review/)
  await assert.rejects(() => GoogleSheetsService.saveMeetingOutcome('meeting-a', { notes: 'Stale', proposedChanges: {}, expectedRevision: reviewed.revision }), /changed since/)
}))

test('application write failures report failure without partial deal or audit persistence', async () => isolated(async ({ read, failNextWrite }) => {
  await GoogleSheetsService.linkMeetingDeal('meeting-a', 'deal-a')
  const saved = await GoogleSheetsService.saveMeetingOutcome('meeting-a', { notes: 'Outcome', proposedChanges: { stage: 'PROPOSAL' }, expectedRevision: 0 })
  const reviewed = await GoogleSheetsService.reviewMeetingOutcome('meeting-a', { expectedRevision: saved.revision })
  const before = read()
  failNextWrite()
  await assert.rejects(() => GoogleSheetsService.applyMeetingOutcome('meeting-a', { expectedRevision: reviewed.revision, confirmedFields: ['stage'] }), /write failure/)
  assert.deepEqual(read(), before)
}))

test('AI generation route rejects unknown/empty/provider/malformed cases and saves only a successful draft', async () => isolated(async ({ read }) => {
  const original = SalesGeminiService.extractMoM
  try {
    let result = await routeRequest(aiRouter, 'post', '/meetings/:id/mom/generate', { notes: 'x', expectedRevision: 0 }, { id: 'unknown' })
    assert.equal(result.status, 404)
    result = await routeRequest(aiRouter, 'post', '/meetings/:id/mom/generate', { notes: '', expectedRevision: 0 }, { id: 'meeting-a' })
    assert.equal(result.status, 400)
    SalesGeminiService.extractMoM = async () => { throw new Error('provider unavailable') }
    result = await routeRequest(aiRouter, 'post', '/meetings/:id/mom/generate', { notes: 'Real notes', expectedRevision: 0 }, { id: 'meeting-a' })
    assert.equal(result.status, 503); assert.equal(read().meetingMoms, undefined)
    SalesGeminiService.extractMoM = async () => { throw new GeminiMalformedMeetingMomError('malformed') }
    result = await routeRequest(aiRouter, 'post', '/meetings/:id/mom/generate', { notes: 'Real notes', expectedRevision: 0 }, { id: 'meeting-a' })
    assert.equal(result.status, 502); assert.equal(read().meetingMoms, undefined)
    SalesGeminiService.extractMoM = async context => { assert.equal(context.notes, 'Real notes'); assert.equal(context.meeting.id, 'meeting-a'); return generated(' success') }
    result = await routeRequest(aiRouter, 'post', '/meetings/:id/mom/generate', { notes: 'Real notes', expectedRevision: 0 }, { id: 'meeting-a' })
    assert.equal(result.status, 200); assert.equal(result.body.status, 'DRAFT'); assert.equal(read().meetingMoms.length, 1)
  } finally { SalesGeminiService.extractMoM = original }
}))

test('Gemini MoM extraction uses supplied meeting context and rejects malformed output without canned fallback', async () => {
  const originalGenerate = SalesGeminiService.generateContent
  const prompts = []
  try {
    SalesGeminiService.generateContent = async prompt => { prompts.push(prompt); return { text: JSON.stringify(generated(' grounded')), model: 'test' } }
    const result = await SalesGeminiService.extractMoM({ notes: 'Explicit note', meeting: { id: 'm', title: 'Call', company: 'Company', pocName: null, scheduledAt: null, meetingType: null } })
    assert.equal(result.summary, 'Generated grounded'); assert.match(prompts[0], /Explicit note/); assert.match(prompts[0], /ONLY the supplied/)
    SalesGeminiService.generateContent = async () => ({ text: '{bad', model: 'test' })
    await assert.rejects(() => SalesGeminiService.extractMoM({ notes: 'Explicit note', meeting: { id: 'm', title: 'Call', company: 'Company', pocName: null, scheduledAt: null, meetingType: null } }), GeminiMalformedMeetingMomError)
  } finally { SalesGeminiService.generateContent = originalGenerate }
})
