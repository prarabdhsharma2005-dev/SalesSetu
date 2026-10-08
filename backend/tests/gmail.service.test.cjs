const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { randomBytes } = require('node:crypto')
const { GmailService } = require('../dist/services/gmail.service.js')

test('one-use OAuth state, encrypted token persistence, MIME send and disconnect use stubbed Google responses', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'salesetu-gmail-test-'))
  const keys = ['DATA_DIR', 'GMAIL_OAUTH_CLIENT_ID', 'GMAIL_OAUTH_CLIENT_SECRET', 'GMAIL_OAUTH_REDIRECT_URI', 'GMAIL_TOKEN_ENCRYPTION_KEY', 'APP_ACCESS_USER']
  const prior = Object.fromEntries(keys.map(key => [key, process.env[key]]))
  const previousFetch = globalThis.fetch
  const calls = []
  process.env.DATA_DIR = directory
  process.env.GMAIL_OAUTH_CLIENT_ID = 'isolated-client'
  process.env.GMAIL_OAUTH_CLIENT_SECRET = 'isolated-secret'
  process.env.GMAIL_OAUTH_REDIRECT_URI = 'http://localhost:5000/api/gmail/oauth/callback'
  process.env.GMAIL_TOKEN_ENCRYPTION_KEY = randomBytes(32).toString('base64')
  process.env.APP_ACCESS_USER = 'isolated-owner'
  globalThis.fetch = async (input, init) => {
    const url = String(input)
    calls.push({ url, body: init?.body })
    if (url.endsWith('/token')) return new Response(JSON.stringify({ access_token: 'test-access-token', refresh_token: 'test-refresh-token', expires_in: 60, scope: 'openid email https://www.googleapis.com/auth/gmail.send' }), { status: 200 })
    if (url.endsWith('/userinfo')) return new Response(JSON.stringify({ email: 'sender@example.com', email_verified: true }), { status: 200 })
    if (url.endsWith('/messages/send')) return new Response(JSON.stringify({ id: 'gmail-id', threadId: 'gmail-thread' }), { status: 200 })
    if (url.endsWith('/revoke')) return new Response('', { status: 200 })
    throw new Error('Unexpected network request')
  }
  try {
    assert.equal((await GmailService.status()).connected, false)
    const authorization = new URL(await GmailService.authorizationUrl())
    assert.ok(authorization.searchParams.get('scope').includes('gmail.send'))
    assert.equal(authorization.searchParams.get('access_type'), 'offline')
    const state = authorization.searchParams.get('state')
    const sender = await GmailService.completeAuthorization(state, 'isolated-code')
    assert.equal(sender, 'sender@example.com')
    await assert.rejects(GmailService.completeAuthorization(state, 'isolated-code'), /state is invalid or expired/)
    const encrypted = fs.readFileSync(path.join(directory, 'gmail_oauth.enc'), 'utf8')
    assert.equal(encrypted.includes('test-refresh-token'), false)
    assert.equal(encrypted.includes('sender@example.com'), false)
    assert.equal((await GmailService.status()).connected, true)
    const result = await GmailService.send({ to: 'recipient@example.com', subject: 'Hello', body: 'First line\nSecond line', threadId: 'existing-thread', inReplyTo: '<previous@example.com>' })
    assert.equal(result.gmailMessageId, 'gmail-id')
    assert.equal(calls.filter(call => call.url.endsWith('/token')).length, 2, 'expired access token was refreshed before sending')
    const sendCall = calls.find(call => call.url.endsWith('/messages/send'))
    const payload = JSON.parse(sendCall.body)
    assert.equal(payload.threadId, 'existing-thread')
    const mime = Buffer.from(payload.raw, 'base64url').toString('utf8')
    assert.match(mime, /To: <recipient@example.com>/)
    assert.match(mime, /In-Reply-To: <previous@example.com>/)
    assert.match(mime, /Content-Transfer-Encoding: base64/)
    const disconnected = await GmailService.disconnect()
    assert.equal(disconnected.revoked, true)
    assert.equal((await GmailService.status()).connected, false)
    assert.equal(fs.existsSync(path.join(directory, 'gmail_oauth.enc')), false)
  } finally {
    globalThis.fetch = previousFetch
    for (const key of keys) { if (prior[key] === undefined) delete process.env[key]; else process.env[key] = prior[key] }
    fs.rmSync(directory, { recursive: true, force: true })
  }
})
