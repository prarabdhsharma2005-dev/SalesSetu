const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { createHmac } = require('node:crypto')

test('research facts require direct sourced statements; POC profiles require sourced person URLs', () => {
  const { sourceBackedResearchFacts, citedSummaryResearchFacts } = require('../dist/services/company-research.service')
  const { assessIcpCriteria, calculateQualificationScore } = require('../dist/services/qualification-icp.service')
  const { sourcedPersonProfileUrl } = require('../dist/services/gemini.service')
  const url = 'https://sample.example/about'
  assert.deepEqual(sourceBackedResearchFacts('Sample Systems', [{ title: 'Fintech companies in Pune', url, content: 'Sample Systems offers software. The search covers Pune. A different company has 250 employees.' }]), {})
  assert.deepEqual(sourceBackedResearchFacts('Sample Systems', [{ title: 'Sample Systems', url, content: 'Sample Systems is headquartered in Pune. Sample Systems has 120 employees.' }]), {
    city: { value: 'Pune', sourceUrl: url }, employees: { value: 120, sourceUrl: url },
  })
  assert.deepEqual(sourceBackedResearchFacts('Sample Systems', [{ title: 'Sample Systems', url, content: 'Sample Systems is a FinTech company headquartered in Pune. Sample Systems employs 1,200 people.' }]), {
    industry: { value: 'FinTech', sourceUrl: url }, city: { value: 'Pune', sourceUrl: url }, employees: { value: 1200, sourceUrl: url },
  })
  assert.deepEqual(sourceBackedResearchFacts('Sample Systems', [{ title: 'Fintech companies in Pune', url, content: 'Other Systems is a FinTech company headquartered in Pune and employs 900 people.' }]), {})
  assert.deepEqual(citedSummaryResearchFacts('OneCard', {
    summary: 'OneCard is a financial services company headquartered in Pune, India (http://www.cbinsights.com/company/onescore-app).',
    sources: [{ title: 'OneCard - Products, Competitors, Financials', url: 'http://www.cbinsights.com/company/onescore-app' }],
  }), {
    industry: { value: 'financial services', sourceUrl: 'http://www.cbinsights.com/company/onescore-app', basis: 'cited_summary' },
    city: { value: 'Pune', sourceUrl: 'http://www.cbinsights.com/company/onescore-app', basis: 'cited_summary' },
  })
  assert.deepEqual(citedSummaryResearchFacts('OneCard', {
    summary: 'OneCard is a financial services company headquartered in Pune, India (https://evil.example/claim).',
    sources: [{ title: 'OneCard - Products', url: 'https://legitimate.example/onecard' }],
  }), {})
  const razorpayDossier = { summary: 'Razorpay is an omnichannel payments and fintech solutions platform based in Bengaluru, Karnataka, founded in 2014 (https://www.cbinsights.com/company/razorpay-software, https://leadiq.com/c/razorpay/5a1d98b92300005900875bed).', sources: [{ title: 'Razorpay - Products, Competitors, Financials', url: 'https://www.cbinsights.com/company/razorpay-software' }] }
  assert.deepEqual(citedSummaryResearchFacts('Razorpay', razorpayDossier), {
    industry: { value: 'FinTech', sourceUrl: razorpayDossier.sources[0].url, basis: 'cited_summary' },
    city: { value: 'Bengaluru', sourceUrl: razorpayDossier.sources[0].url, basis: 'cited_summary' },
  })
  assert.deepEqual(citedSummaryResearchFacts('Razorpay', { ...razorpayDossier, summary: razorpayDossier.summary.replace('software, https:', 'software https:') }), {
    industry: { value: 'FinTech', sourceUrl: razorpayDossier.sources[0].url, basis: 'cited_summary' },
    city: { value: 'Bengaluru', sourceUrl: razorpayDossier.sources[0].url, basis: 'cited_summary' },
  })
  assert.deepEqual(citedSummaryResearchFacts('Razorpay', { ...razorpayDossier, summary: 'Another company is a fintech solutions platform based in Bengaluru (https://www.cbinsights.com/company/razorpay-software).' }), {})
  assert.equal(citedSummaryResearchFacts('Razorpay', { ...razorpayDossier, summary: 'Razorpay has 100 employees (https://www.cbinsights.com/company/razorpay-software). Razorpay has 200 employees (https://www.cbinsights.com/company/razorpay-software).' }).employees, undefined)
  assert.deepEqual(citedSummaryResearchFacts('OneCard', {
    summary: 'OneCard is a financial services company headquartered in Pune (https://upgrade.example/onecard).',
    sources: [{ title: 'Upgrade OneCard product launch', url: 'https://upgrade.example/onecard' }],
  }), {})
  const profile = 'https://www.linkedin.com/in/priya-shah/'
  assert.equal(sourcedPersonProfileUrl(profile, new Set([profile])), profile)
  for (const suspect of ['https://www.linkedin.com/company/sample/', 'https://linkedin.com.evil.example/in/priya/', 'http://www.linkedin.com/in/priya/']) {
    assert.equal(sourcedPersonProfileUrl(suspect, new Set([profile, suspect])), null)
  }
  assert.equal(sourcedPersonProfileUrl(profile, new Set()), null)
  assert.equal(sourcedPersonProfileUrl('https://www.linkedin.com/in/guessed/', new Set([profile])), null)
  const icp = { industries: ['FinTech'], cities: ['Bangalore'], stages: [], intents: [] }
  const partial = assessIcpCriteria({ industry: 'FinTech', city: 'Bengaluru', country: '', employees: '' }, icp)
  assert.equal(partial.find(item => item.key === 'geography_fit').score, 100)
  assert.equal(partial.find(item => item.key === 'company_size').score, null)
  assert.equal(calculateQualificationScore(partial), 100)
  assert.equal(calculateQualificationScore(assessIcpCriteria({ industry: '', city: '', country: '', employees: '' }, icp)), null)
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
    const savedIcp = await (await request(a, 'GET', '/api/sheets/icp-rulebook')).json()
    assert.deepEqual(savedIcp.rulebook.industries, ['SaaS'])
    assert.equal((await (await request(b, 'GET', '/api/sheets/icp-rulebook')).json()).rulebook, null)
    const qualification = await (await request(a, 'POST', `/api/leads/${lead.id}/qualify`, {})).json()
    assert.equal(qualificationInput.companyResearch.facts.industry.sourceUrl, sources[0].url)
    assert.equal(qualification.qualification.score, 100)
    assert.equal(qualification.lead.qualificationResearchStale, false)
    assert.ok(qualification.qualification.evidence.some(item => item.field === 'city' && item.origin === 'source_backed' && item.sourceUrl === sources[0].url))
    await new Promise(resolve => setTimeout(resolve, 5))
    const sparseLead = await (await request(a, 'POST', '/api/sheets/leads', { company: 'Sparse Systems', website: 'sparse.example', industry: '', city: '', country: '', employees: '', intentSignal: '', leadScore: 0, status: 'PROSPECT' })).json()
    TavilyService.searchCompany = async () => { researchCalls++; return [{ title: 'Sparse Systems', url: 'https://sparse.example/about', content: 'Sparse Systems offers software.' }] }
    const sparseResearch = await (await request(a, 'GET', `/api/leads/${sparseLead.id}/research`)).json()
    assert.deepEqual(sparseResearch.research.facts, {})
    const cached = await (await request(a, 'GET', `/api/leads/${sparseLead.id}/research`)).json()
    assert.deepEqual(cached.research.facts, {})
    const callsBeforeRefresh = researchCalls
    TavilyService.searchCompany = async () => { researchCalls++; return [{ title: 'Sparse Systems', url: 'https://sparse.example/about', content: 'Sparse Systems is a FinTech company headquartered in Pune. Sparse Systems employs 150 people.' }] }
    assert.equal((await request(b, 'POST', `/api/leads/${sparseLead.id}/research/refresh`)).status, 404)
    const refreshedResponse = await request(a, 'POST', `/api/leads/${sparseLead.id}/research/refresh`)
    assert.equal(refreshedResponse.status, 200)
    const refreshed = await refreshedResponse.json()
    assert.equal(researchCalls, callsBeforeRefresh + 1)
    assert.equal(refreshed.research.facts.city.sourceUrl, 'https://sparse.example/about')
    assert.equal(refreshed.lead.industry, 'FinTech')
    assert.equal(refreshed.lead.city, 'Pune')
    assert.equal(refreshed.lead.employees, 150)
    const refreshedLead = await (await request(a, 'GET', `/api/leads/${sparseLead.id}`)).json()
    assert.equal(refreshedLead.companyResearch.facts.employees.value, 150)
    const sparseQualification = await request(a, 'POST', `/api/leads/${sparseLead.id}/qualify`, {})
    assert.equal(sparseQualification.status, 200)
    assert.equal(qualificationInput.companyResearch.facts.industry.value, 'FinTech')
    assert.equal((await (await request(b, 'GET', `/api/leads/${sparseLead.id}`)).json()).error, 'Lead not found')
    const { runInWorkspace } = require('../dist/services/workspace-context.service')
    const { GoogleSheetsService } = require('../dist/services/sheets.service')
    const legacyDossiers = [
      { company: 'Groww', summary: 'Groww, formerly known as Nextbillion Technology, is a multi-product financial services platform based in Bellandur, Karnataka, that operates in the stock broking and investment sector (https://www.cbinsights.com/company/groww, https://research.contrary.com/company/groww).', sources: [{ title: 'Groww - Products, Competitors, Financials', url: 'https://www.cbinsights.com/company/groww' }, { title: 'Report: Groww Business Breakdown', url: 'https://research.contrary.com/company/groww' }], expectedScore: 0, expectedCity: 'Bellandur', expectedIndustry: 'financial services' },
      { company: 'OneCard', summary: 'OneCard is a financial services company headquartered in Pune, India, and was formerly known as FPL Consumer Solutions (http://www.cbinsights.com/company/onescore-app, http://in.linkedin.com/showcase/onecard-app).', sources: [{ title: 'OneCard - Products, Competitors, Financials', url: 'http://www.cbinsights.com/company/onescore-app' }, { title: 'OneCard', url: 'http://in.linkedin.com/showcase/onecard-app' }], expectedScore: 100, expectedCity: 'Pune', expectedIndustry: 'financial services' },
      { company: 'Razorpay', summary: 'Razorpay is an omnichannel payments and fintech solutions platform based in Bengaluru, Karnataka, founded in 2014 (https://www.cbinsights.com/company/razorpay-software https://leadiq.com/c/razorpay/5a1d98b92300005900875bed).', sources: [{ title: 'Razorpay - Products, Competitors', url: 'https://www.cbinsights.com/company/razorpay-software' }], expectedScore: 0, expectedCity: 'Bengaluru', expectedIndustry: 'FinTech' },
    ]
    let growwLeadId
    for (const dossier of legacyDossiers) {
      await new Promise(resolve => setTimeout(resolve, 5))
      const legacyLead = await (await request(a, 'POST', '/api/sheets/leads', { company: dossier.company, website: '', industry: '', city: '', country: '', employees: '', intentSignal: '', leadScore: 0, status: 'PROSPECT' })).json()
      if (dossier.company === 'Groww') growwLeadId = legacyLead.id
      await runInWorkspace(a, () => GoogleSheetsService.saveCompanyResearch(legacyLead.id, { summary: dossier.summary, sources: dossier.sources, facts: {}, updatedAt: '2026-10-11T10:00:00.000Z' }))
      const callsBeforeCachedRead = researchCalls
      assert.deepEqual((await (await request(a, 'GET', `/api/leads/${legacyLead.id}/research`)).json()).research.facts, {})
      assert.equal(researchCalls, callsBeforeCachedRead)
      assert.equal((await request(b, 'POST', `/api/leads/${legacyLead.id}/research/repair`)).status, 404)
      const repairedResponse = await request(a, 'POST', `/api/leads/${legacyLead.id}/research/repair`)
      assert.equal(repairedResponse.status, 200)
      const repaired = await repairedResponse.json()
      assert.equal(repaired.lead.industry, dossier.expectedIndustry)
      assert.equal(repaired.lead.city, dossier.expectedCity)
      assert.equal(repaired.lead.employees, '')
      assert.equal(repaired.research.facts.industry.basis, 'cited_summary')
      assert.equal((await request(a, 'POST', `/api/leads/${legacyLead.id}/research/repair`)).status, 422)
      const loaded = await (await request(a, 'GET', `/api/leads/${legacyLead.id}`)).json()
      assert.equal(loaded.companyResearch.facts.industry.sourceUrl, dossier.sources[0].url)
      const qualified = await (await request(a, 'POST', `/api/leads/${legacyLead.id}/qualify`, {})).json()
      assert.equal(qualified.qualification.score, dossier.expectedScore)
      assert.equal(qualified.qualification.status, 'needs_review')
      assert.equal(qualified.lead.qualificationIcpSavedAt, savedIcp.rulebook.savedAt)
      assert.equal(loaded.companyResearch.facts.industry.sourceUrl, dossier.sources[0].url)
      assert.equal((await (await request(a, 'GET', `/api/leads/${legacyLead.id}`)).json()).qualificationScore, dossier.expectedScore)
      assert.equal(qualificationInput.city, dossier.expectedCity)
      assert.equal(qualified.qualification.criteria.find(item => item.key === 'company_size').score, null)
      assert.match(qualified.qualification.criteria.find(item => item.key === 'industry_fit').assessment, /original source excerpt was not retained/)
      assert.ok(qualified.qualification.evidence.some(item => item.field === 'industry' && item.origin === 'ai_inference' && item.sourceUrl === dossier.sources[0].url))
      assert.equal((await request(b, 'GET', `/api/leads/${legacyLead.id}`)).status, 404)
    }
    await new Promise(resolve => setTimeout(resolve, 5))
    const autoLead = await (await request(a, 'POST', '/api/sheets/leads', { company: 'Cited Auto', website: '', industry: '', city: '', country: '', employees: '', intentSignal: '', leadScore: 0, status: 'PROSPECT' })).json()
    await runInWorkspace(a, () => GoogleSheetsService.saveCompanyResearch(autoLead.id, {
      summary: 'Cited Auto is a SaaS company headquartered in Pune (https://cited.example/company https://other.example/company).',
      sources: [{ title: 'Cited Auto company overview', url: 'https://cited.example/company' }], facts: {}, updatedAt: '2026-10-11T10:00:00.000Z',
    }))
    const beforeAuto = researchCalls
    const autoQualified = await (await request(a, 'POST', `/api/leads/${autoLead.id}/qualify`, {})).json()
    assert.equal(autoQualified.qualification.score, 100)
    assert.equal(autoQualified.lead.industry, 'SaaS')
    assert.equal(autoQualified.lead.city, 'Pune')
    assert.equal(autoQualified.lead.qualificationIcpSavedAt, savedIcp.rulebook.savedAt)
    assert.equal(autoQualified.qualification.evidence.find(item => item.field === 'city').sourceUrl, 'https://cited.example/company')
    assert.equal(researchCalls, beforeAuto) // Qualify reused saved evidence; no research call.
    assert.equal((await (await request(a, 'GET', `/api/leads/${autoLead.id}`)).json()).qualificationScore, 100)
    assert.equal((await request(b, 'POST', `/api/leads/${autoLead.id}/qualify`, {})).status, 404)
    const discoveredSource = { title: 'Newly Discovered Systems company', url: 'https://newly.example/about', snippet: 'Newly Discovered Systems company overview' }
    const discoveredSession = {
      id: 'newly-discovered-session', filters: { query: 'SaaS in Pune', industry: '', city: '', intent: '' },
      batch: 0, companies: [{ id: 'newly-discovered-candidate', name: 'Newly Discovered Systems', domain: 'newly.example', industry: null, city: null, country: null, employees: null, companyLinkedInUrl: null, sources: [discoveredSource] }],
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), status: 'complete', hasMore: false,
    }
    await runInWorkspace(a, () => GoogleSheetsService.createDiscoverySession(discoveredSession))
    const discoveredLead = (await runInWorkspace(a, () => GoogleSheetsService.saveDiscoveredCompanies(discoveredSession.id, ['newly-discovered-candidate']))).saved[0]
    assert.equal(discoveredLead.leadScore, 0)
    assert.equal(discoveredLead.qualificationScore, undefined)
    await runInWorkspace(a, () => GoogleSheetsService.saveCompanyResearch(discoveredLead.id, {
      summary: 'Newly Discovered Systems is a SaaS company headquartered in Pune (https://newly.example/about).',
      sources: [{ title: discoveredSource.title, url: discoveredSource.url }], facts: {}, updatedAt: '2026-10-11T10:00:00.000Z',
    }))
    const newlyAssessed = await (await request(a, 'POST', `/api/leads/${discoveredLead.id}/qualify`, {})).json()
    assert.equal(newlyAssessed.qualification.score, 100)
    assert.equal(newlyAssessed.lead.qualificationIcpSavedAt, savedIcp.rulebook.savedAt)
    assert.equal(newlyAssessed.qualification.evidence.find(item => item.field === 'industry').sourceUrl, discoveredSource.url)
    const reloadedNewLead = await (await request(a, 'GET', `/api/leads/${discoveredLead.id}`)).json()
    assert.equal(reloadedNewLead.qualificationScore, 100)
    assert.equal(reloadedNewLead.leadScore, 0)
    assert.equal(reloadedNewLead.companyResearch.facts.city.value, 'Pune')
    assert.equal((await request(b, 'GET', `/api/leads/${discoveredLead.id}`)).status, 404)
    assert.equal(researchCalls, callsBeforeRefresh + 1)
    await new Promise(resolve => setTimeout(resolve, 5))
    const newLead = await (await request(a, 'POST', '/api/sheets/leads', { company: 'Cited Systems', website: '', industry: '', city: '', country: '', employees: '', intentSignal: '', leadScore: 0, status: 'PROSPECT' })).json()
    TavilyService.searchCompany = async () => { researchCalls++; return [{ title: 'Cited Systems - Company', url: 'https://cited.example/about', content: 'Cited Systems offers online services.' }] }
    SalesGeminiService.researchCompany = async () => ({ summary: 'Cited Systems is a SaaS company headquartered in Pune (https://cited.example/about).', sources: [{ title: 'Cited Systems - Company', url: 'https://cited.example/about' }], model: 'stub' })
    const newResearch = await (await request(a, 'GET', `/api/leads/${newLead.id}/research`)).json()
    assert.equal(newResearch.research.facts.industry.basis, 'cited_summary')
    assert.equal(newResearch.lead.city, 'Pune')
    assert.equal((await (await request(a, 'GET', `/api/leads/${newLead.id}`)).json()).industry, 'SaaS')
    TavilyService.searchCompany = async () => { throw new Error('Provider unavailable') }
    assert.equal((await request(a, 'POST', `/api/leads/${sparseLead.id}/research/refresh`)).status, 503)
    assert.equal((await (await request(a, 'GET', `/api/leads/${sparseLead.id}`)).json()).companyResearch.facts.city.value, 'Pune')
    TavilyService.searchCompany = async () => { researchCalls++; return sources }
    await new Promise(resolve => setTimeout(resolve, 5)) // Existing lead IDs are based on Date.now().
    const olderLead = await (await request(a, 'POST', '/api/sheets/leads', { company: 'Sample Systems', website: 'sample.example', industry: 'SaaS', city: '', country: '', employees: '', intentSignal: '', leadScore: 0, status: 'PROSPECT' })).json()
    const olderQualification = await request(a, 'POST', `/api/leads/${olderLead.id}/qualify`, {})
    assert.equal(olderQualification.status, 200)
    await request(a, 'GET', `/api/leads/${olderLead.id}/research`)
    const nowStale = await (await request(a, 'GET', `/api/leads/${olderLead.id}`)).json()
    assert.equal(nowStale.qualificationResearchStale, true)
    const { checkOutreachQualification } = require('../dist/services/qualification-guard.service')
    const advisory = await runInWorkspace(a, () => checkOutreachQualification(olderLead.id, olderLead.company))
    assert.equal(advisory.lead.id, olderLead.id)
    assert.equal(advisory.lead.qualificationResearchStale, true)
    const failedLead = await (await request(a, 'POST', '/api/sheets/leads', { company: 'Unavailable Systems', website: '', industry: '', city: '', country: '', employees: '', intentSignal: '', leadScore: 0, status: 'PROSPECT' })).json()
    TavilyService.searchCompany = async () => { throw new Error('Tavily search request failed') }
    const failedResearch = await (await request(a, 'GET', `/api/leads/${failedLead.id}/research`)).json()
    assert.equal(failedResearch.research, null)
    assert.equal(failedResearch.researchErrorCode, 'TAVILY_UNAVAILABLE')
    assert.equal((await (await request(a, 'GET', `/api/leads/${failedLead.id}`)).json()).companyResearch, undefined)
    TavilyService.searchCompany = async () => { throw new Error('Tavily search failed (HTTP 429)') }
    const providerQuota = await (await request(a, 'GET', `/api/leads/${failedLead.id}/research`)).json()
    assert.equal(providerQuota.researchErrorCode, 'PROVIDER_QUOTA')
    TavilyService.searchCompany = async () => []
    const noSources = await (await request(a, 'GET', `/api/leads/${failedLead.id}/research`)).json()
    assert.equal(noSources.researchErrorCode, 'INSUFFICIENT_EVIDENCE')
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
    // A changed persisted ICP marks the old assessment stale until the user explicitly requalifies.
    await new Promise(resolve => setTimeout(resolve, 5))
    const growwIcp = await (await request(a, 'PUT', '/api/sheets/icp-rulebook', { rulebook: { industries: ['FinTech'], cities: ['Bangalore'], minEmp: 10, maxEmp: 500 } })).json()
    const beforeRequalify = await (await request(a, 'GET', `/api/leads/${growwLeadId}`)).json()
    assert.equal(beforeRequalify.qualificationScore, 0)
    assert.equal(beforeRequalify.qualificationIcpStale, true)
    const growwRequalified = await (await request(a, 'POST', `/api/leads/${growwLeadId}/qualify`, {})).json()
    assert.equal(growwRequalified.qualification.score, 100)
    assert.equal(growwRequalified.qualification.status, 'needs_review')
    assert.equal(growwRequalified.lead.qualificationIcpSavedAt, growwIcp.rulebook.savedAt)
    assert.equal(growwRequalified.qualification.criteria.find(item => item.key === 'company_size').score, null)
    assert.equal(growwRequalified.qualification.criteria.find(item => item.key === 'industry_fit').evidence.find(item => item.field === 'normalized industry').sourceUrl, 'https://www.cbinsights.com/company/groww')
    assert.equal(growwRequalified.qualification.criteria.find(item => item.key === 'geography_fit').evidence.find(item => item.field === 'normalized city').sourceUrl, 'https://site.bbmp.gov.in/zonalclassification.html')
    const growwReloaded = await (await request(a, 'GET', `/api/leads/${growwLeadId}`)).json()
    assert.equal(growwReloaded.qualificationScore, 100)
    assert.equal(growwReloaded.qualificationIcpSavedAt, growwIcp.rulebook.savedAt)
    assert.equal(growwReloaded.qualificationIcpStale, false)
    assert.equal(growwReloaded.city, 'Bellandur')
    assert.match(growwReloaded.qualificationCriteria.find(item => item.key === 'industry_fit').assessment, /financial services.*FinTech.*100\/100 points/i)
    assert.match(growwReloaded.qualificationCriteria.find(item => item.key === 'geography_fit').assessment, /Bellandur.*Bengaluru.*Bangalore.*100\/100 points/i)
    assert.deepEqual(growwReloaded.qualificationReasons, ['Review needed']) // Preserved stubbed reason; detailed comparisons are persisted in criteria.
    assert.ok(growwReloaded.qualificationEvidence.some(item => item.field === 'normalized city' && item.sourceUrl === 'https://site.bbmp.gov.in/zonalclassification.html'))
    assert.equal((await request(b, 'GET', `/api/leads/${growwLeadId}`)).status, 404)
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
