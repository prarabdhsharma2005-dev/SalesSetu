import assert from 'node:assert/strict'
import test from 'node:test'
import { leadQualificationDisplay, qualificationDisplay, qualifyLead } from '../src/lib/api'

test('saved lead cards show persisted qualification scores and flag old ICP results', () => {
  const result = { status: 'qualified' as const, score: 83 }
  assert.deepEqual(qualificationDisplay(result, false), { score: 83, status: 'QUALIFIED', detailLabel: 'Score' })
  assert.deepEqual(qualificationDisplay(result, true), { score: null, status: 'Needs requalification after ICP change', detailLabel: 'Previous score (outdated)' })
  assert.equal(qualificationDisplay(result, true, 'research').status, 'Needs requalification after Research update')
  assert.equal(qualificationDisplay(null, false).score, null)
  assert.equal(qualificationDisplay({ status: 'not_qualified', score: 0 }, false).score, 0)
})

test('new researched leads do not inherit the discovery zero as a qualification score', () => {
  const legacy = leadQualificationDisplay({ leadScore: 91, qualificationStatus: 'needs_review', qualificationScore: 88 })
  assert.equal(legacy.score, 88)
  const discovered = leadQualificationDisplay({ leadScore: 0, companyResearch: { facts: {} }, industry: '', city: '', employees: '' })
  assert.equal(discovered.score, null)
  assert.equal(discovered.status, 'Insufficient evidence')
  assert.equal(leadQualificationDisplay({ leadScore: 0 }).status, 'Not assessed')
  const partiallyAssessed = leadQualificationDisplay({ leadScore: 0, industry: 'financial services', companyResearch: { facts: { industry: { value: 'financial services' } } } })
  assert.equal(partiallyAssessed.score, null)
  assert.equal(partiallyAssessed.status, 'Not assessed')
  const assessedZero = leadQualificationDisplay({ leadScore: 0, qualificationStatus: 'not_qualified', qualificationScore: 0 })
  assert.equal(assessedZero.score, 0)
  assert.equal(leadQualificationDisplay({ leadScore: 0, qualificationStatus: 'qualified', qualificationScore: 83, qualificationIcpStale: true }).score, null)
})

test('qualification request reads and sends the saved ICP rulebook', async () => {
  const rulebook = {
    industries: ['SaaS'], cities: ['Chennai'], stages: ['Series A'], intents: ['HOT'],
    minEmp: '100', maxEmp: '10000', minScore: '60', aiResult: null, savedAt: 'timestamp',
  }
  const previousFetch = globalThis.fetch
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { localStorage: { getItem: (key: string) => key === 'salesetu_icp_rulebook' ? JSON.stringify(rulebook) : null } },
  })
  let requestUrl = ''
  let requestInit: RequestInit | undefined
  globalThis.fetch = async (input, init) => {
    requestUrl = String(input)
    requestInit = init
    return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } })
  }
  try {
    await qualifyLead('lead-1')
    assert.equal(requestUrl, '/api/backend/api/leads/lead-1/qualify')
    assert.equal(requestInit?.method, 'POST')
    assert.deepEqual(JSON.parse(String(requestInit?.body)), { icp: rulebook })
  } finally {
    globalThis.fetch = previousFetch
    Reflect.deleteProperty(globalThis, 'window')
  }
})

test('qualification does not send a request when the ICP rulebook is missing', async () => {
  const previousFetch = globalThis.fetch
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { localStorage: { getItem: () => null } },
  })
  let requestMade = false
  globalThis.fetch = async () => {
    requestMade = true
    return new Response('{}', { status: 200 })
  }
  try {
    await assert.rejects(qualifyLead('lead-1'), /ICP Rulebook is unavailable.*Save the ICP Rulebook before qualifying/)
    assert.equal(requestMade, false)
  } finally {
    globalThis.fetch = previousFetch
    Reflect.deleteProperty(globalThis, 'window')
  }
})

test('qualification does not send a request when the saved ICP rulebook is invalid', async () => {
  const previousFetch = globalThis.fetch
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { localStorage: { getItem: () => '{invalid json' } },
  })
  let requestMade = false
  globalThis.fetch = async () => {
    requestMade = true
    return new Response('{}', { status: 200 })
  }
  try {
    await assert.rejects(qualifyLead('lead-1'), /ICP Rulebook is unavailable.*Save the ICP Rulebook before qualifying/)
    assert.equal(requestMade, false)
  } finally {
    globalThis.fetch = previousFetch
    Reflect.deleteProperty(globalThis, 'window')
  }
})

test('qualification rejects a parsed value that is not a usable ICP rulebook', async () => {
  const previousFetch = globalThis.fetch
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { localStorage: { getItem: () => JSON.stringify({}) } },
  })
  let requestMade = false
  globalThis.fetch = async () => {
    requestMade = true
    return new Response('{}', { status: 200 })
  }
  try {
    await assert.rejects(qualifyLead('lead-1'), /ICP Rulebook is unavailable.*Save the ICP Rulebook before qualifying/)
    assert.equal(requestMade, false)
  } finally {
    globalThis.fetch = previousFetch
    Reflect.deleteProperty(globalThis, 'window')
  }
})
