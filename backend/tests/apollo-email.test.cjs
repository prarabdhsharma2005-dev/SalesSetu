const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { createHmac } = require('node:crypto')

test('Apollo uses one work-email-only request and rejects weak or mismatched identities', async () => {
  const { ApolloService, ApolloLookupError } = require('../dist/services/apollo.service')
  const previous = process.env.APOLLO_API_KEY
  process.env.APOLLO_API_KEY = 'isolated-placeholder'
  const input = { name: 'Priya Shah', company: 'Sample Systems', website: 'sample.example', profileUrl: 'https://www.linkedin.com/in/priya-shah/' }
  const person = { name: 'Priya Shah', linkedin_url: input.profileUrl, email: 'priya@sample.example', email_status: 'verified', organization: { primary_domain: 'sample.example' } }
  const response = value => new Response(JSON.stringify(value), { status: 200, headers: { 'content-type': 'application/json' } })
  try {
    const mode = process.env.NODE_ENV
    const customerUse = process.env.APOLLO_CUSTOMER_USE_ENABLED
    try {
      process.env.NODE_ENV = 'production'
      delete process.env.APOLLO_CUSTOMER_USE_ENABLED
      await assert.rejects(ApolloService.findWorkEmail(input, async () => { throw new Error('provider must not be called') }), error => error.code === 'CUSTOMER_USE_DISABLED')
    } finally {
      if (mode === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = mode
      if (customerUse === undefined) delete process.env.APOLLO_CUSTOMER_USE_ENABLED; else process.env.APOLLO_CUSTOMER_USE_ENABLED = customerUse
    }
    let calls = 0
    const found = await ApolloService.findWorkEmail(input, async (url, options) => {
      calls++
      assert.equal(url.pathname, '/api/v1/people/match')
      assert.equal(url.searchParams.get('name'), input.name)
      assert.equal(url.searchParams.get('domain'), 'sample.example')
      assert.equal(url.searchParams.get('reveal_personal_emails'), 'false')
      assert.equal(url.searchParams.get('reveal_phone_number'), 'false')
      assert.equal(url.searchParams.get('run_waterfall_email'), 'false')
      assert.equal(options.headers['x-api-key'], 'isolated-placeholder')
      return response({ match_confidence: 'high', person })
    })
    assert.equal(calls, 1)
    assert.deepEqual(found, { kind: 'found', email: 'priya@sample.example', providerStatus: 'verified', matchEvidence: ['exact_name', 'employer_domain', 'sourced_profile', 'high_provider_match'] })
    for (const payload of [
      { match_confidence: 'medium', person },
      { match_confidence: 'high', person: { ...person, name: 'Another Person' } },
      { match_confidence: 'high', person: { ...person, organization: { primary_domain: 'other.example' } } },
      { match_confidence: 'high', person: { ...person, linkedin_url: 'https://www.linkedin.com/in/another/' } },
      { match_confidence: 'high', person: { ...person, email: 'priya@gmail.com' } },
    ]) assert.equal((await ApolloService.findWorkEmail(input, async () => response(payload))).kind, 'ambiguous')
    assert.equal((await ApolloService.findWorkEmail(input, async () => response({ match_confidence: 'none', person: null }))).kind, 'no_match')
    assert.equal((await ApolloService.findWorkEmail(input, async () => response({ match_confidence: 'high', person: { ...person, email: null } }))).kind, 'no_match')
    await assert.rejects(ApolloService.findWorkEmail(input, async () => new Response('', { status: 429, headers: { 'retry-after': '25' } })), error => error instanceof ApolloLookupError && error.code === 'RATE_LIMITED' && error.retryAfterSeconds === 25)
    await assert.rejects(ApolloService.findWorkEmail(input, async () => new Response('', { status: 403 })), error => error.code === 'ACCESS_UNAVAILABLE')
    delete process.env.APOLLO_API_KEY
    await assert.rejects(ApolloService.findWorkEmail(input, async () => { throw new Error('must not call') }), error => error.code === 'NOT_CONFIGURED')
  } finally { if (previous === undefined) delete process.env.APOLLO_API_KEY; else process.env.APOLLO_API_KEY = previous }
})

test('draft-bound POC enrichment persists per workspace and still requires revision-bound recipient approval', async () => {
  const previous = { ...process.env }
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'salessetu-apollo-'))
  Object.assign(process.env, {
    DATA_DIR: directory, DATABASE_URL: '', NODE_ENV: 'test', GOOGLE_WORKSPACES_ENABLED: 'true',
    INTERNAL_PROXY_SECRET: 'isolated-internal-secret-at-least-thirty-two-characters',
    APP_ACCESS_USER: 'isolated-service', APP_ACCESS_PASSWORD: 'isolated-service-password-more-than-24-chars',
    GOOGLE_SHEETS_WEBHOOK_URL: '', FOLLOW_UP_SCHEDULER_ENABLED: 'false', APOLLO_API_KEY: 'isolated-placeholder',
  })
  const app = require('../dist/app').default
  const { TavilyService } = require('../dist/services/tavily.service')
  const { SalesGeminiService } = require('../dist/services/gemini.service')
  const { ApolloService, ApolloLookupError } = require('../dist/services/apollo.service')
  const original = { searchPOCs: TavilyService.searchPOCs, identifyPOCs: SalesGeminiService.identifyPOCs, findWorkEmail: ApolloService.findWorkEmail }
  const profileUrl = 'https://www.linkedin.com/in/priya-shah/'
  TavilyService.searchPOCs = async () => [{ title: 'Priya Shah at Sample Systems', url: profileUrl, content: 'Priya Shah is VP Sales at Sample Systems.' }]
  SalesGeminiService.identifyPOCs = async () => [{ name: 'Priya Shah', role: 'VP Sales', department: 'Sales', seniority: null, profileUrl, emailStatus: 'unknown', location: null, relevanceReason: null, sourceUrl: profileUrl, confidence: 0.9, evidenceType: 'sourced' }]
  let providerCalls = 0
  let providerMode = 'no_match'
  ApolloService.findWorkEmail = async () => {
    providerCalls++
    if (providerMode === 'quota') throw new ApolloLookupError('RATE_LIMITED', 30)
    if (providerMode !== 'found') return { kind: providerMode }
    return { kind: 'found', email: 'priya@sample.example', providerStatus: 'verified', matchEvidence: ['exact_name', 'employer_domain'] }
  }
  const server = app.listen(0)
  await new Promise(resolve => server.once('listening', resolve))
  const base = `http://127.0.0.1:${server.address().port}`
  const a = '123456789012345678901', b = '999999999999999999999'
  const request = (workspace, method, target, body) => {
    const timestamp = String(Date.now())
    const signature = createHmac('sha256', process.env.INTERNAL_PROXY_SECRET).update(`v1\n${timestamp}\n${workspace}\n${method}\n${target}`).digest('hex')
    return fetch(base + target, { method, headers: {
      authorization: `Basic ${Buffer.from(`${process.env.APP_ACCESS_USER}:${process.env.APP_ACCESS_PASSWORD}`).toString('base64')}`,
      'x-salesetu-workspace': workspace, 'x-salesetu-timestamp': timestamp, 'x-salesetu-signature': signature, 'content-type': 'application/json',
    }, body: body ? JSON.stringify(body) : undefined })
  }
  try {
    const lead = await (await request(a, 'POST', '/api/sheets/leads', { company: 'Sample Systems', website: 'sample.example', industry: '', city: '', country: '', employees: '', intentSignal: '', leadScore: 0, status: 'PROSPECT' })).json()
    const pocs = await (await request(a, 'GET', `/api/leads/${lead.id}/pocs`)).json()
    const poc = pocs.pocs[0]
    const draftResponse = await request(a, 'POST', '/api/sheets/outreach', { leadId: lead.id, company: lead.company, poc, channel: 'email', status: 'DRAFT', subject: 'Hello', body: 'A short relevant message.', draftOrigin: 'MANUAL' })
    assert.equal(draftResponse.status, 201)
    const draft = await draftResponse.json()
    assert.equal(draft.email, null)
    assert.equal((await request(b, 'POST', `/api/sheets/outreach/${draft.id}/poc-email`, { provider: 'apollo' })).status, 404)
    assert.equal((await request(a, 'POST', `/api/sheets/outreach/${draft.id}/poc-email`, { provider: 'apollo' })).status, 422)
    providerMode = 'ambiguous'
    assert.equal((await request(a, 'POST', `/api/sheets/outreach/${draft.id}/poc-email`, { provider: 'apollo' })).status, 422)
    providerMode = 'quota'
    const limited = await request(a, 'POST', `/api/sheets/outreach/${draft.id}/poc-email`, { provider: 'apollo' })
    assert.equal(limited.status, 429)
    assert.equal((await limited.json()).retryAfterSeconds, 30)
    providerMode = 'found'
    const first = await request(a, 'POST', `/api/sheets/outreach/${draft.id}/poc-email`, { provider: 'apollo' })
    assert.equal(first.status, 200)
    assert.equal((await first.json()).cached, false)
    assert.equal(providerCalls, 4)
    const cached = await (await request(a, 'POST', `/api/sheets/outreach/${draft.id}/poc-email`, { provider: 'apollo' })).json()
    assert.equal(cached.cached, true)
    assert.equal(providerCalls, 4)
    const otherLead = await (await request(b, 'POST', '/api/sheets/leads', { company: lead.company, website: 'sample.example', industry: '', city: '', country: '', employees: '', intentSignal: '', leadScore: 0, status: 'PROSPECT' })).json()
    const otherPoc = (await (await request(b, 'GET', `/api/leads/${otherLead.id}/pocs`)).json()).pocs[0]
    assert.equal(otherPoc.email ?? null, null)
    const otherDraft = await (await request(b, 'POST', '/api/sheets/outreach', { leadId: otherLead.id, company: otherLead.company, poc: otherPoc, channel: 'email', status: 'DRAFT', subject: 'Hello', body: 'A short relevant message.', draftOrigin: 'MANUAL' })).json()
    const otherLookup = await (await request(b, 'POST', `/api/sheets/outreach/${otherDraft.id}/poc-email`, { provider: 'apollo' })).json()
    assert.equal(otherLookup.cached, false)
    assert.equal(providerCalls, 5)
    const refreshedPoc = (await (await request(a, 'GET', `/api/leads/${lead.id}/pocs`)).json()).pocs[0]
    assert.equal(refreshedPoc.email ?? null, null)
    assert.equal((await request(a, 'POST', `/api/leads/${lead.id}/pocs/email`, { poc })).status, 404)
    assert.equal(draft.recipientConfirmedAt, undefined)
    assert.equal((await request(b, 'GET', '/api/sheets/outreach')).status, 200)
    assert.equal((await (await request(b, 'GET', '/api/sheets/outreach')).json()).outreach.some(item => item.id === draft.id), false)
    const submitted = await (await request(a, 'PATCH', `/api/sheets/outreach/${draft.id}`, { status: 'PENDING_APPROVAL', expectedUpdatedAt: draft.updatedAt })).json()
    const approved = await (await request(a, 'PATCH', `/api/sheets/outreach/${draft.id}`, { status: 'APPROVED', expectedUpdatedAt: submitted.updatedAt })).json()
    assert.equal(approved.approvedRevision, approved.contentRevision)
    const changed = await (await request(a, 'PATCH', `/api/sheets/outreach/${draft.id}`, { email: 'different@sample.example', recipientConfirmed: true, expectedUpdatedAt: approved.updatedAt })).json()
    assert.equal(changed.status, 'DRAFT')
    assert.equal(changed.contentRevision, approved.contentRevision + 1)
    assert.equal(changed.approvedRevision, null)
    assert.equal(changed.recipientSource, 'MANUALLY_CONFIRMED')
    assert.ok(changed.recipientConfirmedAt)
    assert.equal((await (await request(a, 'GET', '/api/sheets/outreach')).json()).outreach[0].email, 'different@sample.example')
  } finally {
    TavilyService.searchPOCs = original.searchPOCs
    SalesGeminiService.identifyPOCs = original.identifyPOCs
    ApolloService.findWorkEmail = original.findWorkEmail
    await new Promise(resolve => server.close(resolve))
    fs.rmSync(directory, { recursive: true, force: true })
    for (const key of Object.keys(process.env)) if (!(key in previous)) delete process.env[key]
    Object.assign(process.env, previous)
  }
})
