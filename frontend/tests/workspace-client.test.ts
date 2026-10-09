import test from 'node:test'
import assert from 'node:assert/strict'
import { qualifyLead } from '../src/lib/api'
import { proxy } from '../src/proxy'
import { NextRequest } from 'next/server'

test('workspace qualification sends no browser-local ICP and relies on backend-owned rulebook', async () => {
  const previousMode = process.env.NEXT_PUBLIC_GOOGLE_WORKSPACES_ENABLED
  const previousFetch = globalThis.fetch
  process.env.NEXT_PUBLIC_GOOGLE_WORKSPACES_ENABLED = 'true'
  let request: { url: string; body: unknown } | null = null
  globalThis.fetch = async (input, init) => {
    request = { url: String(input), body: JSON.parse(String(init?.body)) }
    return new Response(JSON.stringify({ lead: { id: 'lead-1' }, qualification: { status: 'needs_review', score: 50 } }), { status: 200, headers: { 'content-type': 'application/json' } })
  }
  try {
    await qualifyLead('lead-1')
    assert.deepEqual(request, { url: '/api/backend/api/leads/lead-1/qualify', body: {} })
  } finally {
    globalThis.fetch = previousFetch
    if (previousMode === undefined) delete process.env.NEXT_PUBLIC_GOOGLE_WORKSPACES_ENABLED
    else process.env.NEXT_PUBLIC_GOOGLE_WORKSPACES_ENABLED = previousMode
  }
})

test('Google workspace mode exposes the public route while private authorization remains server-side', () => {
  const previous = process.env.GOOGLE_WORKSPACES_ENABLED
  process.env.GOOGLE_WORKSPACES_ENABLED = 'true'
  try { assert.equal(proxy(new NextRequest('https://frontend.example.invalid/')).status, 200) }
  finally { if (previous === undefined) delete process.env.GOOGLE_WORKSPACES_ENABLED; else process.env.GOOGLE_WORKSPACES_ENABLED = previous }
})
