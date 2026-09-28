const test = require('node:test')
const assert = require('node:assert/strict')
const { assessIcpCriteria, calculateQualificationScore, validateQualificationIcp } = require('../dist/services/qualification-icp.service.js')

const lead = { industry: 'SaaS', country: 'India', city: 'Chennai', employees: 15000 }

test('validates and normalizes the existing saved ICP rulebook shape', () => {
  assert.deepEqual(validateQualificationIcp({
    industries: ['SaaS', 'FinTech'], cities: ['Chennai'], stages: ['Series A'], intents: ['HOT'],
    minEmp: '100', maxEmp: '10000', minScore: '60', aiResult: { arbitrary: true }, savedAt: 'timestamp',
  }), {
    industries: ['SaaS', 'FinTech'], cities: ['Chennai'], stages: ['Series A'], intents: ['HOT'],
    minEmp: 100, maxEmp: 10000, minScore: 60,
  })
})

test('rejects malformed ICP fields and inverted employee ranges', () => {
  assert.throws(() => validateQualificationIcp({ industries: 'SaaS' }), /Invalid ICP industries/)
  assert.throws(() => validateQualificationIcp({ minEmp: '500', maxEmp: '100' }), /Invalid ICP employee range/)
})

test('assesses exact matching and non-matching industry, geography, and employee range', () => {
  const criteria = assessIcpCriteria(lead, validateQualificationIcp({ industries: ['SaaS'], cities: ['Chennai'], minEmp: '100', maxEmp: '10000' }))
  const byKey = Object.fromEntries(criteria.map(item => [item.key, item]))
  assert.equal(byKey.industry_fit.rating, 'strong')
  assert.equal(byKey.geography_fit.rating, 'strong')
  assert.equal(byKey.company_size.rating, 'weak')
  assert.equal(byKey.company_size.score, 0)
  assert.equal(byKey.icp_fit.score, 67)
  assert.equal(byKey.industry_fit.evidence[1].origin, 'user_defined')

  const nonMatching = assessIcpCriteria(lead, validateQualificationIcp({ industries: ['FinTech'], cities: ['Mumbai'], minEmp: '100', maxEmp: '10000' }))
  assert.deepEqual(nonMatching.filter(item => item.key !== 'icp_fit').map(item => item.score), [0, 0, 0])
  assert.equal(nonMatching[0].score, 0)
})

test('leaves absent ICP fields unknown and does not cap the score at 50', () => {
  const partial = assessIcpCriteria(lead, validateQualificationIcp({ industries: ['SaaS'] }))
  const byKey = Object.fromEntries(partial.map(item => [item.key, item]))
  assert.equal(byKey.industry_fit.score, 100)
  assert.equal(byKey.geography_fit.rating, 'unknown')
  assert.equal(byKey.company_size.rating, 'unknown')
  assert.equal(byKey.icp_fit.score, 100)
  assert.equal(calculateQualificationScore([
    ...partial,
    { key: 'intent_signal', label: 'Intent signal', rating: 'moderate', score: 50, assessment: 'stored', evidence: [] },
  ]), 75)
  assert.equal(validateQualificationIcp(null), null)
})
