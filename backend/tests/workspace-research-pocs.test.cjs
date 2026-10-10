const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { createHmac } = require('node:crypto')

test('research facts require direct sourced statements; POC profiles require sourced person URLs', () => {
  const { sourceBackedResearchFacts } = require('../dist/services/company-research.service')
  const { sourcedPersonProfileUrl } = require('../dist/services/gemini.service')
  const url = 'https://sample.example/about'
  assert.deepEqual(sourceBackedResearchFacts('Sample Systems', [{ title: 'Fintech companies in Pune', url, content: 'Sample Systems offers software. The search covers Pune. A different company has 250 employees.' }]), {})
  assert.deepEqual(sourceBackedResearchFacts('Sample Systems', [{ title: 'Sample Systems', url, content: 'Sample Systems is headquartered in Pune. Sample Systems has 120 employees.' }]), {
    city: { value: 'Pune', sourceUrl: url }, employees: { value: 120, sourceUrl: url },
  })
  const profile = 'https://www.linkedin.com/in/priya-shah/'
  assert.equal(sourcedPersonProfileUrl(profile, new Set([profile])), profile)
  for (const suspect of ['https://www.linkedin.com/company/sample/', 'https://linkedin.com.evil.example/in/priya/', 'http://www.linkedin.com/in/priya/']) {
    assert.equal(sourcedPersonProfileUrl(suspect, new Set([profile, suspect])), null)
  }
  assert.equal(sourcedPersonProfileUrl(profile, new Set()), null)
  assert.equal(sourcedPersonProfileUrl('https://www.linkedin.com/in/guessed/', new Set([profile])), null)
})

test('saved research supplies qualification facts and POCs stay in their workspace', async () => {
  const before = { ...process.env }
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'salessetu-research-'))
  Object.assign(process.env, {
    DATA_DIR: directory, DATABASE_URL: '', NODE_ENV: 'test', GOOGLE_WORKSPACES_ENABLED: 'true',
    INTERNAL_PROXY_SECRET: 'isolated-internal-secret-at-least-thirty-two-characters',
    APP_ACCESS_USER: 'isolated-service', APP_ACCESS_PASSWORD: 'isolated-service-password-more-than-24-chars',
    GOOGLE_SHEETS_WEBHOOK_URL: '', FOLLOW_UP_SCHEDULER_ENABLED: 'false',
  })
  const app = require('../dist/app').default
  const { TavilyService } = require('../dist/services/tavily.service')
  const { SalesGeminiService } = require('../dist/services/gemini.service')
  const original = {
    searchCompany: TavilyService.searchCompany, searchPOCs: TavilyService.searchPOCs,
    researchCompany: SalesGeminiService.researchCompany, identifyPOCs: SalesGeminiService.identifyPOCs,
    qualifyLead: SalesGeminiService.qualifyLead,
  }
  const sources = [
    { title: 'Sample Systems company', url: 'https://sample.example/about', content: 'Sample Systems is a SaaS company. Sample Systems is headquartered in Pune. Sample Systems has 120 employees.' },
    { title: 'Other company', url: 'https://other.example/', content: 'Other Systems has 900 employees and is headquartered in Mumbai.' },
  ]
  let researchCalls = 0
  TavilyService.searchCompany = async () => { researchCalls++; return sources }
  SalesGeminiService.researchCompany = async () => ({ summary: 'Sample Systems offers software (https://sample.example/about).', sources: sources.map(({ title, url }) => ({ title, url })), model: 'stub' })
  TavilyService.searchPOCs = async () => [{ title: 'Priya Shah at Sample Systems', url: 'https://www.linkedin.com/in/priya-shah/', content: 'Priya Shah is VP Sales at Sample Systems.' }]
  SalesGeminiService.identifyPOCs = async (_company, evidence) => [{ name: 'Priya Shah', role: 'VP Sales', department: 'Sales', seniority: null, profileUrl: evidence[0].url, emailStatus: 'unknown', location: null, relevanceReason: null, sourceUrl: evidence[0].url, confidence: 0.9, evidenceType: 'sourced' }]
  let qualificationInput
  SalesGeminiService.qualifyLead = async context => {
    qualificationInput = context.lead
    const { assessIcpCriteria, calculateQualificationScore } = require('../dist/services/qualification-icp.service')
    const criteria = assessIcpCriteria(context.lead, context.icp)
    return { status: 'needs_review', score: calculateQualificationScore(criteria), criteria, evidence: criteria.flatMap(item => item.evidence), reasons: ['Review needed'], unknowns: [] }
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
      'x-salesetu-workspace': workspace, 'x-salesetu-timestamp': timestamp, 'x-salesetu-signature': signature,
      'content-type': 'application/json',
    }, body: body ? JSON.stringify(body) : undefined })
  }
  try {
    const saved = await request(a, 'POST', '/api/sheets/leads', { company: 'Sample Systems', website: 'sample.example', industry: '', city: '', country: '', employees: '', intentSignal: '', leadScore: 0, status: 'PROSPECT' })
    assert.equal(saved.status, 201)
    const lead = await saved.json()
    assert.equal((await request(b, 'GET', `/api/leads/${lead.id}/research`)).status, 404)
    const first = await (await request(a, 'GET', `/api/leads/${lead.id}/research`)).json()
    assert.equal(first.lead.id, lead.id)
    assert.equal(first.lead.industry, 'SaaS')
    assert.equal(first.lead.city, 'Pune')
    assert.equal(first.lead.employees, 120)
    assert.equal(first.research.facts.city.sourceUrl, sources[0].url)
    assert.equal(first.research.sources[0].url, sources[0].url)
    const second = await (await request(a, 'GET', `/api/leads/${lead.id}/research`)).json()
    assert.equal(second.research.summary, first.research.summary)
    assert.equal(researchCalls, 1)
    assert.equal((await (await request(a, 'GET', `/api/leads/${lead.id}`)).json()).companyResearch.facts.employees.value, 120)
    await request(a, 'PUT', '/api/sheets/icp-rulebook', { rulebook: { industries: ['SaaS'], cities: ['Pune'], minEmp: '100', maxEmp: '200' } })
    const qualification = await (await request(a, 'POST', `/api/leads/${lead.id}/qualify`, {})).json()
    assert.equal(qualificationInput.companyResearch.facts.industry.sourceUrl, sources[0].url)
    assert.equal(qualification.qualification.score, 100)
    assert.equal(qualification.lead.qualificationResearchStale, false)
    assert.ok(qualification.qualification.evidence.some(item => item.field === 'city' && item.origin === 'source_backed' && item.sourceUrl === sources[0].url))
    await new Promise(resolve => setTimeout(resolve, 5)) // Existing lead IDs are based on Date.now().
    const olderLead = await (await request(a, 'POST', '/api/sheets/leads', { company: 'Sample Systems', website: 'sample.example', industry: 'SaaS', city: '', country: '', employees: '', intentSignal: '', leadScore: 0, status: 'PROSPECT' })).json()
    const olderQualification = await request(a, 'POST', `/api/leads/${olderLead.id}/qualify`, {})
    assert.equal(olderQualification.status, 200)
    await request(a, 'GET', `/api/leads/${olderLead.id}/research`)
    const nowStale = await (await request(a, 'GET', `/api/leads/${olderLead.id}`)).json()
    assert.equal(nowStale.qualificationResearchStale, true)
    const { runInWorkspace } = require('../dist/services/workspace-context.service')
    const { checkOutreachQualification } = require('../dist/services/qualification-guard.service')
    const blocked = await runInWorkspace(a, () => checkOutreachQualification(olderLead.id, olderLead.company))
    assert.equal(blocked.status, 409)
    assert.match(blocked.error, /Research changed/)
    const failedLead = await (await request(a, 'POST', '/api/sheets/leads', { company: 'Unavailable Systems', website: '', industry: '', city: '', country: '', employees: '', intentSignal: '', leadScore: 0, status: 'PROSPECT' })).json()
    TavilyService.searchCompany = async () => { throw new Error('Provider unavailable') }
    const failedResearch = await (await request(a, 'GET', `/api/leads/${failedLead.id}/research`)).json()
    assert.equal(failedResearch.research, null)
    assert.equal((await (await request(a, 'GET', `/api/leads/${failedLead.id}`)).json()).companyResearch, undefined)
    const pocsResponse = await request(a, 'GET', `/api/leads/${lead.id}/pocs`)
    assert.equal(pocsResponse.status, 200)
    const pocs = await pocsResponse.json()
    assert.equal(pocs.lead.id, lead.id)
    assert.equal(pocs.pocs[0].profileUrl, pocs.sources[0].url)
    assert.equal(pocs.pocs[0].sourceUrl, pocs.sources[0].url)
    assert.equal((await request(b, 'GET', `/api/leads/${lead.id}/pocs`)).status, 404)
    TavilyService.searchPOCs = async () => []
    const empty = await (await request(a, 'GET', `/api/leads/${lead.id}/pocs`)).json()
    assert.equal(empty.status, 'insufficient_evidence')
    assert.deepEqual(empty.pocs, [])
    TavilyService.searchPOCs = async () => { throw new Error('Tavily search failed (HTTP 429)') }
    const quota = await request(a, 'GET', `/api/leads/${lead.id}/pocs`)
    assert.equal(quota.status, 429)
  } finally {
    TavilyService.searchCompany = original.searchCompany
    TavilyService.searchPOCs = original.searchPOCs
    SalesGeminiService.researchCompany = original.researchCompany
    SalesGeminiService.identifyPOCs = original.identifyPOCs
    SalesGeminiService.qualifyLead = original.qualifyLead
    await new Promise(resolve => server.close(resolve))
    fs.rmSync(directory, { recursive: true, force: true })
    for (const key of Object.keys(process.env)) if (!(key in before)) delete process.env[key]
    Object.assign(process.env, before)
  }
})
