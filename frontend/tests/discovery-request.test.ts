import assert from 'node:assert/strict'
import test from 'node:test'
import { DiscoveryRequest } from '../src/lib/discovery-request'

test('clearing cancels the in-flight request and prevents a late result from becoming current', async () => {
  const request = new DiscoveryRequest()
  const first = request.start()
  assert.equal(first.isCurrent(), true)
  request.clear()
  assert.equal(first.signal.aborted, true)
  assert.equal(first.isCurrent(), false)
  const next = request.start()
  assert.equal(next.signal.aborted, false)
  assert.equal(next.isCurrent(), true)
  assert.equal(first.isCurrent(), false)
})

test('a newer search makes an older response stale even without clearing', () => {
  const request = new DiscoveryRequest()
  const first = request.start()
  const next = request.start()
  assert.equal(first.signal.aborted, true)
  assert.equal(first.isCurrent(), false)
  assert.equal(next.isCurrent(), true)
})
