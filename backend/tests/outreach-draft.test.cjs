const test = require('node:test')
const assert = require('node:assert/strict')
const { execFileSync } = require('node:child_process')
const path = require('node:path')
const { aiRouter } = require('../dist/routes/ai.routes.js')
const { leadsRouter } = require('../dist/routes/leads.routes.js')
const { sheetsRouter } = require('../dist/routes/sheets.routes.js')
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

async function save(body) {
  const route = sheetsRouter.stack.find(layer => layer.route?.path === '/outreach' && layer.route.methods.post).route
  const result = { status: 200, body: null }
  const response = { status(value) { result.status = value; return this }, json(value) { result.body = value; return this } }
  await route.stack[0].handle({ body }, response)
  return result
}

function stubbed(run) {
  const originals = {
    getLeads: GoogleSheetsService.getLeads,
    readData: GoogleSheetsService.readData,
    writeData: GoogleSheetsService.writeData,
    syncToGoogleSheet: GoogleSheetsService.syncToGoogleSheet,
    searchPOCs: TavilyService.searchPOCs,
    searchCompany: TavilyService.searchCompany,
    identifyPOCs: SalesGeminiService.identifyPOCs,
    researchCompany: SalesGeminiService.researchCompany,
    draftPersonalizedEmail: SalesGeminiService.draftPersonalizedEmail,
  }
  GoogleSheetsService.getLeads = async () => [lead]
  let data = { leads: [lead], outreach: [], followUpSequences: [], meetings: [], deals: [] }
  GoogleSheetsService.readData = async () => structuredClone(data)
  GoogleSheetsService.writeData = async value => { data = structuredClone(value) }
  GoogleSheetsService.syncToGoogleSheet = async () => ({ synced: false })
  TavilyService.searchCompany = async () => [{ title: 'Company', url: 'https://example.com/company', content: 'Supported context' }]
  SalesGeminiService.researchCompany = async () => ({ summary: 'Supported summary', sources: [{ title: 'Company', url: 'https://example.com/company' }], model: 'test' })
  SalesGeminiService.draftPersonalizedEmail = async () => ({ subject: 'A subject', body: 'A supported draft.' })
  return Promise.resolve(run({ read: () => structuredClone(data) })).finally(() => {
    Object.assign(GoogleSheetsService, { getLeads: originals.getLeads, readData: originals.readData, writeData: originals.writeData, syncToGoogleSheet: originals.syncToGoogleSheet })
    Object.assign(TavilyService, { searchPOCs: originals.searchPOCs, searchCompany: originals.searchCompany })
    Object.assign(SalesGeminiService, {
      identifyPOCs: originals.identifyPOCs,
      researchCompany: originals.researchCompany,
      draftPersonalizedEmail: originals.draftPersonalizedEmail,
    })
    POCVerificationCache.clear()
  })
}

test('drafting and saving reuse sourced discovery across cache misses with local and shared signing keys', async () => stubbed(async ({ read }) => {
  const originalDatabaseUrl = process.env.DATABASE_URL
  try {
    for (const databaseUrl of ['', 'postgresql://isolated:isolated@localhost/isolated']) {
      process.env.DATABASE_URL = databaseUrl
      await GoogleSheetsService.writeData({ leads: [lead], outreach: [], followUpSequences: [], meetings: [], deals: [] })
      TavilyService.searchPOCs = async () => [{ title: 'Team', url: poc.sourceUrl, content: `${poc.name} — ${poc.role}` }]
      SalesGeminiService.identifyPOCs = async () => [poc]
      const discovery = await discover(lead.id)
      assert.equal(discovery.status, 200)
      const selected = discovery.body.pocs[0]
      assert.equal(selected.name, poc.name)
      assert.equal(typeof selected.verificationToken, 'string')
      POCVerificationCache.clear() // A different Vercel instance has no discovery cache.

      TavilyService.searchPOCs = async () => { throw new Error('POC discovery must not be repeated for a signed selection') }
      const result = await request({ prospect: { leadId: lead.id, company: lead.company, poc: { ...selected, role: 'Unsupported title' }, channel: 'email', tone: 'consultative' } })
      assert.equal(result.status, 200)
      assert.equal(result.body.subject, 'A subject')
      assert.equal(result.body.body, 'A supported draft.')
      assert.deepEqual(result.body.poc, poc)
      assert.equal(result.body.reviewRequired, true)

      const saved = await save({ status: 'DRAFT', leadId: lead.id, company: lead.company, poc: selected, channel: 'email', subject: result.body.subject, body: result.body.body })
      assert.equal(saved.status, 201)
      assert.equal(saved.body.email, null)
      assert.equal(saved.body.poc.name, poc.name)
      assert.equal(saved.body.poc.sourceUrl, poc.sourceUrl)
      assert.equal(saved.body.poc.verificationToken, undefined)
      assert.equal(read().outreach.length, 1)
      POCVerificationCache.clear()
    }
  } finally {
    if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL
    else process.env.DATABASE_URL = originalDatabaseUrl
  }
}))

test('altered or expired discovery evidence requires refreshing and reselection', async () => stubbed(async ({ read }) => {
  const selected = { ...poc, verificationToken: POCVerificationCache.issue(lead, poc) }
  POCVerificationCache.store(lead.id, [poc])
  TavilyService.searchPOCs = async () => { throw new Error('Invalid selection must not call providers') }

  const result = await request({ prospect: { leadId: lead.id, company: lead.company, poc: { ...selected, sourceUrl: 'https://example.com/forged' }, channel: 'email', tone: 'consultative' } })

  assert.equal(result.status, 409)
  assert.equal(result.body.code, 'POC_SELECTION_STALE')
  const saveResult = await save({ status: 'DRAFT', leadId: lead.id, company: lead.company, poc: { ...selected, sourceUrl: 'https://example.com/forged' }, channel: 'email', subject: 'A subject', body: 'A supported draft.' })
  assert.equal(saveResult.status, 409)
  assert.equal(read().outreach.length, 0)
  assert.equal(POCVerificationCache.verify(lead, selected, Date.now() + 16 * 60 * 1000), null)
  assert.equal(POCVerificationCache.verify({ ...lead, id: 'other-lead' }, selected), null)
  assert.equal(POCVerificationCache.verify({ ...lead, company: 'Other Co' }, selected), null)
}))

test('a separate PostgreSQL-backed function instance accepts the same signed selection', () => {
  const previous = process.env.DATABASE_URL
  const databaseUrl = 'postgresql://isolated:isolated@localhost/isolated'
  try {
    process.env.DATABASE_URL = databaseUrl
    const selected = { ...poc, verificationToken: POCVerificationCache.issue(lead, poc) }
    const result = execFileSync(process.execPath, ['-e',
      "const {POCVerificationCache}=require('./dist/services/poc-verification-cache.service.js');process.stdout.write(POCVerificationCache.verify(JSON.parse(process.env.TEST_LEAD),JSON.parse(process.env.TEST_POC))?'verified':'rejected')",
    ], { cwd: path.resolve(__dirname, '..'), env: { ...process.env, DATABASE_URL: databaseUrl, TEST_LEAD: JSON.stringify(lead), TEST_POC: JSON.stringify(selected) }, encoding: 'utf8' })
    assert.equal(result, 'verified')
  } finally { if (previous === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = previous }
})

test('legacy cache miss distinguishes provider failure from an unverified contact', async () => stubbed(async ({ read }) => {
  TavilyService.searchPOCs = async () => { throw new Error('Isolated provider failure') }
  const result = await request({ prospect: { leadId: lead.id, company: lead.company, poc, channel: 'email', tone: 'consultative' } })
  assert.equal(result.status, 503)
  assert.equal(result.body.code, 'POC_VERIFICATION_UNAVAILABLE')
  const saveResult = await save({ status: 'DRAFT', leadId: lead.id, company: lead.company, poc, channel: 'email', subject: 'A subject', body: 'A supported draft.' })
  assert.equal(saveResult.status, 503)
  assert.equal(saveResult.body.code, 'POC_VERIFICATION_UNAVAILABLE')
  assert.equal(read().outreach.length, 0)
}))
