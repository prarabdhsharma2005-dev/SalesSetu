import assert from 'node:assert/strict'
import test from 'node:test'
import { qualifyLead } from '../src/lib/api'

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
