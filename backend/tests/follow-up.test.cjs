const test = require('node:test')
const assert = require('node:assert/strict')
const { GoogleSheetsService } = require('../dist/services/sheets.service.js')
const { SalesGeminiService } = require('../dist/services/gemini.service.js')
const { allowedFollowUpStepTransition, buildFollowUpContext, canGenerateSequenceStep, isFollowUpStepNumber } = require('../dist/services/outreach-workflow.service.js')

const initial = {
  id: 'outreach-follow-up-test', outreachId: 'outreach-follow-up-test', leadId: 'lead-follow-up-test',
  company: 'Example Co', prospectName: 'A Contact', subject: 'Initial subject', body: 'Initial outreach body.',
  status: 'APPROVED', channel: 'email', qualificationStatus: 'needs_review', qualificationScore: 63,
  poc: { name: 'A Contact', role: 'VP Sales', department: 'Sales', relevance: 'Owns sales operations', sourceUrl: 'https://example.com/contact', profileUrl: null, confidence: 0.9 },
  createdAt: '2026-01-01T00:00:00.000Z', approvedAt: '2026-01-01T00:00:00.000Z',
}

test('new follow-up sequences persist four steps at days 0, 3, 7, and 12', async () => {
  let stored = { followUpSequences: [] }
  const originalRead = GoogleSheetsService.readData
  const originalWrite = GoogleSheetsService.writeData
  const originalSync = GoogleSheetsService.syncToGoogleSheet
  GoogleSheetsService.readData = () => stored
  GoogleSheetsService.writeData = data => { stored = data }
  GoogleSheetsService.syncToGoogleSheet = async () => ({ synced: false })
  try {
    const created = await GoogleSheetsService.createSequence(initial)
    assert.deepEqual(created.steps.map(step => step.dayOffset), [0, 3, 7, 12])
    assert.deepEqual(created.steps.map(step => step.step), [1, 2, 3, 4])
    assert.deepEqual(created.steps.slice(1).map(step => step.status), ['DRAFT', 'DRAFT', 'DRAFT'])
    assert.equal((await GoogleSheetsService.getSequences())[0].id, created.id)
    assert.equal(created.steps[2].label, 'Follow-up 2 / Value-add')
    assert.equal(created.steps[3].label, 'Final Follow-up')
  } finally {
    GoogleSheetsService.readData = originalRead
    GoogleSheetsService.writeData = originalWrite
    GoogleSheetsService.syncToGoogleSheet = originalSync
  }
})

test('active steps 2, 3, and 4 are draftable; legacy three-step sequences remain safe', () => {
  const sequence = { status: 'ACTIVE', steps: [] }
  for (const number of [2, 3, 4]) {
    assert.equal(isFollowUpStepNumber(number), true)
    assert.equal(canGenerateSequenceStep(sequence, { step: number, status: 'DRAFT', body: '' }), true)
  }
  assert.equal(isFollowUpStepNumber(1), false)
  assert.equal(isFollowUpStepNumber(5), false)
  assert.equal(canGenerateSequenceStep({ ...sequence, status: 'PAUSED' }, { step: 4, status: 'DRAFT', body: '' }), false)
  const historical = { ...sequence, steps: [{ step: 1 }, { step: 2 }, { step: 3 }] }
  assert.equal(historical.steps.length, 3)
  assert.equal(historical.steps.map(step => step.step).join(','), '1,2,3')
  assert.equal(historical.steps.find(step => step.step === 4), undefined)
  assert.equal(canGenerateSequenceStep(historical, { step: 2, status: 'DRAFT', body: '' }), true)
  assert.equal(canGenerateSequenceStep(historical, { step: 3, status: 'DRAFT', body: '' }), true)
})

test('follow-up approval remains manual and never adds a SENT transition', () => {
  assert.equal(allowedFollowUpStepTransition('DRAFT', 'PENDING_APPROVAL'), true)
  assert.equal(allowedFollowUpStepTransition('PENDING_APPROVAL', 'APPROVED'), true)
  assert.equal(allowedFollowUpStepTransition('PENDING_APPROVAL', 'REJECTED'), true)
  assert.equal(allowedFollowUpStepTransition('APPROVED', 'DELIVERY_READY'), true)
  assert.equal(allowedFollowUpStepTransition('DRAFT', 'APPROVED'), false)
  assert.equal(allowedFollowUpStepTransition('DELIVERY_READY', 'SENT'), false)
})

test('Gemini follow-up receives supplied company, POC, qualification, channel, and message history context', async () => {
  const sequence = {
    id: 'sequence-test', outreachId: initial.id, leadId: initial.leadId, company: initial.company,
    prospectName: initial.prospectName, status: 'ACTIVE', createdAt: '', updatedAt: '',
    steps: [
      { id: '1', step: 1, label: 'Initial outreach', dayOffset: 0, status: 'APPROVED', subject: initial.subject, body: initial.body },
      { id: '2', step: 2, label: 'Follow-up 1', dayOffset: 3, status: 'APPROVED', subject: 'Previous follow-up', body: 'Previous follow-up content.' },
      { id: '3', step: 3, label: 'Follow-up 2 / Value-add', dayOffset: 7, status: 'DRAFT', subject: '', body: '' },
      { id: '4', step: 4, label: 'Final Follow-up', dayOffset: 12, status: 'DRAFT', subject: '', body: '' },
    ],
  }
  const lead = {
    industry: 'SaaS', city: 'Bengaluru', country: 'India', employees: 1200,
    intentSignal: 'Stored intent signal', qualificationStatus: 'needs_review', qualificationScore: 63,
    qualificationReasons: ['Review evidence before outreach'],
    qualificationEvidence: [{ criterion: 'intent_signal', field: 'intentSignal', value: 'Stored intent signal', origin: 'sales_setu_record', sourceUrl: null }],
  }
  const context = buildFollowUpContext({ initial, lead, sequence, step: sequence.steps[2], tone: 'consultative' })
  const originalGenerate = SalesGeminiService.generateContent
  const prompts = []
  SalesGeminiService.generateContent = async value => {
    prompts.push(value)
    return { text: JSON.stringify({ subject: 'A subject', body: 'A sourced follow-up.' }), model: 'test-model' }
  }
  try {
    for (const number of [2, 3, 4]) {
      const step = sequence.steps[number - 1]
      const stepContext = number === 3 ? context : buildFollowUpContext({ initial, lead, sequence, step, tone: 'consultative' })
      const draft = await SalesGeminiService.draftFollowUp(stepContext)
      assert.deepEqual(draft, { subject: 'A subject', body: 'A sourced follow-up.' })
    }
    const purposeByStep = ['brief follow-up', 'value-add follow-up', 'respectful final follow-up']
    for (let index = 0; index < prompts.length; index += 1) assert.equal(prompts[index].includes(purposeByStep[index]), true)
    for (const expected of ['Example Co', 'SaaS', 'Bengaluru, India', '1200', 'A Contact', 'VP Sales', 'Owns sales operations', 'Stored intent signal', 'needs_review', 'Previous follow-up content.', 'email', 'consultative', 'value-add']) {
      assert.equal(prompts[1].includes(expected), true, `prompt should include ${expected}`)
    }
    assert.deepEqual(context.researchSources, [])
    assert.equal(context.researchSummary, null)
    assert.equal(context.previousMessages.some(message => message.body === 'Previous follow-up content.'), true)
    assert.equal(prompts.every(prompt => prompt.includes('do not invent company facts')), true)
  } finally {
    SalesGeminiService.generateContent = originalGenerate
  }
})
