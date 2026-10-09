import test from 'node:test'
import assert from 'node:assert/strict'
import nextConfig from '../next.config'

test('workspace mode routes backend requests through the authenticated app route', async () => {
  const previous = process.env.GOOGLE_WORKSPACES_ENABLED
  try {
    process.env.GOOGLE_WORKSPACES_ENABLED = 'true'
    assert.deepEqual(await nextConfig.rewrites?.(), [])

    process.env.GOOGLE_WORKSPACES_ENABLED = 'false'
    const rewrites = await nextConfig.rewrites?.()
    assert.ok(Array.isArray(rewrites))
    assert.equal(rewrites[0]?.source, '/api/backend/:path*')
  } finally {
    if (previous === undefined) delete process.env.GOOGLE_WORKSPACES_ENABLED
    else process.env.GOOGLE_WORKSPACES_ENABLED = previous
  }
})
