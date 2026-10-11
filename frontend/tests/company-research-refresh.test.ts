import assert from 'node:assert/strict'
import test from 'node:test'
import { refreshCompanyResearch, repairCompanyResearch } from '../src/lib/api'

test('research refresh is an explicit POST for the selected lead', async () => {
  const originalFetch = globalThis.fetch
  let requestUrl = ''
  let requestMethod = ''
  globalThis.fetch = async (input, init) => {
    requestUrl = String(input)
    requestMethod = init?.method || ''
    return new Response(JSON.stringify({ lead: { id: 'lead-1' }, research: { summary: '', sources: [], facts: {} } }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    })
  }
  try {
    const response = await refreshCompanyResearch('lead-1')
    assert.equal(requestUrl, '/api/backend/api/leads/lead-1/research/refresh')
    assert.equal(requestMethod, 'POST')
    assert.equal(response.lead.id, 'lead-1')
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('saved research repair uses a separate explicit POST without provider refresh', async () => {
  const originalFetch = globalThis.fetch
  let requestUrl = ''
  let requestMethod = ''
  globalThis.fetch = async (input, init) => {
    requestUrl = String(input)
    requestMethod = init?.method || ''
    return new Response(JSON.stringify({ lead: { id: 'lead-2' }, research: { summary: '', sources: [], facts: {} } }), { status: 200 })
  }
  try {
    const result = await repairCompanyResearch('lead-2')
    assert.equal(requestUrl, '/api/backend/api/leads/lead-2/research/repair')
    assert.equal(requestMethod, 'POST')
    assert.equal(result.lead.id, 'lead-2')
  } finally {
    globalThis.fetch = originalFetch
  }
})
