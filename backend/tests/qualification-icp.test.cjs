const test = require('node:test')
const assert = require('node:assert/strict')
const { assessIcpCriteria, calculateQualificationScore, qualificationNeedsRecheck, validateQualificationIcp } = require('../dist/services/qualification-icp.service.js')

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

test('missing employee evidence stays unknown and saved results track the ICP revision', () => {
  const criteria = assessIcpCriteria({ ...lead, employees: '' }, validateQualificationIcp({ minEmp: '100', maxEmp: '500' }))
  assert.equal(criteria.find(item => item.key === 'company_size').score, null)
  const rulebook = { savedAt: '2026-01-01T00:00:00.000Z' }
  assert.equal(qualificationNeedsRecheck({ qualificationStatus: 'qualified', qualificationIcpSavedAt: rulebook.savedAt }, rulebook), false)
  assert.equal(qualificationNeedsRecheck({ qualificationStatus: 'qualified', qualificationIcpSavedAt: '2025-12-31T00:00:00.000Z' }, rulebook), true)
  assert.equal(qualificationNeedsRecheck({ qualificationStatus: 'needs_review' }, rulebook), true)
  assert.equal(qualificationNeedsRecheck({ qualificationStatus: undefined }, rulebook), false)
})

test('normalizes supported industry and city aliases while retaining original facts and points', () => {
  const criteria = assessIcpCriteria({ ...lead, industry: 'fintech', city: 'Bengaluru', employees: '' }, validateQualificationIcp({ industries: ['FinTech'], cities: ['Bangalore'], minEmp: 10, maxEmp: 500 }))
  const byKey = Object.fromEntries(criteria.map(item => [item.key, item]))
  assert.equal(byKey.industry_fit.score, 100)
  assert.match(byKey.industry_fit.assessment, /fintech.*FinTech.*100\/100 points/i)
  assert.equal(byKey.geography_fit.score, 100)
  assert.match(byKey.geography_fit.assessment, /Bengaluru.*Bangalore.*100\/100 points/i)
  assert.equal(byKey.company_size.score, null)
  assert.equal(calculateQualificationScore(criteria), 100)
  assert.equal(byKey.geography_fit.evidence.find(item => item.field === 'city').value, 'Bengaluru')
})

test('maps cited Bellandur to Bengaluru through the BBMP ward source', () => {
  const criteria = assessIcpCriteria({ ...lead, city: 'Bellandur' }, validateQualificationIcp({ cities: ['Bangalore'] }))
  const city = criteria.find(item => item.key === 'geography_fit')
  assert.equal(city.score, 100)
  assert.equal(city.evidence.find(item => item.field === 'city').value, 'Bellandur')
  assert.equal(city.evidence.find(item => item.field === 'normalized city').sourceUrl, 'https://site.bbmp.gov.in/zonalclassification.html')
  assert.equal(city.evidence.find(item => item.field === 'matched ICP city').value, 'Bangalore')
})

test('classifies cited Groww stockbroking as fintech but leaves generic financial services unknown', () => {
  const icp = validateQualificationIcp({ industries: ['FinTech'], cities: ['Bangalore'], minEmp: 10, maxEmp: 500 })
  const sourceUrl = 'https://www.cbinsights.com/company/groww'
  const research = {
    summary: `Groww is a multi-product financial services platform based in Bellandur, Karnataka, that operates in the stock broking and investment sector (${sourceUrl}).`,
    sources: [{ title: 'Groww - Products, Competitors, Financials', url: sourceUrl }],
    facts: { industry: { value: 'financial services', sourceUrl, basis: 'cited_summary' }, city: { value: 'Bellandur', sourceUrl, basis: 'cited_summary' } },
  }
  const supported = assessIcpCriteria({ company: 'Groww', industry: 'financial services', city: 'Bellandur', employees: '', companyResearch: research }, icp)
  const byKey = Object.fromEntries(supported.map(item => [item.key, item]))
  assert.equal(byKey.industry_fit.score, 100)
  assert.equal(byKey.geography_fit.score, 100)
  assert.equal(byKey.company_size.score, null)
  assert.equal(byKey.industry_fit.evidence.find(item => item.field === 'normalized industry').sourceUrl, sourceUrl)
  assert.equal(byKey.industry_fit.evidence.find(item => item.field === 'industry').value, 'financial services')
  assert.equal(calculateQualificationScore(supported), 100)

  const generic = assessIcpCriteria({ company: 'Groww', industry: 'financial services', city: 'Bellandur', employees: '', companyResearch: { ...research, summary: `Groww is a financial services company based in Bellandur (${sourceUrl}).` } }, icp)
  assert.equal(generic.find(item => item.key === 'industry_fit').score, null)
  assert.equal(generic.find(item => item.key === 'geography_fit').score, 100)
  assert.equal(calculateQualificationScore(generic), 100) // Unknown does not become a zero-fit dimension.

  const untrusted = assessIcpCriteria({ company: 'Groww', industry: 'financial services', city: 'Bellandur', employees: '', companyResearch: { ...research, sources: [{ title: 'Other company', url: sourceUrl }] } }, icp)
  assert.equal(untrusted.find(item => item.key === 'industry_fit').score, null)
  const traditionalBroker = assessIcpCriteria({ company: 'Groww', industry: 'financial services', city: 'Bellandur', employees: '', companyResearch: { ...research, summary: `Groww operates in stock broking (${sourceUrl}).` } }, icp)
  assert.equal(traditionalBroker.find(item => item.key === 'industry_fit').score, null)
})

test('unknown classifications stay unknown while supported nonmatches earn zero', () => {
  const icp = validateQualificationIcp({ industries: ['FinTech'], cities: ['Bangalore'] })
  const unknown = assessIcpCriteria({ ...lead, industry: 'business services', city: 'Koramangala' }, icp)
  assert.equal(unknown.find(item => item.key === 'industry_fit').score, null)
  assert.equal(unknown.find(item => item.key === 'geography_fit').score, null)
  assert.equal(calculateQualificationScore(unknown), null)
  const mismatch = assessIcpCriteria({ ...lead, industry: 'SaaS', city: 'Pune' }, icp)
  assert.equal(mismatch.find(item => item.key === 'industry_fit').score, 0)
  assert.equal(mismatch.find(item => item.key === 'geography_fit').score, 0)
  assert.equal(calculateQualificationScore(mismatch), 0)
})
