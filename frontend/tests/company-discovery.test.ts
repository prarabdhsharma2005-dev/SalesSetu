import test from 'node:test'
import assert from 'node:assert/strict'
import { discoverCompanies, loadMoreCompanies, saveDiscoveredCompanies, validCompanyLinkedInUrl, pocDiscoveryErrorMessage } from '../src/lib/api'

test('POC provider and timeout errors are readable', () => {
  assert.equal(pocDiscoveryErrorMessage(new Error('Request timed out after 60s')), 'POC discovery timed out. No contact was selected; retry later.')
  assert.equal(pocDiscoveryErrorMessage(new Error('API 429: {"error":"POC discovery provider quota is unavailable. Try again later."}')), 'POC discovery provider quota is unavailable. Try again later.')
})

test('lead views accept only company LinkedIn pages over HTTPS', () => {
  assert.equal(validCompanyLinkedInUrl('https://www.linkedin.com/company/beta-systems/'), 'https://www.linkedin.com/company/beta-systems/')
  for (const url of ['https://www.linkedin.com/in/person/', 'http://www.linkedin.com/company/beta-systems/', 'https://linkedin.com.evil.example/company/beta-systems/', 'javascript:alert(1)']) {
    assert.equal(validCompanyLinkedInUrl(url), null)
  }
})

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
