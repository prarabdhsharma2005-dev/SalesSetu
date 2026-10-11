const test = require('node:test')
const assert = require('node:assert/strict')
const { runInWorkspace } = require('../dist/services/workspace-context.service.js')
const { GoogleSheetsService } = require('../dist/services/sheets.service.js')
const { SalesGeminiService } = require('../dist/services/gemini.service.js')
const { TavilyService } = require('../dist/services/tavily.service.js')
const { POCVerificationCache } = require('../dist/services/poc-verification-cache.service.js')
const { aiRouter } = require('../dist/routes/ai.routes.js')
const { sheetsRouter } = require('../dist/routes/sheets.routes.js')

const lead = { id: 'lead-workspace', company: 'Evidence Co', website: 'https://evidence.example', industry: 'SaaS', city: 'Pune', country: 'India', employees: 40, intentSignal: '', qualificationStatus: 'needs_review', qualificationScore: 63, qualificationReasons: ['Review intent'], companyResearch: { summary: 'Evidence Co sells a supported service.', sources: [{ title: 'Company', url: 'https://evidence.example/about' }], facts: {}, updatedAt: '2026-01-01T00:00:00.000Z' } }
const poc = { name: 'Named Contact', role: 'Director', department: 'Sales', sourceUrl: 'https://evidence.example/team', profileUrl: null, confidence: 0.9 }
const context = { sellerName: 'Seller', sellerCompany: 'Seller Co', productName: 'Sales Tool', productDescription: 'Helps teams prepare outreach.' }

async function route(router, method, path, body, params = {}) {
  const layer = router.stack.find(item => item.route?.path === path && item.route.methods[method])
  assert.ok(layer)
  const result = { status: 200, body: null }
  const res = { status(code) { result.status = code; return this }, set() { return this }, json(value) { result.body = value; return this } }
  await layer.route.stack[0].handle({ body, params }, res)
  return result
}

test('workspace draft uses saved seller/company evidence, treats qualification as advice, and blocks missing research', async () => {
  const priorMode = process.env.GOOGLE_WORKSPACES_ENABLED
  process.env.GOOGLE_WORKSPACES_ENABLED = 'true'
  const a = '123456789012345678901', b = '999999999999999999999'
  const stores = new Map([[a, { leads: [lead], outreach: [] }], [b, { leads: [], outreach: [] }]])
  const originals = {
    readData: GoogleSheetsService.readData, writeData: GoogleSheetsService.writeData, getLeads: GoogleSheetsService.getLeads,
    searchCompany: TavilyService.searchCompany, draftPersonalizedEmail: SalesGeminiService.draftPersonalizedEmail,
  }
  const calls = []
  GoogleSheetsService.readData = async () => structuredClone(stores.get(require('../dist/services/workspace-context.service.js').currentWorkspace()))
  GoogleSheetsService.writeData = async data => { stores.set(require('../dist/services/workspace-context.service.js').currentWorkspace(), structuredClone(data)) }
  GoogleSheetsService.getLeads = async () => (await GoogleSheetsService.readData()).leads
  TavilyService.searchCompany = async () => { throw new Error('Company search must not run for persisted research') }
  SalesGeminiService.draftPersonalizedEmail = async input => { calls.push(input); return { subject: 'Supported subject', body: 'Supported body' } }
  try {
    const selected = { ...poc, verificationToken: runInWorkspace(a, () => POCVerificationCache.issue(lead, poc)) }
    const request = () => route(aiRouter, 'post', '/draft-email', { prospect: { leadId: lead.id, company: lead.company, poc: selected, channel: 'email' } })
    assert.equal((await runInWorkspace(a, request)).body.code, 'SELLER_CONTEXT_REQUIRED')
    assert.equal((await runInWorkspace(a, () => route(sheetsRouter, 'put', '/sales-context', { context }))).status, 200)
    assert.equal((await runInWorkspace(b, () => route(sheetsRouter, 'get', '/sales-context'))).body.context, null)
    assert.deepEqual((await runInWorkspace(a, () => route(sheetsRouter, 'get', '/sales-context'))).body.context, context)
    assert.equal((await runInWorkspace(b, request)).status, 404)
    const result = await runInWorkspace(a, request)
    assert.equal(result.status, 200)
    assert.equal(result.body.subject, 'Supported subject')
    assert.equal(calls.length, 1)
    assert.equal(calls[0].researchSummary, lead.companyResearch.summary)
    assert.equal(calls[0].productName, context.productName)
    assert.equal(calls[0].senderName, context.sellerName)
    assert.equal(calls[0].industry, '')
    assert.equal(calls[0].employees, undefined)
    assert.equal(calls[0].intentSignal, '')
    SalesGeminiService.draftPersonalizedEmail = async () => { throw Object.assign(new Error('provider quota'), { status: 429 }) }
    const quota = await runInWorkspace(a, request)
    assert.equal(quota.body.code, 'AI_QUOTA')
    assert.equal(quota.body.provider, 'Gemini')
    assert.equal(quota.body.quotaMetric, undefined)
    assert.equal(quota.body.quotaKind, 'unknown')
    assert.equal(stores.get(a).outreach.length, 0)
    const manual = await runInWorkspace(a, () => route(sheetsRouter, 'post', '/outreach', {
      status: 'DRAFT', leadId: lead.id, company: lead.company, poc: selected, channel: 'email',
      subject: 'Manually written subject', body: 'Manually written body', draftOrigin: 'MANUAL',
    }))
    assert.equal(manual.status, 201)
    assert.equal(manual.body.draftOrigin, 'MANUAL')
    assert.equal(manual.body.email, null)
    assert.equal((await runInWorkspace(b, () => route(sheetsRouter, 'get', '/outreach'))).body.total, 0)
    SalesGeminiService.draftPersonalizedEmail = async input => { calls.push(input); return { subject: 'Supported subject', body: 'Supported body' } }
    const draft = await runInWorkspace(a, () => route(sheetsRouter, 'post', '/outreach', { status: 'DRAFT', leadId: lead.id, company: lead.company, poc: selected, channel: 'email', subject: result.body.subject, body: result.body.body }))
    assert.equal(draft.status, 201)
    assert.equal(draft.body.leadId, lead.id)
    assert.equal(draft.body.poc.name, poc.name)
    assert.equal((await runInWorkspace(a, () => route(sheetsRouter, 'get', '/outreach'))).body.total, 2)
    assert.equal((await runInWorkspace(b, () => route(sheetsRouter, 'get', '/outreach'))).body.total, 0)
    stores.get(a).leads[0].qualificationIcpStale = true
    assert.equal((await runInWorkspace(a, request)).status, 200)
    assert.equal(calls.length, 2)
    for (const status of [undefined, 'qualified', 'needs_review', 'not_qualified']) {
      stores.get(a).leads[0].qualificationStatus = status
      const advisoryDraft = await runInWorkspace(a, request)
      assert.equal(advisoryDraft.status, 200, String(status))
      assert.equal(advisoryDraft.body.reviewRequired, status === 'needs_review')
      const saved = await runInWorkspace(a, () => route(sheetsRouter, 'post', '/outreach', {
        status: 'DRAFT', leadId: lead.id, company: lead.company, poc: selected, channel: 'email',
        subject: 'Supported subject', body: `Supported body ${status || 'unassessed'}`,
      }))
      assert.equal(saved.status, 201, String(status))
      const pending = await runInWorkspace(a, () => route(sheetsRouter, 'patch', '/outreach/:id', { expectedUpdatedAt: saved.body.updatedAt, status: 'PENDING_APPROVAL' }, { id: saved.body.id }))
      assert.equal(pending.status, 200, String(status))
      const approved = await runInWorkspace(a, () => route(sheetsRouter, 'patch', '/outreach/:id', { expectedUpdatedAt: pending.body.updatedAt, status: 'APPROVED' }, { id: saved.body.id }))
      assert.equal(approved.status, 200, String(status))
    }
    assert.equal(calls.length, 6)
    stores.get(a).leads[0].qualificationIcpStale = false
    stores.get(a).leads[0].companyResearch = undefined
    assert.equal((await runInWorkspace(a, request)).body.code, 'COMPANY_RESEARCH_REQUIRED')
    assert.equal(calls.length, 6)
  } finally {
    Object.assign(GoogleSheetsService, { readData: originals.readData, writeData: originals.writeData, getLeads: originals.getLeads })
    TavilyService.searchCompany = originals.searchCompany
    SalesGeminiService.draftPersonalizedEmail = originals.draftPersonalizedEmail
    POCVerificationCache.clear()
    if (priorMode === undefined) delete process.env.GOOGLE_WORKSPACES_ENABLED
    else process.env.GOOGLE_WORKSPACES_ENABLED = priorMode
  }
})
