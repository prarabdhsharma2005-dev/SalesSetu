const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { createHmac } = require('node:crypto')

test('company grounding rejects unsupported facts and duplicate identities', () => {
  const { groundDiscoveredCompanies, matchesEvidenceFilters } = require('../dist/services/company-discovery.service')
  const source = { title: 'Beta Systems', url: 'https://beta.example/about', content: 'Beta Systems is a SaaS company in Pune with 25 employees.' }
  const companies = groundDiscoveredCompanies([
    { name: 'Imaginary Company', domain: 'imaginary.example', sourceUrls: [source.url] },
    { name: 'Beta Systems', domain: 'invented.example', industry: 'SaaS', city: 'Mumbai', employees: 25, sourceUrls: [source.url] },
    { name: 'Beta Systems', domain: 'beta.example', sourceUrls: [source.url] },
  ], [source])
  assert.equal(companies.length, 1)
  assert.equal(companies[0].name, 'Beta Systems')
  assert.equal(companies[0].domain, null)
  assert.equal(companies[0].industry, 'SaaS')
  assert.equal(companies[0].city, null)
  assert.equal(companies[0].employees, 25)
  assert.deepEqual(companies[0].sources.map(item => item.url), [source.url])
  assert.equal(companies[0].companyLinkedInUrl, null)
  assert.equal(matchesEvidenceFilters(companies[0], { query: 'SaaS', industry: 'SaaS', city: 'Pune', intent: '' }), true)
  assert.equal(matchesEvidenceFilters(companies[0], { query: 'SaaS', industry: 'SaaS', city: '', intent: '' }), true)
  assert.equal(matchesEvidenceFilters(companies[0], { query: 'SaaS', industry: 'FinTech', city: 'Pune', intent: '' }), false)
  assert.equal(matchesEvidenceFilters(companies[0], { query: 'SaaS', industry: 'SaaS', city: 'Banglore', intent: '' }), true)
})

test('company LinkedIn requires a cited company page naming the company', () => {
  const { groundDiscoveredCompanies, sourceBackedCompanyLinkedInUrl } = require('../dist/services/company-discovery.service')
  const companyPage = { title: 'Beta Systems | LinkedIn', url: 'https://www.linkedin.com/company/beta-systems/', content: 'Beta Systems company profile.' }
  const personalPage = { title: 'Beta Systems founder', url: 'https://www.linkedin.com/in/beta-founder/', content: 'Beta Systems founder.' }
  const wrongCompany = { title: 'Other Systems | LinkedIn', url: 'https://www.linkedin.com/company/other-systems/', content: 'Other Systems company profile.' }
  const sources = [companyPage, personalPage, wrongCompany]
  const [company] = groundDiscoveredCompanies([{ name: 'Beta Systems', companyLinkedInUrl: 'https://www.linkedin.com/company/invented/', sourceUrls: sources.map(item => item.url) }], sources)
  assert.equal(company.companyLinkedInUrl, companyPage.url)
  const [withoutPage] = groundDiscoveredCompanies([{ name: 'Beta Systems', companyLinkedInUrl: 'https://www.linkedin.com/company/invented/', sourceUrls: ['https://beta.example/about'] }], [
    { title: 'Beta Systems', url: 'https://beta.example/about', content: 'Beta Systems company profile.' },
  ])
  assert.equal(withoutPage.companyLinkedInUrl, null)
  assert.equal(sourceBackedCompanyLinkedInUrl('Beta Systems', [personalPage]), null)
  assert.equal(sourceBackedCompanyLinkedInUrl('Beta Systems', [wrongCompany]), null)
  assert.equal(sourceBackedCompanyLinkedInUrl('Beta Systems', [{ ...companyPage, url: 'https://www.linkedin.com/in/beta-systems/' }]), null)
  assert.equal(sourceBackedCompanyLinkedInUrl('Beta Systems', [{ ...companyPage, url: 'http://www.linkedin.com/company/beta-systems/' }]), null)
  assert.equal(sourceBackedCompanyLinkedInUrl('Beta Systems', [{ ...companyPage, url: 'https://linkedin.com.evil.example/company/beta-systems/' }]), null)
})

test('private discovery batches, deduplication, saving, quota and downstream lead association', async () => {
  const previous = { ...process.env }
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'salessetu-discovery-'))
  Object.assign(process.env, {
    DATA_DIR: directory, DATABASE_URL: '', NODE_ENV: 'test', GOOGLE_WORKSPACES_ENABLED: 'true',
    INTERNAL_PROXY_SECRET: 'isolated-internal-secret-at-least-thirty-two-characters',
    APP_ACCESS_USER: 'isolated-service', APP_ACCESS_PASSWORD: 'isolated-service-password-more-than-24-chars',
    WORKSPACE_DISCOVERY_DAILY_LIMIT: '6', GOOGLE_SHEETS_WEBHOOK_URL: '', FOLLOW_UP_SCHEDULER_ENABLED: 'false',
  })
  const app = require('../dist/app').default
  const { TavilyService } = require('../dist/services/tavily.service')
  const { SalesGeminiService } = require('../dist/services/gemini.service')
  const { groundDiscoveredCompanies } = require('../dist/services/company-discovery.service')
  const original = {
    searchCompanies: TavilyService.searchCompanies, searchCompany: TavilyService.searchCompany, searchPOCs: TavilyService.searchPOCs,
    identifyCompanies: SalesGeminiService.identifyCompanies, researchCompany: SalesGeminiService.researchCompany,
    identifyPOCs: SalesGeminiService.identifyPOCs, qualifyLead: SalesGeminiService.qualifyLead,
  }
  const sets = [
    ['Alpha Labs', 'Beta Systems', 'Gamma Tools', 'Delta Cloud', 'Epsilon Apps'],
    ['Epsilon Apps', 'Zeta Systems', 'Eta Cloud'],
  ]
  let providerCalls = 0
  const source = name => {
    const domain = `${name.toLowerCase().replace(/\s+/g, '')}.example`
    return { title: name, url: name === 'Beta Systems' ? 'https://www.linkedin.com/company/beta-systems/' : `https://${domain}/about`, content: `${name} is a SaaS company in Pune, India with 25 employees.` }
  }
  TavilyService.searchCompanies = async () => sets[Math.min(providerCalls++, 1)].map(source)
  SalesGeminiService.identifyCompanies = async (_query, sources) => groundDiscoveredCompanies(sources.map(item => ({
    name: item.title, domain: new URL(item.url).hostname, industry: 'SaaS', city: 'Pune', country: 'India', employees: 25,
    sourceUrls: [item.url],
  })), sources)
  TavilyService.searchCompany = async name => [source(name)]
  SalesGeminiService.researchCompany = async (_company, sources) => ({ summary: 'Source-backed company overview.', sources: sources.map(item => ({ title: item.title, url: item.url })), model: 'stub' })
  TavilyService.searchPOCs = async () => []
  SalesGeminiService.identifyPOCs = async () => []
  SalesGeminiService.qualifyLead = async () => ({ status: 'needs_review', score: 50, reasons: ['Review evidence'], criteria: [], evidence: [], unknowns: ['Intent unknown'] })
  const server = app.listen(0)
  await new Promise(resolve => server.once('listening', resolve))
  const base = `http://127.0.0.1:${server.address().port}`
  const a = '123456789012345678901', b = '999999999999999999999'
  const request = (workspace, method, target, body) => {
    const timestamp = String(Date.now())
    const signature = createHmac('sha256', process.env.INTERNAL_PROXY_SECRET).update(`v1\n${timestamp}\n${workspace}\n${method}\n${target}`).digest('hex')
    return fetch(base + target, { method, headers: {
      authorization: `Basic ${Buffer.from(`${process.env.APP_ACCESS_USER}:${process.env.APP_ACCESS_PASSWORD}`).toString('base64')}`,
      'x-salesetu-workspace': workspace, 'x-salesetu-timestamp': timestamp, 'x-salesetu-signature': signature,
      'content-type': 'application/json',
    }, body: body ? JSON.stringify(body) : undefined })
  }
  try {
    assert.equal((await request(a, 'POST', '/api/sheets/leads', { company: 'Alpha Labs', website: 'alphalabs.example', industry: 'SaaS', city: 'Pune', country: 'India', employees: 25, intentSignal: '', leadScore: 0, status: 'PROSPECT' })).status, 201)
    const first = await request(a, 'POST', '/api/leads/discovery', { query: 'SaaS companies in Pune', industry: 'SaaS', city: 'Pune', intent: '' })
    assert.equal(first.status, 201)
    const session = await first.json()
    assert.equal(session.companies.length, 4)
    assert.equal(session.companies.some(item => item.name === 'Alpha Labs'), false)
    assert.equal((await request(b, 'GET', `/api/leads/discovery/${session.id}`)).status, 404)
    assert.equal((await request(b, 'POST', `/api/leads/discovery/${session.id}/save`, { candidateIds: [session.companies[0].id] })).status, 404)
    assert.equal((await request(a, 'POST', `/api/leads/discovery/${session.id}/save`, { candidateIds: ['not-in-session'] })).status, 400)
    const nextResponse = await request(a, 'POST', `/api/leads/discovery/${session.id}/next`, { batch: 1 })
    assert.equal(nextResponse.status, 200)
    const next = await nextResponse.json()
    assert.equal(next.companies.length, 6)
    assert.equal(new Set(next.companies.map(item => item.domain)).size, 6)
    assert.equal((await request(a, 'POST', `/api/leads/discovery/${session.id}/next`, { batch: 1 })).status, 200)
    assert.equal(providerCalls, 2)
    const ids = next.companies.map(item => item.id)
    const savedResponse = await request(a, 'POST', `/api/leads/discovery/${session.id}/save`, { candidateIds: ids })
    assert.equal(savedResponse.status, 200)
    const saved = await savedResponse.json()
    assert.equal(saved.saved.length, 6)
    assert.equal(saved.saved[0].leadScore, 0)
    assert.equal(saved.saved[0].intentSignal, '')
    assert.ok(saved.saved[0].discoverySources[0].url.startsWith('https://'))
    const beta = saved.saved.find(item => item.company === 'Beta Systems')
    assert.equal(beta.companyLinkedInUrl, 'https://www.linkedin.com/company/beta-systems/')
    const repeat = await (await request(a, 'POST', `/api/leads/discovery/${session.id}/save`, { candidateIds: ids })).json()
    assert.equal(repeat.saved.length, 0)
    assert.equal(repeat.alreadySaved.length, 6)
    const stored = await (await request(a, 'GET', '/api/sheets/leads')).json()
    assert.equal(stored.total, 7)
    assert.equal(stored.leads.find(item => item.id === beta.id).companyLinkedInUrl, beta.companyLinkedInUrl)
    const betaDetail = await (await request(a, 'GET', `/api/leads/${beta.id}`)).json()
    assert.equal(betaDetail.companyLinkedInUrl, beta.companyLinkedInUrl)
    assert.equal((await (await request(b, 'GET', '/api/sheets/leads')).json()).total, 0)
    const id = saved.saved[0].id
    assert.equal((await request(a, 'GET', `/api/leads/${id}`)).status, 200)
    assert.equal((await request(a, 'GET', `/api/leads/${id}/research`)).status, 200)
    assert.equal((await request(a, 'GET', `/api/leads/${id}/pocs`)).status, 200)
    assert.equal((await request(a, 'PUT', '/api/sheets/icp-rulebook', { rulebook: { industries: ['SaaS'], cities: ['Pune'] } })).status, 200)
    assert.equal((await request(a, 'POST', `/api/leads/${id}/qualify`, {})).status, 200)
    const draftingGate = await request(a, 'POST', '/api/ai/draft-email', { prospect: { leadId: id, company: saved.saved[0].company } })
    assert.equal(draftingGate.status, 409) // saved lead is recognized; workspace seller context is required before AI drafting.
    assert.equal((await draftingGate.json()).code, 'SELLER_CONTEXT_REQUIRED')
    process.env.WORKSPACE_DISCOVERY_DAILY_LIMIT = '5' // two batches, one repeat, research, and POC discovery claimed five calls.
    const quota = await request(a, 'POST', `/api/leads/discovery/${session.id}/next`, { batch: 2 })
    assert.equal(quota.status, 429)
    assert.equal((await quota.json()).code, 'WORKSPACE_QUOTA_EXCEEDED')
    assert.equal(providerCalls, 2)
    assert.equal((await request(b, 'GET', `/api/leads/${id}`)).status, 404)
    TavilyService.searchCompanies = async () => { throw new Error('Tavily search failed (HTTP 429)') }
    const limitedProvider = await request(b, 'POST', '/api/leads/discovery', { query: 'SaaS companies', industry: '', city: '', intent: '' })
    assert.equal(limitedProvider.status, 429)
    assert.equal((await limitedProvider.json()).code, 'PROVIDER_QUOTA')
    TavilyService.searchCompanies = async () => { throw new Error('TAVILY_API_KEY is not configured') }
    const unconfigured = await request(b, 'POST', '/api/leads/discovery', { query: 'SaaS companies', industry: '', city: '', intent: '' })
    assert.equal(unconfigured.status, 503)
    assert.equal((await unconfigured.json()).code, 'PROVIDER_NOT_CONFIGURED')
    assert.equal(fs.existsSync(path.join(directory, 'sheets_store.json')), false)
  } finally {
    Object.assign(TavilyService, { searchCompanies: original.searchCompanies, searchCompany: original.searchCompany, searchPOCs: original.searchPOCs })
    Object.assign(SalesGeminiService, { identifyCompanies: original.identifyCompanies, researchCompany: original.researchCompany, identifyPOCs: original.identifyPOCs, qualifyLead: original.qualifyLead })
    await new Promise(resolve => server.close(resolve))
    fs.rmSync(directory, { recursive: true, force: true })
    for (const key of Object.keys(process.env)) if (!(key in previous)) delete process.env[key]
    Object.assign(process.env, previous)
  }
})
