const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { createHmac } = require('node:crypto')

test('workspace ICP qualification is explicit, persisted, revision-aware, and isolated', async () => {
  const previous = { ...process.env }
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'salessetu-qualification-'))
  Object.assign(process.env, {
    DATA_DIR: directory, DATABASE_URL: '', NODE_ENV: 'test', GOOGLE_WORKSPACES_ENABLED: 'true',
    INTERNAL_PROXY_SECRET: 'isolated-internal-secret-at-least-thirty-two-characters',
    APP_ACCESS_USER: 'isolated-service', APP_ACCESS_PASSWORD: 'isolated-service-password-more-than-24-chars',
    GOOGLE_SHEETS_WEBHOOK_URL: '', FOLLOW_UP_SCHEDULER_ENABLED: 'false',
  })
  const app = require('../dist/app').default
  const { SalesGeminiService } = require('../dist/services/gemini.service')
  const { assessIcpCriteria, calculateQualificationScore } = require('../dist/services/qualification-icp.service')
  const originalQualify = SalesGeminiService.qualifyLead
  let providerCalls = 0
  SalesGeminiService.qualifyLead = async context => {
    providerCalls++
    const criteria = assessIcpCriteria(context.lead, context.icp)
    const score = calculateQualificationScore(criteria)
    return {
      status: score === 100 ? 'qualified' : 'not_qualified', score,
      criteria, evidence: criteria.flatMap(item => item.evidence),
      reasons: [`ICP criteria scored ${score}`], unknowns: [],
    }
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
    const lead = await (await request(a, 'POST', '/api/sheets/leads', {
      company: 'Sourced Example', website: 'example.test', industry: 'SaaS', city: 'Pune', country: 'India', employees: 120,
      intentSignal: '', leadScore: 0, status: 'PROSPECT',
    })).json()
    assert.equal(lead.qualificationStatus, undefined) // Saving never triggers paid qualification.
    const missing = await request(a, 'POST', `/api/leads/${lead.id}/qualify`, {})
    assert.equal(missing.status, 409)
    assert.match((await missing.json()).error, /Save an ICP Rulebook/)
    assert.equal(providerCalls, 0)

    const firstRulebook = await (await request(a, 'PUT', '/api/sheets/icp-rulebook', {
      rulebook: { industries: ['SaaS'], cities: ['Pune'], minEmp: '100', maxEmp: '200' },
    })).json()
    assert.equal((await (await request(a, 'GET', '/api/sheets/icp-rulebook')).json()).rulebook.savedAt, firstRulebook.rulebook.savedAt)
    const unchanged = await (await request(a, 'PUT', '/api/sheets/icp-rulebook', {
      rulebook: { industries: ['SaaS'], cities: ['Pune'], minEmp: '100', maxEmp: '200' },
    })).json()
    assert.equal(unchanged.rulebook.savedAt, firstRulebook.rulebook.savedAt)
    assert.equal((await (await request(b, 'GET', '/api/sheets/icp-rulebook')).json()).rulebook, null)
    const qualified = await request(a, 'POST', `/api/leads/${lead.id}/qualify`, {})
    assert.equal(qualified.status, 200)
    const first = await qualified.json()
    assert.equal(first.qualification.score, 100)
    assert.equal(first.lead.qualificationStatus, 'qualified')
    assert.equal(first.lead.qualificationIcpSavedAt, firstRulebook.rulebook.savedAt)
    assert.equal(first.lead.qualificationIcpStale, false)
    assert.equal((await (await request(a, 'GET', `/api/leads/${lead.id}`)).json()).qualificationScore, 100)
    assert.equal((await (await request(a, 'GET', '/api/leads')).json()).leads[0].qualificationReasons[0], 'ICP criteria scored 100')

    const changed = await (await request(a, 'PUT', '/api/sheets/icp-rulebook', {
      rulebook: { industries: ['FinTech'], cities: ['Mumbai'], minEmp: '1000', maxEmp: '2000' },
    })).json()
    assert.notEqual(changed.rulebook.savedAt, firstRulebook.rulebook.savedAt)
    const outdated = await (await request(a, 'GET', `/api/leads/${lead.id}`)).json()
    assert.equal(outdated.qualificationScore, 100)
    assert.equal(outdated.qualificationIcpStale, true)
    assert.equal((await (await request(a, 'GET', '/api/sheets/leads')).json()).leads[0].qualificationIcpStale, true)
    assert.equal(providerCalls, 1) // ICP edits do not silently requalify.
    const { checkOutreachQualification } = require('../dist/services/qualification-guard.service')
    const { runInWorkspace } = require('../dist/services/workspace-context.service')
    const gate = await runInWorkspace(a, () => checkOutreachQualification(lead.id, lead.company))
    assert.equal(gate.lead.id, lead.id)
    assert.equal(gate.lead.qualificationIcpStale, true)

    const requalified = await (await request(a, 'POST', `/api/leads/${lead.id}/qualify`, {})).json()
    assert.equal(requalified.qualification.score, 0)
    assert.equal(requalified.lead.qualificationStatus, 'not_qualified')
    assert.equal(requalified.lead.qualificationIcpStale, false)
    assert.equal((await (await request(a, 'GET', `/api/leads/${lead.id}`)).json()).qualificationScore, 0)
    assert.equal(providerCalls, 2)

    const sparse = await (await request(a, 'POST', '/api/sheets/leads', {
      company: 'Sparse Example', website: '', industry: '', city: '', country: '', employees: '',
      intentSignal: '', leadScore: 0, status: 'PROSPECT',
    })).json()
    const insufficient = await request(a, 'POST', `/api/leads/${sparse.id}/qualify`, {})
    assert.equal(insufficient.status, 409)
    assert.match((await insufficient.json()).error, /no assessable industry, city, or employee count/)
    assert.equal(providerCalls, 2)
    assert.equal((await request(b, 'GET', `/api/leads/${lead.id}`)).status, 404)
    assert.equal((await (await request(b, 'GET', '/api/sheets/leads')).json()).total, 0)
  } finally {
    SalesGeminiService.qualifyLead = originalQualify
    await new Promise(resolve => server.close(resolve))
    fs.rmSync(directory, { recursive: true, force: true })
    for (const key of Object.keys(process.env)) if (!(key in previous)) delete process.env[key]
    Object.assign(process.env, previous)
  }
})
