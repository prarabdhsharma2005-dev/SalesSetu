import assert from 'node:assert/strict'
import test from 'node:test'
import { updateOutreachStatus } from '../src/lib/api'

test('outreach submission sends the Needs Review acknowledgement to the backend', async () => {
  const previousFetch = globalThis.fetch
  let requestBody = ''
  globalThis.fetch = async (_input, init) => {
    requestBody = String(init?.body)
    return new Response(JSON.stringify({ id: 'outreach-1', status: 'PENDING_APPROVAL' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  try {
    await updateOutreachStatus('outreach-1', 'PENDING_APPROVAL', true)
    assert.deepEqual(JSON.parse(requestBody), { status: 'PENDING_APPROVAL', reviewAcknowledged: true })
  } finally {
    globalThis.fetch = previousFetch
  }
})
