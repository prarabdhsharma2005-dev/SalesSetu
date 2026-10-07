const test = require('node:test')
const assert = require('node:assert/strict')
const { GoogleSheetsService } = require('../dist/services/sheets.service.js')
const { calculateFollowUpDueAt, processDueFollowUps } = require('../dist/services/follow-up-automation.service.js')

const anchor = '2026-10-01T10:00:00.000Z'
const baseOutreach = {
  id: 'automation-outreach', leadId: 'automation-lead', company: 'Example Co', prospectName: 'A Contact',
  subject: 'Initial', body: 'Initial message', email: 'person@example.com', status: 'DELIVERY_READY',
  channel: 'email', deliveryReadyAt: anchor, createdAt: '2026-10-01T09:00:00.000Z',
  poc: { name: 'A Contact', role: 'VP Sales', department: 'Sales', relevance: 'Relevant sourced POC', profileUrl: null, sourceUrl: 'https://example.com/contact', confidence: 0.9 },
}

function makeSequence({ status = 'ACTIVE', cadenceAnchorAt = anchor, previousStatuses = {} } = {}) {
  return {
    id: `sequence-${Math.random()}`, outreachId: baseOutreach.id, leadId: baseOutreach.leadId,
    company: baseOutreach.company, prospectName: baseOutreach.prospectName, status,
    createdAt: anchor, updatedAt: anchor, cadenceAnchorAt,
    steps: [
      { id: 'step-1', step: 1, label: 'Initial outreach', dayOffset: 0, status: previousStatuses[1] || 'DELIVERY_READY', subject: 'Initial', body: 'Initial message', createdAt: anchor, updatedAt: anchor, deliveryReadyAt: anchor },
      { id: 'step-2', step: 2, label: 'Follow-up 1', dayOffset: 3, status: previousStatuses[2] || 'DRAFT', subject: '', body: '', createdAt: null, updatedAt: null },
      { id: 'step-3', step: 3, label: 'Follow-up 2 / Value-add', dayOffset: 7, status: previousStatuses[3] || 'DRAFT', subject: '', body: '', createdAt: null, updatedAt: null },
      { id: 'step-4', step: 4, label: 'Final Follow-up', dayOffset: 12, status: previousStatuses[4] || 'DRAFT', subject: '', body: '', createdAt: null, updatedAt: null },
    ],
  }
}

function makeHarness({ sequence = makeSequence(), now = '2026-10-04T10:00:00.000Z', draftFollowUp } = {}) {
  const store = { sequences: [structuredClone(sequence)] }
  const generated = []
  const dependencies = {
    getSequences: async () => structuredClone(store.sequences),
    getOutreach: async () => [structuredClone(baseOutreach)],
    updateSequence: async (id, updates) => {
      const index = store.sequences.findIndex(item => item.id === id)
      if (index < 0) return null
      store.sequences[index] = { ...store.sequences[index], ...structuredClone(updates) }
      return structuredClone(store.sequences[index])
    },
    checkQualification: async () => ({ lead: {
      id: baseOutreach.leadId, company: baseOutreach.company, industry: 'SaaS', city: 'Bengaluru', country: 'India',
      employees: 1200, intentSignal: 'Stored signal', qualificationStatus: 'qualified', qualificationScore: 80,
      qualificationReasons: ['Evidence-backed fit'], qualificationEvidence: [],
    }, reviewRequired: false }),
    draftFollowUp: async context => {
      generated.push(context)
      return draftFollowUp ? draftFollowUp(context) : { subject: `Follow-up ${context.step}`, body: `Real draft for step ${context.step}` }
    },
  }
  return {
    store,
    generated,
    run: overrides => processDueFollowUps({ now: new Date(now), dependencies: { ...dependencies, ...overrides } }),
  }
}

test('cadence due times use UTC day offsets 3, 7, and 12', () => {
  assert.equal(calculateFollowUpDueAt(anchor, 3), '2026-10-04T10:00:00.000Z')
  assert.equal(calculateFollowUpDueAt(anchor, 7), '2026-10-08T10:00:00.000Z')
  assert.equal(calculateFollowUpDueAt(anchor, 12), '2026-10-13T10:00:00.000Z')
  assert.equal(calculateFollowUpDueAt('invalid', 3), null)
  assert.equal(calculateFollowUpDueAt(anchor, -1), null)
})

test('an active due step is saved as DRAFT only and repeated processing does not regenerate it', async () => {
  const harness = makeHarness()
  const first = await harness.run()
  assert.equal(first.processed, 1)
  assert.equal(harness.store.sequences[0].steps[1].status, 'DRAFT')
  assert.equal(harness.store.sequences[0].steps[1].body, 'Real draft for step 2')
  assert.equal(harness.store.sequences[0].steps[1].approvedAt, undefined)
  assert.equal(harness.store.sequences[0].steps[1].sentAt, undefined)
  assert.equal(harness.generated.length, 1)

  const second = await harness.run()
  assert.equal(second.processed, 0)
  assert.equal(harness.generated.length, 1)
})

test('a future step is skipped without calling Gemini', async () => {
  const harness = makeHarness({ now: '2026-10-03T09:59:59.999Z' })
  const result = await harness.run()
  assert.equal(result.processed, 0)
  assert.equal(harness.generated.length, 0)
  assert.equal(result.details.some(detail => detail.reason === 'Step is not due yet.'), true)
})

test('missing or malformed cadence anchors never become automation eligible', async () => {
  for (const cadenceAnchorAt of [null, undefined, 'not-a-date']) {
    const sequence = makeSequence()
    sequence.cadenceAnchorAt = cadenceAnchorAt
    const harness = makeHarness({ sequence })
    const result = await harness.run()
    assert.equal(result.processed, 0)
    assert.equal(harness.generated.length, 0)
    assert.equal(result.details[0].reason.includes('Cadence anchor unavailable'), true)
  }
})

test('all non-active sequence states are skipped', async () => {
  for (const status of ['PAUSED', 'REPLIED', 'MEETING_BOOKED', 'STOPPED', 'COMPLETED']) {
    const harness = makeHarness({ sequence: makeSequence({ status }) })
    const result = await harness.run()
    assert.equal(result.processed, 0, status)
    assert.equal(harness.generated.length, 0, status)
    assert.equal(result.details[0].reason, 'Sequence is not active.', status)
  }
})

test('each step waits for its immediate predecessor to reach DELIVERY_READY', async () => {
  for (const [stepNumber, dueTime, previousStatuses] of [
    [2, '2026-10-04T10:00:00.000Z', { 1: 'APPROVED' }],
    [3, '2026-10-08T10:00:00.000Z', { 2: 'APPROVED' }],
    [4, '2026-10-13T10:00:00.000Z', { 3: 'APPROVED' }],
  ]) {
    const sequence = makeSequence({ previousStatuses })
    for (const step of sequence.steps.filter(item => item.step > 1 && item.step !== stepNumber)) {
      step.status = 'APPROVED'
      step.body = 'Existing approved content'
    }
    const harness = makeHarness({ sequence, now: dueTime })
    const result = await harness.run()
    assert.equal(result.processed, 0, `step ${stepNumber}`)
    assert.equal(harness.generated.length, 0, `step ${stepNumber}`)
    assert.equal(result.details.some(detail => detail.step === stepNumber && detail.reason === 'Preceding step is not delivery-ready.'), true)
  }
})

test('steps 3 and 4 generate only after their predecessor is delivery-ready', async () => {
  for (const [stepNumber, now, previousStep] of [
    [3, '2026-10-08T10:00:00.000Z', 2],
    [4, '2026-10-13T10:00:00.000Z', 3],
  ]) {
    const sequence = makeSequence({ previousStatuses: { [previousStep]: 'DELIVERY_READY' } })
    for (const step of sequence.steps.filter(item => item.step > 1 && item.step !== stepNumber && item.step !== previousStep)) {
      step.status = 'APPROVED'
      step.body = 'Existing approved content'
    }
    const harness = makeHarness({ sequence, now })
    const result = await harness.run()
    assert.equal(result.processed, 1, `step ${stepNumber}`)
    assert.equal(harness.generated[0].step, stepNumber)
    assert.equal(harness.store.sequences[0].steps[stepNumber - 1].status, 'DRAFT')
  }
})

test('Gemini failure leaves a due step empty and available for retry', async () => {
  const harness = makeHarness({ draftFollowUp: async () => { throw new Error('provider detail omitted') } })
  const result = await harness.run()
  assert.equal(result.processed, 0)
  assert.equal(result.errors, 1)
  assert.equal(harness.store.sequences[0].steps[1].status, 'DRAFT')
  assert.equal(harness.store.sequences[0].steps[1].body, '')
  assert.equal(result.details[0].errorType, 'Error')
})

test('concurrent processing calls claim the same step only once in this process', async () => {
  let signalStarted
  let releaseDraft
  const started = new Promise(resolve => { signalStarted = resolve })
  const draftGate = new Promise(resolve => { releaseDraft = resolve })
  const harness = makeHarness({ draftFollowUp: async context => {
    signalStarted()
    await draftGate
    return { subject: `Follow-up ${context.step}`, body: `Real draft for step ${context.step}` }
  } })
  const firstRun = harness.run()
  await started
  const secondRun = harness.run()
  releaseDraft()
  const [first, second] = await Promise.all([firstRun, secondRun])
  assert.equal(first.processed + second.processed, 1)
  assert.equal(harness.generated.length, 1)
})

test('sequence creation anchors only a valid DELIVERY_READY initial outreach and keeps older sequences readable', async () => {
  let stored = { followUpSequences: [{ id: 'legacy', steps: [{ step: 1 }, { step: 2 }, { step: 3 }] }] }
  const originalRead = GoogleSheetsService.readData
  const originalWrite = GoogleSheetsService.writeData
  const originalSync = GoogleSheetsService.syncToGoogleSheet
  GoogleSheetsService.readData = () => stored
  GoogleSheetsService.writeData = data => { stored = data }
  GoogleSheetsService.syncToGoogleSheet = async () => ({ synced: false })
  try {
    const ready = await GoogleSheetsService.createSequence({ ...baseOutreach, id: 'ready-outreach' })
    assert.equal(ready.cadenceAnchorAt, anchor)
    assert.equal(ready.steps[0].status, 'DELIVERY_READY')
    assert.equal(ready.steps[0].deliveryReadyAt, anchor)

    const approved = await GoogleSheetsService.createSequence({ ...baseOutreach, id: 'approved-outreach', status: 'APPROVED', deliveryReadyAt: undefined })
    assert.equal(approved.cadenceAnchorAt, null)
    assert.equal(approved.steps[0].status, 'APPROVED')
    assert.equal(stored.followUpSequences.find(item => item.id === 'legacy').steps.length, 3)

    const malformed = await GoogleSheetsService.createSequence({ ...baseOutreach, id: 'malformed-outreach', deliveryReadyAt: 'not-a-timestamp' })
    assert.equal(malformed.cadenceAnchorAt, null)
  } finally {
    GoogleSheetsService.readData = originalRead
    GoogleSheetsService.writeData = originalWrite
    GoogleSheetsService.syncToGoogleSheet = originalSync
  }
})
