const test = require('node:test')
const assert = require('node:assert/strict')
const { parseLeadSearch } = require('../dist/services/lead-search.service.js')

test('extracts supported industry and city from the Lead Discovery example', () => {
  assert.deepEqual(parseLeadSearch('SaaS companies in Bangalore raising funds'), {
    query: 'raising funds', industry: 'SaaS', city: 'Bangalore', intent: '',
  })
})

test('keeps an ordinary company name as a literal search', () => {
  assert.deepEqual(parseLeadSearch('Razorpay'), {
    query: 'Razorpay', industry: '', city: '', intent: '',
  })
})

test('recognizes canonical intent and does not override explicit filter controls', () => {
  assert.deepEqual(parseLeadSearch('SaaS in Bangalore hot', {
    industry: 'FinTech', city: 'Mumbai', intent: 'COLD',
  }), {
    query: '', industry: 'FinTech', city: 'Mumbai', intent: 'COLD',
  })
  assert.deepEqual(parseLeadSearch('warm leads'), {
    query: '', industry: '', city: '', intent: 'WARM',
  })
})

test('preserves unrecognized queries as literal searches', () => {
  const query = 'emerging quantum procurement signals'
  assert.deepEqual(parseLeadSearch(query), {
    query, industry: '', city: '', intent: '',
  })
})
