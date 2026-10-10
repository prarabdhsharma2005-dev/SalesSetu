const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { createHmac, randomBytes } = require('node:crypto')

test('workspace assertions reject anonymous, altered, stale, and legacy-mode identity headers', () => {
  const prior = { ...process.env }
  Object.assign(process.env, { GOOGLE_WORKSPACES_ENABLED: 'true', INTERNAL_PROXY_SECRET: 'isolated-internal-secret-at-least-thirty-two-characters' })
  const { requireWorkspace, currentWorkspace } = require('../dist/services/workspace-context.service')
  const id = '123456789012345678901'
  const run = (headers, path = '/api/sheets/leads') => {
    let status = 200, entered = null
    const req = { method: 'GET', originalUrl: path, header(name) { return headers[name] } }
    const res = { status(value) { status = value; return this }, json() { return this } }
    requireWorkspace(req, res, () => { entered = currentWorkspace() })
    return { status, entered }
  }
  try {
    assert.equal(run({}).status, 401)
    const timestamp = String(Date.now())
    const message = `v1\n${timestamp}\n${id}\nGET\n/api/sheets/leads`
    const headers = { 'x-salesetu-workspace': id, 'x-salesetu-timestamp': timestamp, 'x-salesetu-signature': createHmac('sha256', process.env.INTERNAL_PROXY_SECRET).update(message).digest('hex') }
    assert.deepEqual(run(headers), { status: 200, entered: id })
    assert.equal(run(headers, '/api/sheets/outreach').status, 401)
    assert.equal(run({ ...headers, 'x-salesetu-workspace': '999999999999' }).status, 401)
    assert.equal(run({ ...headers, 'x-salesetu-timestamp': String(Date.now() - 60_000) }).status, 401)
    process.env.GOOGLE_WORKSPACES_ENABLED = 'false'
    assert.equal(run(headers).status, 503)
  } finally { for (const key of Object.keys(process.env)) if (!(key in prior)) delete process.env[key]; Object.assign(process.env, prior) }
})

test('two local workspaces isolate records, POC proofs, and encrypted Gmail state', async () => {
  const prior = { ...process.env }
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'salessetu-workspace-'))
  Object.assign(process.env, {
    DATA_DIR: directory, DATABASE_URL: '', GOOGLE_WORKSPACES_ENABLED: 'true', GOOGLE_SHEETS_WEBHOOK_URL: '',
    GMAIL_OAUTH_CLIENT_ID: 'isolated-client', GMAIL_OAUTH_CLIENT_SECRET: 'isolated-secret',
    GMAIL_OAUTH_REDIRECT_URI: 'http://localhost:5000/api/gmail/oauth/callback',
    GMAIL_TOKEN_ENCRYPTION_KEY: randomBytes(32).toString('base64'),
  })
  const { runInWorkspace } = require('../dist/services/workspace-context.service')
  const { GoogleSheetsService } = require('../dist/services/sheets.service')
  const { POCVerificationCache } = require('../dist/services/poc-verification-cache.service')
  const { GmailService } = require('../dist/services/gmail.service')
  const a = '123456789012345678901', b = '999999999999999999999'
  const originalFetch = global.fetch
  global.fetch = async input => {
    const url = String(input)
    if (url.endsWith('/token')) return new Response(JSON.stringify({ access_token: 'isolated-access', refresh_token: 'isolated-refresh', scope: 'openid email https://www.googleapis.com/auth/gmail.send' }), { status: 200 })
    if (url.endsWith('/userinfo')) return new Response(JSON.stringify({ email: 'isolated@example.invalid', email_verified: true }), { status: 200 })
    if (url.endsWith('/revoke')) return new Response('', { status: 200 })
    throw new Error('Unexpected external request')
  }
  try {
    assert.deepEqual(await runInWorkspace(a, () => GoogleSheetsService.getLeads()), [])
    assert.deepEqual(await runInWorkspace(b, () => GoogleSheetsService.getLeads()), [])
    await runInWorkspace(a, () => GoogleSheetsService.appendLead({ id: 'same-id', company: 'Private A', website: 'a.example', industry: 'SaaS', country: 'India', city: 'Pune', employees: 10, intentSignal: '', leadScore: 20, status: 'PROSPECT' }))
    assert.equal((await runInWorkspace(a, () => GoogleSheetsService.getLeads())).length, 1)
    assert.deepEqual(await runInWorkspace(b, () => GoogleSheetsService.getLeads()), [])
    const lead = { id: 'same-id', company: 'Private A', website: 'a.example' }
    const poc = { name: 'Source-backed Person', sourceUrl: 'https://a.example/person', role: null, department: null, profileUrl: null, confidence: 0.8 }
    const proof = runInWorkspace(a, () => POCVerificationCache.issue(lead, poc))
    assert.ok(runInWorkspace(a, () => POCVerificationCache.verify(lead, { ...poc, verificationToken: proof })))
    assert.equal(runInWorkspace(b, () => POCVerificationCache.verify(lead, { ...poc, verificationToken: proof })), null)
    const authorization = await runInWorkspace(a, () => GmailService.authorizationUrl())
    await GmailService.completeAuthorization(new URL(authorization).searchParams.get('state'), 'isolated-code')
    assert.equal((await runInWorkspace(a, () => GmailService.status())).connected, true)
    assert.equal((await runInWorkspace(b, () => GmailService.status())).connected, false)
    const secondAuthorization = await runInWorkspace(b, () => GmailService.authorizationUrl())
    await GmailService.completeAuthorization(new URL(secondAuthorization).searchParams.get('state'), 'isolated-code')
    assert.equal((await runInWorkspace(b, () => GmailService.status())).connected, true)
    await runInWorkspace(a, () => GmailService.disconnect())
    assert.equal((await runInWorkspace(a, () => GmailService.status())).connected, false)
    assert.equal((await runInWorkspace(b, () => GmailService.status())).connected, true)
    assert.equal(fs.existsSync(path.join(directory, 'sheets_store.json')), false)
  } finally {
    global.fetch = originalFetch
    fs.rmSync(directory, { recursive: true, force: true })
    for (const key of Object.keys(process.env)) if (!(key in prior)) delete process.env[key]
    Object.assign(process.env, prior)
  }
})
