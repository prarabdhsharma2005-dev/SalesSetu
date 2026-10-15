import assert from 'node:assert/strict'
import test from 'node:test'
import { companyWebsiteErrorMessage, confirmDraftCompanyWebsite, findDraftPocWorkEmail, workEmailLookupErrorMessage } from '../src/lib/api'

test('selected-POC lookup exposes sanitized provider states and manual fallback', () => {
  for (const [code, message] of [
    [503, 'Apollo is not configured. Set APOLLO_API_KEY on the backend, or enter a recipient manually.'],
    [403, 'Apollo enrichment access is unavailable for this key or account.'],
    [422, 'Apollo found no work email for this selected person.'],
    [422, 'Apollo could not establish the selected person and company unambiguously.'],
    [429, 'Apollo rate limit reached. Try again in 30 seconds.'],
  ] as const) {
    const visible = workEmailLookupErrorMessage(new Error(`API ${code}: ${JSON.stringify({ error: message })}`))
    assert.match(visible, new RegExp(message.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    assert.match(visible, /Manual recipient entry remains available/)
  }
  assert.match(workEmailLookupErrorMessage(new Error('Request timed out after 20s')), /Work-email lookup timed out/)
})

test('approval lookup identifies the saved draft and selected provider without changing a recipient', async () => {
  const previous = globalThis.fetch
  const requests: Array<{ url: string; body: unknown }> = []
  globalThis.fetch = async (input, init) => {
    requests.push({ url: String(input), body: JSON.parse(String(init?.body)) })
    return new Response(JSON.stringify({ status: 'found', email: 'priya@sample.example', provider: 'hunter', hunterMode: 'found_only', sourceType: 'found', providerStatus: 'valid', confidence: 91, sourceUrls: ['https://sample.example/team'], matchEvidence: ['exact_name'], lookedUpAt: '2026-10-15T00:00:00Z', cached: false }), { status: 200 })
  }
  try {
    const result = await findDraftPocWorkEmail('outreach-1', 'hunter')
    assert.equal(result.email, 'priya@sample.example')
    assert.equal(result.sourceType, 'found')
    await findDraftPocWorkEmail('outreach-1', 'hunter', 'include_inferred')
    await findDraftPocWorkEmail('outreach-1', 'apollo')
    assert.deepEqual(requests, [
      { url: '/api/backend/api/sheets/outreach/outreach-1/poc-email', body: { provider: 'hunter', hunterMode: 'found_only' } },
      { url: '/api/backend/api/sheets/outreach/outreach-1/poc-email', body: { provider: 'hunter', hunterMode: 'include_inferred' } },
      { url: '/api/backend/api/sheets/outreach/outreach-1/poc-email', body: { provider: 'apollo' } },
    ])
  } finally { globalThis.fetch = previous }
})

test('company website confirmation is tied to the saved draft and prior website value', async () => {
  const previous = globalThis.fetch
  let request: { url: string; body: unknown } | null = null
  globalThis.fetch = async (input, init) => {
    request = { url: String(input), body: JSON.parse(String(init?.body)) }
    return new Response(JSON.stringify({ lead: { id: 'lead-1', website: 'https://sample.com', websiteSource: 'user_provided' } }), { status: 200 })
  }
  try {
    await confirmDraftCompanyWebsite('draft-1', 'https://www.sample.com/about', '')
    assert.deepEqual(request, { url: '/api/backend/api/sheets/outreach/draft-1/company-website', body: { website: 'https://www.sample.com/about', expectedWebsite: '', confirmed: true } })
  } finally { globalThis.fetch = previous }
  assert.equal(companyWebsiteErrorMessage(new Error('API 409: {"error":"Company website changed since it was loaded. Refresh and confirm again."}')), 'Company website changed since it was loaded. Refresh and confirm again.')
})
