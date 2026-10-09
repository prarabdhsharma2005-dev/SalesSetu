const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { createHmac } = require('node:crypto')

test('authenticated API cannot read or mutate another workspace by changing record IDs', async () => {
  const previous = { ...process.env }
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'salessetu-api-workspace-'))
  Object.assign(process.env, {
    DATA_DIR: directory, DATABASE_URL: '', NODE_ENV: 'test', GOOGLE_WORKSPACES_ENABLED: 'true',
    INTERNAL_PROXY_SECRET: 'isolated-internal-secret-at-least-thirty-two-characters',
    APP_ACCESS_USER: 'isolated-service', APP_ACCESS_PASSWORD: 'isolated-service-password-more-than-24-chars',
    FOLLOW_UP_SCHEDULER_ENABLED: 'false', GOOGLE_SHEETS_WEBHOOK_URL: '',
  })
  const app = require('../dist/app').default
  const server = app.listen(0)
  await new Promise(resolve => server.once('listening', resolve))
  const base = `http://127.0.0.1:${server.address().port}`
  const request = async (id, method, target, body) => {
    const timestamp = String(Date.now())
    const signature = createHmac('sha256', process.env.INTERNAL_PROXY_SECRET).update(`v1\n${timestamp}\n${id}\n${method}\n${target}`).digest('hex')
    return fetch(base + target, { method, headers: {
      authorization: `Basic ${Buffer.from(`${process.env.APP_ACCESS_USER}:${process.env.APP_ACCESS_PASSWORD}`).toString('base64')}`,
      'x-salesetu-workspace': id, 'x-salesetu-timestamp': timestamp, 'x-salesetu-signature': signature,
      'content-type': 'application/json',
    }, body: body ? JSON.stringify(body) : undefined })
  }
  const a = '123456789012345678901', b = '999999999999999999999'
  try {
    const created = await request(a, 'POST', '/api/sheets/leads', { company: 'Private Company A', website: 'a.example', industry: 'SaaS', city: 'Pune', country: 'India', employees: 10, intentSignal: '', leadScore: 20, status: 'PROSPECT' })
    assert.equal(created.status, 201)
    const lead = await created.json()
    const aList = await (await request(a, 'GET', '/api/sheets/leads')).json()
    const bList = await (await request(b, 'GET', '/api/sheets/leads')).json()
    assert.equal(aList.total, 1)
    assert.equal(bList.total, 0)
    assert.equal((await request(b, 'GET', `/api/leads/${lead.id}/pocs`)).status, 404)
    assert.equal((await request(b, 'POST', `/api/leads/${lead.id}/qualify`, {})).status, 404)
    assert.equal((await request(b, 'POST', '/api/ai/draft-email', { prospect: { leadId: lead.id, company: lead.company } })).status, 404)
    assert.equal((await request(b, 'DELETE', '/api/account')).status, 200)
    assert.equal((await (await request(a, 'GET', '/api/sheets/leads')).json()).total, 1)
    assert.equal((await request(a, 'DELETE', '/api/account')).status, 200)
    assert.equal((await (await request(a, 'GET', '/api/sheets/leads')).json()).total, 0)
  } finally {
    await new Promise(resolve => server.close(resolve))
    fs.rmSync(directory, { recursive: true, force: true })
    for (const key of Object.keys(process.env)) if (!(key in previous)) delete process.env[key]
    Object.assign(process.env, previous)
  }
})
