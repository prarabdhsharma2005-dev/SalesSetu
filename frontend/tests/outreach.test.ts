import assert from 'node:assert/strict'
import test from 'node:test'
import { appendOutreach, draftEmail, updateOutreachStatus } from '../src/lib/api'

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
    await updateOutreachStatus('outreach-1', 'PENDING_APPROVAL', '2026-01-01T00:00:00.000Z', true)
    assert.deepEqual(JSON.parse(requestBody), { status: 'PENDING_APPROVAL', expectedUpdatedAt: '2026-01-01T00:00:00.000Z', reviewAcknowledged: true })
  } finally {
    globalThis.fetch = previousFetch
  }
})

test('draft generation and persistence each use the bounded 60-second timeout instead of the global 8 seconds', async () => {
  const previousFetch = globalThis.fetch
  const previousSetTimeout = globalThis.setTimeout
  const durations: number[] = []
  globalThis.setTimeout = ((callback: (...args: unknown[]) => void, delay?: number, ...args: unknown[]) => {
    durations.push(Number(delay))
    return previousSetTimeout(callback, 1_000_000, ...args)
  }) as typeof setTimeout
  globalThis.fetch = async () => new Response(JSON.stringify({ id: 'draft-1', subject: 'Subject', body: 'Body' }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  try {
    await draftEmail({ leadId: 'lead-1', company: 'Example' })
    await appendOutreach({ prospectName: 'A Contact', email: null, company: 'Example', subject: 'Subject', body: 'Body', status: 'DRAFT' })
    assert.deepEqual(durations, [60_000, 60_000])
  } finally {
    globalThis.fetch = previousFetch
    globalThis.setTimeout = previousSetTimeout
  }
})

test('cancelled draft request reports cancellation without accepting a late response', async () => {
  const previousFetch = globalThis.fetch
  const controller = new AbortController()
  globalThis.fetch = async (_input, init) => new Promise((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
  })
  try {
    const request = draftEmail({ leadId: 'lead-1' }, controller.signal)
    controller.abort()
    await assert.rejects(request, /Request cancelled/)
  } finally { globalThis.fetch = previousFetch }
})
