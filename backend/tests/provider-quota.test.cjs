const test = require('node:test')
const assert = require('node:assert/strict')
const { geminiQuotaDetails } = require('../dist/services/provider-quota.service.js')

test('only safe Gemini quota fields are exposed and unknown fields stay unknown', () => {
  const details = geminiQuotaDetails({
    status: 429, attemptedModel: 'gemini-3.5-flash-lite',
    errorDetails: [
      { violations: [{ quotaMetric: 'generativelanguage.googleapis.com/generate_content_free_tier_requests', quotaId: 'GenerateRequestsPerDay', quotaValue: '20', quotaDimensions: { project: 'private' } }] },
      { retryDelay: '42s' },
    ],
  })
  assert.equal(details.model, 'gemini-3.5-flash-lite')
  assert.equal(details.quotaKind, 'daily')
  assert.equal(details.limit, 20)
  assert.equal(details.retrySeconds, 42)
  assert.equal(JSON.stringify(details).includes('private'), false)
  const unknown = geminiQuotaDetails({ status: 429 })
  assert.equal(unknown.quotaMetric, undefined)
  assert.equal(unknown.limit, undefined)
  assert.equal(unknown.quotaKind, 'unknown')
})
