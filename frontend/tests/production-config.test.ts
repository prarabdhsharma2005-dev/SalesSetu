import test from 'node:test'
import assert from 'node:assert/strict'
import { backendUrl } from '../backend-config'
import { proxy } from '../src/proxy'
import { NextRequest } from 'next/server'

test('deployment routing validates HTTPS origins and preserves the local default', () => {
  assert.equal(backendUrl({}), 'http://localhost:5000')
  assert.equal(backendUrl({ NODE_ENV: 'production', BACKEND_URL: 'https://api.example.com/' }), 'https://api.example.com')
  for (const value of ['', 'http://localhost:5000', 'https://api.example.com/path', 'https://user:pass@api.example.com']) assert.throws(() => backendUrl({ NODE_ENV: 'production', BACKEND_URL: value }))
})
test('frontend production access fails closed and authenticates without exposing credentials', () => {
  const saved = { ...process.env }
  Object.assign(process.env, { NODE_ENV: 'production', APP_ACCESS_USER: '', APP_ACCESS_PASSWORD: '' })
  try {
    const request = new NextRequest('https://frontend.example.com/api/backend/api/sheets/leads')
    assert.equal(proxy(request).status, 503)
    Object.assign(process.env, { APP_ACCESS_USER: 'test', APP_ACCESS_PASSWORD: 'test-only-password-long-enough' })
    assert.equal(proxy(request).status, 401)
    const authorization = `Basic ${Buffer.from('test:test-only-password-long-enough').toString('base64')}`
    assert.equal(proxy(new NextRequest(request.url, { headers: { authorization } })).status, 200)
    assert.equal(proxy(new NextRequest(request.url, { method: 'POST', headers: { authorization, origin: 'https://other.example' } })).status, 403)
  } finally { for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key]; Object.assign(process.env, saved) }
})
