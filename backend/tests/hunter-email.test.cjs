const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { createHmac } = require('node:crypto')

test('production Hunter lookup is limited to the configured owner workspace before provider use', async () => {
  const { lookupPocWorkEmail } = require('../dist/services/poc-email-lookup.service')
  const { runInWorkspace } = require('../dist/services/workspace-context.service')
  const previous = { NODE_ENV: process.env.NODE_ENV, HUNTER_ALLOWED_WORKSPACE_ID: process.env.HUNTER_ALLOWED_WORKSPACE_ID }
  process.env.NODE_ENV = 'production'
  process.env.HUNTER_ALLOWED_WORKSPACE_ID = '123456789012345678901'
  try {
    const lead = { id: 'lead-1', company: 'Sample Systems', website: 'sample.example' }
    const poc = { name: 'Priya Shah', sourceUrl: 'https://sample.example/team/priya', profileUrl: null }
    await assert.rejects(runInWorkspace('999999999999999999999', () => lookupPocWorkEmail(lead, poc, 'hunter')), error => error.status === 403 && error.code === 'HUNTER_OWNER_ONLY')
    delete process.env.HUNTER_ALLOWED_WORKSPACE_ID
    await assert.rejects(runInWorkspace('123456789012345678901', () => lookupPocWorkEmail(lead, poc, 'hunter')), error => error.status === 403 && error.code === 'HUNTER_OWNER_ONLY')
  } finally {
    for (const [key, value] of Object.entries(previous)) if (value === undefined) delete process.env[key]; else process.env[key] = value
  }
})

test('Hunter Found uses one key-in-header lookup and requires exact sourced identity', async () => {
  const { HunterService, HunterLookupError } = require('../dist/services/hunter.service')
  const previous = process.env.HUNTER_API_KEY
  process.env.HUNTER_API_KEY = 'isolated-placeholder'
  const input = { name: 'Priya Shah', website: 'sample.example' }
  const person = { first_name: 'Priya', last_name: 'Shah', email: 'priya@sample.example', domain: 'sample.example', source_type: 'found', score: 91, verification: { status: 'valid' }, sources: [{ uri: 'https://sample.example/team/priya' }] }
  const response = data => new Response(JSON.stringify({ data }), { status: 200 })
  try {
    let calls = 0
    const found = await HunterService.findWorkEmail(input, async (url, options) => {
      calls++
      assert.equal(url.pathname, '/v2/email-finder/found')
      assert.equal(url.searchParams.get('domain'), 'sample.example')
      assert.equal(url.searchParams.get('full_name'), input.name)
      assert.equal(url.searchParams.has('api_key'), false)
      assert.equal(options.headers['X-API-KEY'], 'isolated-placeholder')
      return response(person)
    })
    assert.equal(calls, 1)
    assert.deepEqual(found, { kind: 'found', email: 'priya@sample.example', sourceType: 'found', providerStatus: 'valid', confidence: 91, sourceUrls: ['https://sample.example/team/priya'], matchEvidence: ['exact_name', 'employer_domain', 'web_found_email'] })
    const inferred = await HunterService.findWorkEmail(input, async url => {
      assert.equal(url.pathname, '/v2/email-finder')
      return response({ ...person, source_type: 'generated', sources: [] })
    }, 'include_inferred')
    assert.equal(inferred.kind, 'found'); assert.equal(inferred.sourceType, 'inferred'); assert.equal(inferred.providerStatus, 'valid'); assert.deepEqual(inferred.sourceUrls, [])
    const unknown = await HunterService.findWorkEmail(input, async () => response({ ...person, source_type: undefined, sources: [] }), 'include_inferred')
    assert.equal(unknown.sourceType, 'unknown')
    const unknownFound = await HunterService.findWorkEmail(input, async () => response({ ...person, source_type: undefined }))
    assert.equal(unknownFound.sourceType, 'unknown')
    for (const mismatched of [
      { ...person, first_name: 'Other' }, { ...person, domain: 'other.example' },
      { ...person, email: 'priya@other.example' }, { ...person, source_type: 'generated' },
      { ...person, sources: [] },
    ]) assert.equal((await HunterService.findWorkEmail(input, async () => response(mismatched))).kind, 'ambiguous')
    assert.equal((await HunterService.findWorkEmail(input, async () => response({ ...person, email: null }))).kind, 'no_match')
    assert.equal((await HunterService.findWorkEmail(input, async () => response(null))).kind, 'no_match')
    for (const malformed of [{}, { data: {} }, { data: { email: 42 } }, { errors: [{ id: 'unexpected' }] }]) {
      await assert.rejects(HunterService.findWorkEmail(input, async () => new Response(JSON.stringify(malformed), { status: 200 })), error => error instanceof HunterLookupError && error.code === 'UNAVAILABLE')
    }
    await assert.rejects(HunterService.findWorkEmail(input, async () => new Response(JSON.stringify({ data: null }), { status: 202 })), error => error.code === 'UNAVAILABLE')
    await assert.rejects(HunterService.findWorkEmail(input, async () => new Response('', { status: 429, headers: { 'retry-after': '40' } })), error => error instanceof HunterLookupError && error.code === 'QUOTA_EXHAUSTED' && error.retryAfterSeconds === 40)
    await assert.rejects(HunterService.findWorkEmail(input, async () => new Response('', { status: 403 })), error => error.code === 'RATE_LIMITED')
    await assert.rejects(HunterService.findWorkEmail(input, async () => new Response(JSON.stringify({ errors: [{ id: 'invalid_domain' }] }), { status: 400 })), error => error.code === 'INVALID_DOMAIN')
    await assert.rejects(HunterService.findWorkEmail(input, async () => { const error = new Error('timed out'); error.name = 'TimeoutError'; throw error }), error => error.code === 'TIMEOUT')
    await assert.rejects(HunterService.findWorkEmail(input, async () => new Response('', { status: 451 })), error => error.code === 'PRIVACY_RESTRICTED')
    delete process.env.HUNTER_API_KEY
    await assert.rejects(HunterService.findWorkEmail(input, async () => { throw new Error('provider must not be called') }), error => error.code === 'NOT_CONFIGURED')
  } finally { if (previous === undefined) delete process.env.HUNTER_API_KEY; else process.env.HUNTER_API_KEY = previous }
})

test('Hunter and Apollo cache separately for a selected POC in one workspace', async () => {
  const previous = { ...process.env }
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'salessetu-hunter-'))
  Object.assign(process.env, { DATA_DIR: directory, DATABASE_URL: '', NODE_ENV: 'test', GOOGLE_WORKSPACES_ENABLED: 'true', INTERNAL_PROXY_SECRET: 'isolated-internal-secret-at-least-thirty-two-characters', APP_ACCESS_USER: 'isolated-service', APP_ACCESS_PASSWORD: 'isolated-service-password-more-than-24-chars', GOOGLE_SHEETS_WEBHOOK_URL: '', FOLLOW_UP_SCHEDULER_ENABLED: 'false', HUNTER_API_KEY: 'isolated-placeholder' })
  const app = require('../dist/app').default
  const { TavilyService } = require('../dist/services/tavily.service')
  const { SalesGeminiService } = require('../dist/services/gemini.service')
  const { HunterService } = require('../dist/services/hunter.service')
  const { ApolloService } = require('../dist/services/apollo.service')
  const original = { searchPOCs: TavilyService.searchPOCs, identifyPOCs: SalesGeminiService.identifyPOCs, hunter: HunterService.findWorkEmail, apollo: ApolloService.findWorkEmail }
  const profileUrl = 'https://www.linkedin.com/in/priya-shah/'
  TavilyService.searchPOCs = async () => [{ title: 'Priya Shah at Sample Systems', url: profileUrl, content: 'Priya Shah is VP Sales at Sample Systems.' }]
  SalesGeminiService.identifyPOCs = async () => [{ name: 'Priya Shah', role: 'VP Sales', department: 'Sales', seniority: null, profileUrl, emailStatus: 'unknown', location: null, relevanceReason: null, sourceUrl: profileUrl, confidence: 0.9, evidenceType: 'sourced' }]
  let hunterCalls = 0, apolloCalls = 0
  HunterService.findWorkEmail = async (_input, _fetcher, mode) => { hunterCalls++; return mode === 'include_inferred'
    ? { kind: 'found', email: 'inferred@sample.example', sourceType: 'inferred', providerStatus: 'valid', confidence: 75, sourceUrls: [], matchEvidence: ['exact_name', 'employer_domain', 'provider_inference'] }
    : { kind: 'found', email: 'priya@sample.example', sourceType: 'found', providerStatus: 'valid', confidence: 91, sourceUrls: ['https://sample.example/team/priya'], matchEvidence: ['exact_name', 'employer_domain', 'web_found_email'] } }
  ApolloService.findWorkEmail = async () => { apolloCalls++; return { kind: 'found', email: 'priya@sample.example', providerStatus: 'verified', matchEvidence: ['exact_name', 'employer_domain'] } }
  const server = app.listen(0)
  await new Promise(resolve => server.once('listening', resolve))
  const base = `http://127.0.0.1:${server.address().port}`
  const a = '123456789012345678901', b = '999999999999999999999'
  const request = (workspace, method, target, body) => {
    const timestamp = String(Date.now())
    const signature = createHmac('sha256', process.env.INTERNAL_PROXY_SECRET).update(`v1\n${timestamp}\n${workspace}\n${method}\n${target}`).digest('hex')
    return fetch(base + target, { method, headers: { authorization: `Basic ${Buffer.from(`${process.env.APP_ACCESS_USER}:${process.env.APP_ACCESS_PASSWORD}`).toString('base64')}`, 'x-salesetu-workspace': workspace, 'x-salesetu-timestamp': timestamp, 'x-salesetu-signature': signature, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
  }
  try {
    const lead = await (await request(a, 'POST', '/api/sheets/leads', { company: 'Sample Systems', website: 'sample.example', industry: '', city: '', country: '', employees: '', intentSignal: '', leadScore: 0, status: 'PROSPECT' })).json()
    const poc = (await (await request(a, 'GET', `/api/leads/${lead.id}/pocs`)).json()).pocs[0]
    const draft = await (await request(a, 'POST', '/api/sheets/outreach', { leadId: lead.id, company: lead.company, poc, channel: 'email', status: 'DRAFT', subject: 'Hello', body: 'A relevant message.', draftOrigin: 'MANUAL' })).json()
    assert.equal(draft.email, null)
    assert.equal((await request(b, 'POST', `/api/sheets/outreach/${draft.id}/poc-email`, { provider: 'hunter' })).status, 404)
    const first = await (await request(a, 'POST', `/api/sheets/outreach/${draft.id}/poc-email`, { provider: 'hunter' })).json()
    assert.equal(first.provider, 'hunter'); assert.equal(first.cached, false); assert.equal(first.confidence, 91); assert.equal(first.sourceUrls.length, 1)
    assert.equal((await (await request(a, 'POST', `/api/sheets/outreach/${draft.id}/poc-email`, { provider: 'hunter' })).json()).cached, true)
    assert.equal(hunterCalls, 1)
    const inferred = await (await request(a, 'POST', `/api/sheets/outreach/${draft.id}/poc-email`, { provider: 'hunter', hunterMode: 'include_inferred' })).json()
    assert.equal(inferred.cached, false); assert.equal(inferred.sourceType, 'inferred'); assert.equal(inferred.providerStatus, 'valid'); assert.equal(inferred.email, 'inferred@sample.example')
    assert.equal((await (await request(a, 'POST', `/api/sheets/outreach/${draft.id}/poc-email`, { provider: 'hunter', hunterMode: 'include_inferred' })).json()).cached, true)
    assert.equal((await (await request(a, 'POST', `/api/sheets/outreach/${draft.id}/poc-email`, { provider: 'hunter' })).json()).email, 'priya@sample.example')
    assert.equal(hunterCalls, 2)
    assert.equal((await request(a, 'POST', `/api/sheets/outreach/${draft.id}/poc-email`, { provider: 'hunter', hunterMode: 'invalid' })).status, 400)
    const other = await (await request(a, 'POST', `/api/sheets/outreach/${draft.id}/poc-email`, { provider: 'apollo' })).json()
    assert.equal(other.provider, 'apollo'); assert.equal(other.cached, false); assert.equal(apolloCalls, 1)
    assert.equal((await (await request(a, 'POST', `/api/sheets/outreach/${draft.id}/poc-email`, { provider: 'hunter' })).json()).provider, 'hunter')
    assert.equal(hunterCalls, 2)
    const leadB = await (await request(b, 'POST', '/api/sheets/leads', { company: 'Sample Systems', website: 'sample.example', industry: '', city: '', country: '', employees: '', intentSignal: '', leadScore: 0, status: 'PROSPECT' })).json()
    const pocB = (await (await request(b, 'GET', `/api/leads/${leadB.id}/pocs`)).json()).pocs[0]
    assert.equal(pocB.email ?? null, null)
    const draftB = await (await request(b, 'POST', '/api/sheets/outreach', { leadId: leadB.id, company: leadB.company, poc: pocB, channel: 'email', status: 'DRAFT', subject: 'Hello', body: 'A relevant message.', draftOrigin: 'MANUAL' })).json()
    assert.equal((await (await request(b, 'POST', `/api/sheets/outreach/${draftB.id}/poc-email`, { provider: 'hunter' })).json()).cached, false)
    assert.equal(hunterCalls, 3)
  } finally {
    TavilyService.searchPOCs = original.searchPOCs; SalesGeminiService.identifyPOCs = original.identifyPOCs; HunterService.findWorkEmail = original.hunter; ApolloService.findWorkEmail = original.apollo
    await new Promise(resolve => server.close(resolve))
    fs.rmSync(directory, { recursive: true, force: true })
    for (const key of Object.keys(process.env)) if (!(key in previous)) delete process.env[key]
    Object.assign(process.env, previous)
  }
})

test('researched Razorpay-shaped lead and saved Vaishnavi draft share one Hunter lookup without changing approval', async () => {
  const previous = { ...process.env }
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'salessetu-hunter-draft-'))
  Object.assign(process.env, { DATA_DIR: directory, DATABASE_URL: '', NODE_ENV: 'test', GOOGLE_WORKSPACES_ENABLED: 'true', INTERNAL_PROXY_SECRET: 'isolated-internal-secret-at-least-thirty-two-characters', APP_ACCESS_USER: 'isolated-service', APP_ACCESS_PASSWORD: 'isolated-service-password-more-than-24-chars', GOOGLE_SHEETS_WEBHOOK_URL: '', FOLLOW_UP_SCHEDULER_ENABLED: 'false', HUNTER_API_KEY: 'isolated-placeholder' })
  const app = require('../dist/app').default
  const { TavilyService } = require('../dist/services/tavily.service')
  const { SalesGeminiService } = require('../dist/services/gemini.service')
  const { HunterService, HunterLookupError } = require('../dist/services/hunter.service')
  const { GoogleSheetsService } = require('../dist/services/sheets.service')
  const { runInWorkspace } = require('../dist/services/workspace-context.service')
  const { confirmedCompanyDomain } = require('../dist/services/poc-email-lookup.service')
  const original = { searchPOCs: TavilyService.searchPOCs, identifyPOCs: SalesGeminiService.identifyPOCs, hunter: HunterService.findWorkEmail }
  const profileUrl = 'https://www.linkedin.com/in/vaishnavi-gupta-example/'
  TavilyService.searchPOCs = async () => [{ title: 'Vaishnavi Gupta at Razorpay', url: profileUrl, content: 'Vaishnavi Gupta works at Razorpay.' }]
  SalesGeminiService.identifyPOCs = async () => [{ name: 'Vaishnavi Gupta', role: 'Partnerships Lead', department: 'Partnerships', seniority: null, profileUrl, emailStatus: 'unknown', location: null, relevanceReason: null, sourceUrl: profileUrl, confidence: 0.9, evidenceType: 'sourced' }]
  let calls = 0, mode = 'found'
  HunterService.findWorkEmail = async (input, _fetcher, lookupMode) => {
    calls++
    assert.equal(input.name, 'Vaishnavi Gupta')
    assert.equal(input.website, 'razorpay.com')
    if (mode === 'no_match') return { kind: 'no_match' }
    if (mode === 'quota') throw new HunterLookupError('QUOTA_EXHAUSTED')
    if (mode === 'access') throw new HunterLookupError('ACCESS_UNAVAILABLE')
    if (mode === 'timeout') throw new HunterLookupError('TIMEOUT')
    if (mode === 'inferred') {
      assert.equal(lookupMode, 'include_inferred')
      return { kind: 'found', email: 'inferred@razorpay.com', sourceType: 'inferred', providerStatus: 'valid', confidence: 72, sourceUrls: [], matchEvidence: ['exact_name', 'employer_domain', 'provider_inference'] }
    }
    return { kind: 'found', email: 'vaishnavi@razorpay.com', sourceType: 'found', providerStatus: 'valid', confidence: 87, sourceUrls: ['https://razorpay.com/team/vaishnavi'], matchEvidence: ['exact_name', 'employer_domain', 'web_found_email'] }
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
  try {
    const lead = await (await request(a, 'POST', '/api/sheets/leads', { company: 'Razorpay', website: '', industry: '', city: '', country: '', employees: '', intentSignal: '', leadScore: 0, status: 'PROSPECT' })).json()
    const research = { summary: 'Razorpay company dossier.', sources: [{ title: 'Press Releases - Razorpay Latest Information & News', url: 'https://razorpay.com/newsroom/press' }], facts: {}, updatedAt: new Date().toISOString() }
    await runInWorkspace(a, () => GoogleSheetsService.saveCompanyResearch(lead.id, research))
    assert.equal(confirmedCompanyDomain({ ...lead, companyResearch: research }), 'razorpay.com')
    assert.equal(confirmedCompanyDomain({ ...lead, companyResearch: { ...research, sources: [{ title: 'Razorpay news', url: 'https://not-razorpay.example/story' }] } }), null)
    assert.equal(confirmedCompanyDomain({ ...lead, companyResearch: { ...research, sources: [{ title: 'Razorpay news', url: 'https://razorpay.com.evil/story' }] } }), null)
    const poc = (await (await request(a, 'GET', `/api/leads/${lead.id}/pocs`)).json()).pocs[0]
    const saved = await request(a, 'POST', '/api/sheets/outreach', { leadId: lead.id, company: lead.company, poc, channel: 'email', status: 'DRAFT', subject: 'Hello', body: 'A relevant message.', draftOrigin: 'MANUAL' })
    assert.equal(saved.status, 201)
    const draft = await saved.json()
    assert.equal(draft.email, null)
    assert.equal((await request(b, 'POST', `/api/sheets/outreach/${draft.id}/poc-email`, { provider: 'hunter' })).status, 404)
    for (const [state, status, code] of [['no_match', 422, 'NO_EMAIL_MATCH'], ['quota', 429, 'QUOTA_EXHAUSTED'], ['access', 403, 'ACCESS_UNAVAILABLE'], ['timeout', 503, 'TIMEOUT']]) {
      mode = state
      const failed = await request(a, 'POST', `/api/sheets/outreach/${draft.id}/poc-email`, { provider: 'hunter' })
      assert.equal(failed.status, status)
      assert.equal((await failed.json()).code, code)
      assert.equal((await (await request(a, 'GET', '/api/sheets/outreach')).json()).outreach[0].email, null)
    }
    mode = 'found'
    const lookup = await (await request(a, 'POST', `/api/sheets/outreach/${draft.id}/poc-email`, { provider: 'hunter' })).json()
    assert.equal(lookup.email, 'vaishnavi@razorpay.com')
    assert.equal(lookup.cached, false)
    assert.equal(lookup.confidence, 87)
    assert.equal(lookup.sourceType, 'found')
    assert.equal(calls, 5)
    const unchanged = (await (await request(a, 'GET', '/api/sheets/outreach')).json()).outreach[0]
    assert.equal(unchanged.email, null)
    assert.equal(unchanged.status, 'DRAFT')
    assert.equal((await (await request(a, 'POST', `/api/sheets/outreach/${draft.id}/poc-email`, { provider: 'hunter' })).json()).cached, true)
    assert.equal(calls, 5)
    const recipient = await (await request(a, 'PATCH', `/api/sheets/outreach/${draft.id}`, { email: lookup.email, recipientConfirmed: true, expectedUpdatedAt: unchanged.updatedAt })).json()
    assert.equal(recipient.email, lookup.email)
    assert.ok(recipient.recipientConfirmedAt)
    const submitted = await (await request(a, 'PATCH', `/api/sheets/outreach/${draft.id}`, { status: 'PENDING_APPROVAL', expectedUpdatedAt: recipient.updatedAt })).json()
    const approved = await (await request(a, 'PATCH', `/api/sheets/outreach/${draft.id}`, { status: 'APPROVED', expectedUpdatedAt: submitted.updatedAt })).json()
    assert.equal(approved.approvedRevision, approved.contentRevision)
    assert.equal((await (await request(a, 'POST', `/api/sheets/outreach/${draft.id}/poc-email`, { provider: 'hunter' })).json()).cached, true)
    assert.equal(calls, 5)
    const stillApproved = (await (await request(a, 'GET', '/api/sheets/outreach')).json()).outreach[0]
    assert.equal(stillApproved.status, 'APPROVED')
    mode = 'inferred'
    const inferred = await (await request(a, 'POST', `/api/sheets/outreach/${draft.id}/poc-email`, { provider: 'hunter', hunterMode: 'include_inferred' })).json()
    assert.equal(inferred.cached, false); assert.equal(inferred.sourceType, 'inferred'); assert.equal(inferred.providerStatus, 'valid'); assert.deepEqual(inferred.sourceUrls, [])
    assert.equal((await (await request(a, 'POST', `/api/sheets/outreach/${draft.id}/poc-email`, { provider: 'hunter', hunterMode: 'include_inferred' })).json()).cached, true)
    assert.equal((await (await request(a, 'POST', `/api/sheets/outreach/${draft.id}/poc-email`, { provider: 'hunter' })).json()).email, lookup.email)
    const persisted = await runInWorkspace(a, () => GoogleSheetsService.getPocEmailEnrichment(lead.id, poc.name, poc.sourceUrl, 'hunter', 'include_inferred'))
    assert.equal(persisted.sourceType, 'inferred'); assert.equal(persisted.hunterMode, 'include_inferred'); assert.equal(persisted.confidence, 72); assert.ok(persisted.lookedUpAt)
    assert.equal(calls, 6)
    const inferredDraft = await request(a, 'POST', '/api/sheets/outreach', { leadId: lead.id, company: lead.company, poc: { ...poc, email: inferred.email, emailProvider: 'hunter', emailHunterMode: 'include_inferred' }, channel: 'email', status: 'DRAFT', subject: 'Second message', body: 'Another relevant message.', draftOrigin: 'MANUAL' })
    assert.equal(inferredDraft.status, 201)
    assert.equal((await inferredDraft.json()).email, null)
    const defaultDraft = await request(a, 'POST', '/api/sheets/outreach', { leadId: lead.id, company: lead.company, poc: { ...poc, email: inferred.email, emailProvider: 'hunter' }, channel: 'email', status: 'DRAFT', subject: 'Third message', body: 'A third relevant message.', draftOrigin: 'MANUAL' })
    assert.equal(defaultDraft.status, 201)
    assert.equal((await defaultDraft.json()).email, null)
    const changed = await (await request(a, 'PATCH', `/api/sheets/outreach/${draft.id}`, { email: inferred.email, recipientConfirmed: true, expectedUpdatedAt: approved.updatedAt })).json()
    assert.equal(changed.status, 'DRAFT')
    assert.equal(changed.approvedRevision, null)
    assert.equal(changed.contentRevision, approved.contentRevision + 1)
    const reloaded = (await (await request(a, 'GET', '/api/sheets/outreach')).json()).outreach.find(item => item.id === draft.id)
    assert.equal(reloaded.emailEnrichment.sourceType, 'inferred')
    assert.equal(reloaded.emailEnrichment.providerStatus, 'valid')
    assert.equal(reloaded.emailEnrichment.confidence, 72)
    assert.deepEqual(reloaded.emailEnrichment.sourceUrls, [])
    assert.ok(reloaded.emailEnrichment.lookedUpAt)
  } finally {
    TavilyService.searchPOCs = original.searchPOCs; SalesGeminiService.identifyPOCs = original.identifyPOCs; HunterService.findWorkEmail = original.hunter
    await new Promise(resolve => server.close(resolve))
    fs.rmSync(directory, { recursive: true, force: true })
    for (const key of Object.keys(process.env)) if (!(key in previous)) delete process.env[key]
    Object.assign(process.env, previous)
  }
})
