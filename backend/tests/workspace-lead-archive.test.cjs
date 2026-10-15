const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { createHmac } = require('node:crypto')

test('archiving is reversible, count-checked, scoped to a workspace and preserves saved records', async () => {
  const previous = { ...process.env }
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'salessetu-lead-archive-'))
  Object.assign(process.env, {
    DATA_DIR: directory, DATABASE_URL: '', NODE_ENV: 'test', GOOGLE_WORKSPACES_ENABLED: 'true',
    INTERNAL_PROXY_SECRET: 'isolated-internal-secret-at-least-thirty-two-characters',
    APP_ACCESS_USER: 'isolated-service', APP_ACCESS_PASSWORD: 'isolated-service-password-more-than-24-chars',
    FOLLOW_UP_SCHEDULER_ENABLED: 'false', GOOGLE_SHEETS_WEBHOOK_URL: '',
  })
  const app = require('../dist/app').default
  const { GoogleSheetsService } = require('../dist/services/sheets.service')
  const { runInWorkspace, workspaceStorageKey } = require('../dist/services/workspace-context.service')
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
    const payload = company => ({ company, website: `${company.toLowerCase()}.example`, industry: '', city: '', country: '', employees: '', intentSignal: '', leadScore: 0, status: 'PROSPECT' })
    const first = await (await request(a, 'POST', '/api/sheets/leads', payload('First'))).json()
    await new Promise(resolve => setTimeout(resolve, 5))
    const second = await (await request(a, 'POST', '/api/sheets/leads', payload('Second'))).json()
    const foreign = await (await request(b, 'POST', '/api/sheets/leads', payload('Foreign'))).json()
    assert.equal((await request(b, 'POST', '/api/leads/archive', { ids: [first.id], archived: true, expectedCount: 1 })).status, 409)
    assert.equal((await request(a, 'POST', '/api/leads/archive', { all: true, archived: true, expectedCount: 1 })).status, 409)
    assert.equal((await (await request(a, 'POST', '/api/leads/archive', { ids: [first.id], archived: true, expectedCount: 1 })).json()).changed, 1)
    assert.equal((await (await request(a, 'GET', '/api/sheets/leads')).json()).total, 1)
    assert.deepEqual((await (await request(a, 'GET', '/api/leads?archived=true')).json()).leads.map(lead => lead.id), [first.id])
    assert.equal((await (await request(a, 'GET', `/api/leads/${first.id}`)).json()).archivedAt !== null, true)
    assert.equal((await runInWorkspace(a, () => GoogleSheetsService.getLeads())).length, 2) // Associations still resolve.
    assert.equal((await request(b, 'POST', '/api/leads/archive', { ids: [first.id], archived: false, expectedCount: 1 })).status, 409)
    assert.equal((await (await request(a, 'POST', '/api/leads/archive', { all: true, archived: true, expectedCount: 1 })).json()).changed, 1)
    assert.equal((await (await request(a, 'GET', '/api/sheets/leads')).json()).total, 0)
    assert.equal((await (await request(b, 'GET', '/api/sheets/leads')).json()).leads[0].id, foreign.id)
    assert.equal((await (await request(a, 'POST', '/api/leads/archive', { ids: [first.id], archived: false, expectedCount: 1 })).json()).changed, 1)
    assert.equal((await (await request(a, 'GET', '/api/sheets/leads')).json()).leads[0].id, first.id)
    assert.equal((await (await request(a, 'GET', '/api/leads?archived=true')).json()).leads[0].id, second.id)
    const session = { id: 'session-to-clear', filters: { query: 'test', industry: '', city: '', intent: '' }, batch: 0,
      companies: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), hasMore: false, status: 'empty' }
    await runInWorkspace(a, () => GoogleSheetsService.createDiscoverySession(session))
    const usagePath = path.join(directory, 'workspaces', workspaceStorageKey(a), 'usage.json')
    fs.writeFileSync(usagePath, JSON.stringify({ 'discovery:2026-10-14T00:00:00.000Z': 3 }))
    const usageBefore = fs.readFileSync(usagePath, 'utf8')
    assert.equal((await request(b, 'DELETE', '/api/leads/discovery/session-to-clear')).status, 200)
    assert.equal((await request(a, 'GET', '/api/leads/discovery/session-to-clear')).status, 200)
    assert.equal((await request(a, 'DELETE', '/api/leads/discovery/session-to-clear')).status, 200)
    assert.equal((await request(a, 'GET', '/api/leads/discovery/session-to-clear')).status, 404)
    assert.equal(fs.readFileSync(usagePath, 'utf8'), usageBefore)
  } finally {
    await new Promise(resolve => server.close(resolve))
    fs.rmSync(directory, { recursive: true, force: true })
    for (const key of Object.keys(process.env)) if (!(key in previous)) delete process.env[key]
    Object.assign(process.env, previous)
  }
})
