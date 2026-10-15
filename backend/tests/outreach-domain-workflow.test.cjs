const assert = require('node:assert/strict')
const test = require('node:test')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { createHmac } = require('node:crypto')

test('drafting needs no email; saved research or a user-confirmed website enables draft-bound lookup', async () => {
  const previous = { ...process.env }
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'salessetu-outreach-domain-'))
  Object.assign(process.env, { DATA_DIR: directory, DATABASE_URL: '', NODE_ENV: 'test', GOOGLE_WORKSPACES_ENABLED: 'true', INTERNAL_PROXY_SECRET: 'isolated-internal-secret-at-least-thirty-two-characters', APP_ACCESS_USER: 'isolated-service', APP_ACCESS_PASSWORD: 'isolated-service-password-more-than-24-chars', GOOGLE_SHEETS_WEBHOOK_URL: '', FOLLOW_UP_SCHEDULER_ENABLED: 'false', HUNTER_API_KEY: 'isolated-placeholder' })
  const app = require('../dist/app').default
  const { GoogleSheetsService } = require('../dist/services/sheets.service')
  const { runInWorkspace } = require('../dist/services/workspace-context.service')
  const { TavilyService } = require('../dist/services/tavily.service')
  const { SalesGeminiService } = require('../dist/services/gemini.service')
  const { HunterService } = require('../dist/services/hunter.service')
  const { confirmedCompanyDomain } = require('../dist/services/company-domain.service')
  const { companyDomain } = require('../dist/services/apollo.service')
  const original = { searchPOCs: TavilyService.searchPOCs, identifyPOCs: SalesGeminiService.identifyPOCs, hunter: HunterService.findWorkEmail }
  const profileUrl = 'https://www.linkedin.com/in/sourced-person-example/'
  TavilyService.searchPOCs = async () => [{ title: 'Sourced Person at selected company', url: profileUrl, content: 'Sourced Person works at the selected company.' }]
  SalesGeminiService.identifyPOCs = async () => [{ name: 'Sourced Person', role: 'Partnerships', department: 'Sales', profileUrl, sourceUrl: profileUrl, confidence: 0.9, evidenceType: 'sourced' }]
  let calls = 0
  HunterService.findWorkEmail = async ({ website }) => {
    calls++
    return { kind: 'found', email: `person@${website}`, sourceType: 'found', providerStatus: 'valid', confidence: 80, sourceUrls: [], matchEvidence: ['exact_name', 'employer_domain'] }
  }
  const server = app.listen(0)
  await new Promise(resolve => server.once('listening', resolve))
  const base = `http://127.0.0.1:${server.address().port}`
  const a = '123456789012345678901', b = '999999999999999999999'
  const request = (workspace, method, target, body) => {
    const timestamp = String(Date.now())
    const signature = createHmac('sha256', process.env.INTERNAL_PROXY_SECRET).update(`v1\n${timestamp}\n${workspace}\n${method}\n${target}`).digest('hex')
    return fetch(base + target, { method, headers: { authorization: `Basic ${Buffer.from(`${process.env.APP_ACCESS_USER}:${process.env.APP_ACCESS_PASSWORD}`).toString('base64')}`, 'x-salesetu-workspace': workspace, 'x-salesetu-timestamp': timestamp, 'x-salesetu-signature': signature, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
  }
  const leadBody = company => ({ company, website: '', industry: '', city: '', country: '', employees: '', intentSignal: '', leadScore: 0, status: 'PROSPECT' })
  try {
    assert.equal(companyDomain('https://www.docs.keka.co.in/about'), 'keka.co.in')
    assert.equal(companyDomain('https://jobs.simplismart.ai/team'), 'simplismart.ai')
    assert.equal(companyDomain('http://127.0.0.1/path'), null)
    const simplismart = await (await request(a, 'POST', '/api/sheets/leads', leadBody('Simplismart'))).json()
    const research = { summary: 'Saved sourced dossier.', sources: [{ title: 'Blog', url: 'https://blog.simplismart.ai/about' }, { title: 'Simplismart news', url: 'https://news.example.org/story' }], facts: {}, updatedAt: new Date().toISOString() }
    assert.equal(confirmedCompanyDomain({ ...simplismart, companyResearch: research }), 'simplismart.ai')
    assert.equal(confirmedCompanyDomain({ ...simplismart, discoverySources: [{ title: 'Simplismart', url: 'https://www.simplismart.ai/products' }] }), 'simplismart.ai')
    assert.equal(confirmedCompanyDomain({ ...simplismart, companyResearch: { ...research, sources: [{ title: 'Simplismart news', url: 'https://news.example.org/story' }] } }), null)
    const savedResearch = await runInWorkspace(a, () => GoogleSheetsService.saveCompanyResearch(simplismart.id, research))
    assert.equal(savedResearch.website, 'simplismart.ai')
    assert.equal(savedResearch.websiteSource, 'research_source')
    assert.equal((await (await request(a, 'GET', '/api/sheets/leads')).json()).leads.find(lead => lead.id === simplismart.id).website, 'simplismart.ai')

    const keka = await (await request(a, 'POST', '/api/sheets/leads', leadBody('Keka HR'))).json()
    const poc = (await (await request(a, 'GET', `/api/leads/${keka.id}/pocs`)).json()).pocs[0]
    const draftResponse = await request(a, 'POST', '/api/sheets/outreach', { leadId: keka.id, company: keka.company, poc: { ...poc, email: 'unsaved@wrong.example', emailProvider: 'hunter' }, channel: 'email', status: 'DRAFT', subject: 'Relevant subject', body: 'Relevant draft body', draftOrigin: 'MANUAL' })
    assert.equal(draftResponse.status, 201)
    const draft = await draftResponse.json()
    assert.equal(draft.email, null)
    assert.equal(calls, 0)
    assert.equal((await request(a, 'POST', `/api/leads/${keka.id}/pocs/email`, { poc, provider: 'hunter' })).status, 404)
    assert.equal((await request(b, 'POST', `/api/sheets/outreach/${draft.id}/poc-email`, { provider: 'hunter' })).status, 404)
    const submitted = await request(a, 'PATCH', `/api/sheets/outreach/${draft.id}`, { status: 'PENDING_APPROVAL', expectedUpdatedAt: draft.updatedAt })
    assert.equal(submitted.status, 200)
    const pending = await submitted.json()
    assert.equal(pending.email, null)
    const approved = await (await request(a, 'PATCH', `/api/sheets/outreach/${draft.id}`, { status: 'APPROVED', expectedUpdatedAt: pending.updatedAt })).json()
    assert.equal(approved.email, null)
    const noRecipientSend = await request(a, 'POST', `/api/gmail/outreach/${draft.id}/send`, { expectedUpdatedAt: approved.updatedAt, confirmed: true })
    assert.equal(noRecipientSend.status, 409)
    assert.match((await noRecipientSend.json()).error, /recipient email/i)
    assert.equal(calls, 0)
    const missing = await request(a, 'POST', `/api/sheets/outreach/${draft.id}/poc-email`, { provider: 'hunter' })
    assert.equal(missing.status, 422)
    assert.equal((await missing.json()).code, 'COMPANY_DOMAIN_UNKNOWN')
    assert.equal(calls, 0)
    const laterDraft = await request(a, 'POST', '/api/sheets/outreach', { leadId: keka.id, company: keka.company, poc, channel: 'email', status: 'DRAFT', subject: 'Another subject', body: 'Another relevant message', draftOrigin: 'MANUAL' })
    assert.equal(laterDraft.status, 201)
    assert.equal((await laterDraft.json()).email, null)
    assert.equal(calls, 0)
    const invalid = await request(a, 'PATCH', `/api/sheets/outreach/${draft.id}/company-website`, { website: 'https://localhost:5000/path', expectedWebsite: '', confirmed: true })
    assert.equal(invalid.status, 400)
    const confirmed = await request(a, 'PATCH', `/api/sheets/outreach/${draft.id}/company-website`, { website: 'https://www.keka.com/team', expectedWebsite: '', confirmed: true })
    assert.equal(confirmed.status, 200)
    assert.equal((await confirmed.json()).lead.website, 'https://keka.com')
    const storedLead = (await (await request(a, 'GET', '/api/sheets/leads')).json()).leads.find(lead => lead.id === keka.id)
    assert.equal(storedLead.websiteSource, 'user_provided')
    const first = await (await request(a, 'POST', `/api/sheets/outreach/${draft.id}/poc-email`, { provider: 'hunter' })).json()
    assert.equal(first.email, 'person@keka.com')
    assert.equal(first.cached, false)
    assert.equal((await (await request(a, 'POST', `/api/sheets/outreach/${draft.id}/poc-email`, { provider: 'hunter' })).json()).cached, true)
    assert.equal(calls, 1)
    const corrected = await request(a, 'PATCH', `/api/sheets/outreach/${draft.id}/company-website`, { website: 'https://kekahr.com', expectedWebsite: 'https://keka.com', confirmed: true })
    assert.equal(corrected.status, 200)
    const changedDomain = await (await request(a, 'POST', `/api/sheets/outreach/${draft.id}/poc-email`, { provider: 'hunter' })).json()
    assert.equal(changedDomain.email, 'person@kekahr.com')
    assert.equal(changedDomain.cached, false)
    assert.equal(calls, 2)
    const oldDomainCache = await runInWorkspace(a, () => GoogleSheetsService.getPocEmailEnrichment(keka.id, poc.name, poc.sourceUrl, 'hunter', 'found_only', 'keka.com'))
    const currentDomainCache = await runInWorkspace(a, () => GoogleSheetsService.getPocEmailEnrichment(keka.id, poc.name, poc.sourceUrl, 'hunter', 'found_only', 'kekahr.com'))
    assert.equal(oldDomainCache.email, 'person@keka.com')
    assert.equal(currentDomainCache.email, 'person@kekahr.com')
    const secondProfile = 'https://www.linkedin.com/in/another-sourced-person/'
    TavilyService.searchPOCs = async () => [{ title: 'Another Person at Keka HR', url: secondProfile, content: 'Another Person works at Keka HR.' }]
    SalesGeminiService.identifyPOCs = async () => [{ name: 'Another Person', role: 'Sales', department: 'Sales', profileUrl: secondProfile, sourceUrl: secondProfile, confidence: 0.9, evidenceType: 'sourced' }]
    const anotherPoc = (await (await request(a, 'GET', `/api/leads/${keka.id}/pocs`)).json()).pocs[0]
    const anotherDraft = await (await request(a, 'POST', '/api/sheets/outreach', { leadId: keka.id, company: keka.company, poc: anotherPoc, channel: 'email', status: 'DRAFT', subject: 'Different contact', body: 'A message for the other person', draftOrigin: 'MANUAL' })).json()
    assert.equal((await (await request(a, 'POST', `/api/sheets/outreach/${anotherDraft.id}/poc-email`, { provider: 'hunter' })).json()).cached, false)
    assert.equal(calls, 3)
    assert.equal((await (await request(a, 'GET', '/api/sheets/outreach')).json()).outreach.find(item => item.id === draft.id).email, null)
    const crossWorkspace = await request(b, 'PATCH', `/api/sheets/outreach/${draft.id}/company-website`, { website: 'other.com', expectedWebsite: '', confirmed: true })
    assert.equal(crossWorkspace.status, 404)
  } finally {
    TavilyService.searchPOCs = original.searchPOCs
    SalesGeminiService.identifyPOCs = original.identifyPOCs
    HunterService.findWorkEmail = original.hunter
    await new Promise(resolve => server.close(resolve))
    fs.rmSync(directory, { recursive: true, force: true })
    for (const key of Object.keys(process.env)) if (!(key in previous)) delete process.env[key]
    Object.assign(process.env, previous)
  }
})
