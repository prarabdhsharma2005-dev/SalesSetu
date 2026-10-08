const test = require('node:test')
const assert = require('node:assert/strict')
const { randomBytes } = require('node:crypto')

test('OAuth state and encrypted Gmail tokens survive stateless calls through isolated database stubs', async () => {
  const keys = ['DATABASE_URL', 'GMAIL_OAUTH_CLIENT_ID', 'GMAIL_OAUTH_CLIENT_SECRET', 'GMAIL_OAUTH_REDIRECT_URI', 'GMAIL_TOKEN_ENCRYPTION_KEY', 'APP_ACCESS_USER']
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]))
  Object.assign(process.env, {
    DATABASE_URL: 'postgresql://isolated:isolated@localhost/isolated', GMAIL_OAUTH_CLIENT_ID: 'isolated-client',
    GMAIL_OAUTH_CLIENT_SECRET: 'isolated-secret', GMAIL_OAUTH_REDIRECT_URI: 'https://backend.example.invalid/api/gmail/oauth/callback',
    GMAIL_TOKEN_ENCRYPTION_KEY: randomBytes(32).toString('base64'), APP_ACCESS_USER: 'isolated-owner',
  })
  const db = require('../dist/services/postgres-store.service')
  const saved = Object.fromEntries(['saveOAuthState', 'consumeOAuthState', 'readEncryptedGmailToken', 'writeEncryptedGmailToken', 'deleteEncryptedGmailToken'].map(key => [key, db[key]]))
  const states = new Set()
  let envelope = null
  db.saveOAuthState = async digest => { states.add(digest) }
  db.consumeOAuthState = async digest => states.delete(digest)
  db.readEncryptedGmailToken = async () => envelope
  db.writeEncryptedGmailToken = async (_owner, value) => { envelope = value }
  db.deleteEncryptedGmailToken = async () => { envelope = null }
  const originalFetch = globalThis.fetch
  globalThis.fetch = async input => {
    const url = String(input)
    if (url.endsWith('/token')) return new Response(JSON.stringify({ access_token: 'isolated-access', refresh_token: 'isolated-refresh', expires_in: 3600, scope: 'openid email https://www.googleapis.com/auth/gmail.send' }), { status: 200 })
    if (url.endsWith('/userinfo')) return new Response(JSON.stringify({ email: 'isolated@example.com', email_verified: true }), { status: 200 })
    throw new Error('Unexpected network request')
  }
  try {
    const { GmailService } = require('../dist/services/gmail.service')
    const auth = new URL(await GmailService.authorizationUrl())
    assert.equal(states.size, 1)
    const state = auth.searchParams.get('state')
    assert.equal(await GmailService.completeAuthorization(state, 'isolated-code'), 'isolated@example.com')
    assert.equal(states.size, 0)
    assert.equal((await GmailService.status()).connected, true)
    assert.equal(envelope.includes('isolated-refresh'), false)
    await assert.rejects(GmailService.completeAuthorization(state, 'isolated-code'), /state is invalid/)
  } finally {
    Object.assign(db, saved)
    globalThis.fetch = originalFetch
    for (const key of keys) { if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key] }
  }
})
