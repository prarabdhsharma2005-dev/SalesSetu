const test = require('node:test')
const assert = require('node:assert/strict')
const { aiRouter } = require('../dist/routes/ai.routes.js')
const { leadsRouter } = require('../dist/routes/leads.routes.js')
const { GoogleSheetsService } = require('../dist/services/sheets.service.js')
const { SalesGeminiService } = require('../dist/services/gemini.service.js')
const { TavilyService } = require('../dist/services/tavily.service.js')
const { POCVerificationCache } = require('../dist/services/poc-verification-cache.service.js')

const lead = {
  id: 'lead-outreach', company: 'Example Co', website: 'https://example.com', industry: 'SaaS',
  city: 'Bengaluru', country: 'India', employees: 120, intentSignal: 'Evaluating automation',
  qualificationStatus: 'needs_review', qualificationScore: 70, qualificationReasons: ['Review evidence'],
  qualificationEvidence: [],
}
const poc = {
  name: 'A Contact', role: 'Director', department: 'Sales', seniority: 'Director', profileUrl: null,
  emailStatus: 'unknown', location: null, relevanceReason: 'Owns sales operations',
  sourceUrl: 'https://example.com/team', confidence: 0.9, evidenceType: 'sourced',
}

async function request(body) {
  const route = aiRouter.stack.find(layer => layer.route?.path === '/draft-email' && layer.route.methods.post).route
  const result = { status: 200, body: null }
  const response = { status(value) { result.status = value; return this }, json(value) { result.body = value; return this } }
  await route.stack[0].handle({ body }, response)
  return result
}

async function discover(leadId) {
  const route = leadsRouter.stack.find(layer => layer.route?.path === '/:id/pocs' && layer.route.methods.get).route
  const result = { status: 200, body: null }
  const response = { status(value) { result.status = value; return this }, json(value) { result.body = value; return this } }
  await route.stack[0].handle({ params: { id: leadId } }, response)
  return result
}

function stubbed(run) {
  const originals = {
    getLeads: GoogleSheetsService.getLeads,
    searchPOCs: TavilyService.searchPOCs,
    searchCompany: TavilyService.searchCompany,
    identifyPOCs: SalesGeminiService.identifyPOCs,
    researchCompany: SalesGeminiService.researchCompany,
    draftPersonalizedEmail: SalesGeminiService.draftPersonalizedEmail,
  }
  GoogleSheetsService.getLeads = async () => [lead]
  TavilyService.searchCompany = async () => [{ title: 'Company', url: 'https://example.com/company', content: 'Supported context' }]
  SalesGeminiService.researchCompany = async () => ({ summary: 'Supported summary', sources: [{ title: 'Company', url: 'https://example.com/company' }], model: 'test' })
  SalesGeminiService.draftPersonalizedEmail = async () => ({ subject: 'A subject', body: 'A supported draft.' })
  return Promise.resolve(run()).finally(() => {
    Object.assign(GoogleSheetsService, { getLeads: originals.getLeads })
    Object.assign(TavilyService, { searchPOCs: originals.searchPOCs, searchCompany: originals.searchCompany })
    Object.assign(SalesGeminiService, {
      identifyPOCs: originals.identifyPOCs,
      researchCompany: originals.researchCompany,
      draftPersonalizedEmail: originals.draftPersonalizedEmail,
    })
    POCVerificationCache.clear()
  })
}

test('drafting reuses the exact backend-accepted POC instead of rerunning variable discovery', async () => stubbed(async () => {
  TavilyService.searchPOCs = async () => [{ title: 'Team', url: poc.sourceUrl, content: `${poc.name} — ${poc.role}` }]
  SalesGeminiService.identifyPOCs = async () => [poc]
  const discovery = await discover(lead.id)
  assert.equal(discovery.status, 200)
  assert.deepEqual(discovery.body.pocs, [poc])

  TavilyService.searchPOCs = async () => { throw new Error('POC discovery must not be repeated for a cached selection') }

  const result = await request({ prospect: { leadId: lead.id, company: lead.company, poc, channel: 'email', tone: 'consultative' } })

  assert.equal(result.status, 200)
  assert.equal(result.body.subject, 'A subject')
  assert.equal(result.body.body, 'A supported draft.')
  assert.deepEqual(result.body.poc, poc)
  assert.equal(result.body.reviewRequired, true)
}))

test('an altered POC is not trusted when it is absent from both cache and fresh verification', async () => stubbed(async () => {
  POCVerificationCache.store(lead.id, [poc])
  TavilyService.searchPOCs = async () => []
  SalesGeminiService.identifyPOCs = async () => []

  const result = await request({ prospect: { leadId: lead.id, company: lead.company, poc: { ...poc, sourceUrl: 'https://example.com/forged' }, channel: 'email', tone: 'consultative' } })

  assert.equal(result.status, 400)
  assert.match(result.body.error, /could not be verified/)
}))
