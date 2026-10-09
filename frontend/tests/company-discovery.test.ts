import test from 'node:test'
import assert from 'node:assert/strict'
import { discoverCompanies, loadMoreCompanies, saveDiscoveredCompanies } from '../src/lib/api'

test('company discovery requires an explicit request per batch and saves selected IDs only', async () => {
  const original = globalThis.fetch
  const requests: Array<{ url: string; method: string; body: unknown }> = []
  globalThis.fetch = async (input, init) => {
    requests.push({ url: String(input), method: init?.method || 'GET', body: JSON.parse(String(init?.body)) })
    return new Response(JSON.stringify(requests.length === 3 ? { saved: [], alreadySaved: [] } : { id: 'private-session', companies: [], batch: requests.length - 1, hasMore: true }), { status: 200 })
  }
  try {
    assert.equal(requests.length, 0)
    await discoverCompanies({ query: 'SaaS companies in Pune', industry: 'SaaS', city: 'Pune', intent: '' })
    assert.equal(requests.length, 1)
    await loadMoreCompanies('private-session', 1)
    assert.equal(requests.length, 2)
    await saveDiscoveredCompanies('private-session', ['candidate-1'])
    assert.deepEqual(requests, [
      { url: '/api/backend/api/leads/discovery', method: 'POST', body: { query: 'SaaS companies in Pune', industry: 'SaaS', city: 'Pune', intent: '' } },
      { url: '/api/backend/api/leads/discovery/private-session/next', method: 'POST', body: { batch: 1 } },
      { url: '/api/backend/api/leads/discovery/private-session/save', method: 'POST', body: { candidateIds: ['candidate-1'] } },
    ])
  } finally { globalThis.fetch = original }
})
