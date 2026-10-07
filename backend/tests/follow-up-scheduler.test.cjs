const test = require('node:test')
const assert = require('node:assert/strict')
const {
  DEFAULT_FOLLOW_UP_SCHEDULER_INTERVAL_MS,
  startFollowUpScheduler,
} = require('../dist/services/follow-up-scheduler.service.js')

const emptyResult = { processed: 0, skipped: 0, errors: 0, details: [] }

function makeHarness(options = {}) {
  const timers = []
  const cleared = []
  const logs = { info: [], warn: [], error: [] }
  const logger = Object.fromEntries(Object.keys(logs).map(level => [level, message => logs[level].push(message)]))
  const scheduler = startFollowUpScheduler({
    env: { FOLLOW_UP_SCHEDULER_ENABLED: 'true', NODE_ENV: 'test' },
    logger,
    setInterval: (callback, intervalMs) => {
      const timer = { callback, intervalMs }
      timers.push(timer)
      return timer
    },
    clearInterval: timer => cleared.push(timer),
    ...options,
  })
  return { scheduler, timers, cleared, logs, fire: () => timers[0]?.callback() }
}

function deferred() {
  let resolve
  const promise = new Promise(done => { resolve = done })
  return { promise, resolve }
}

function flush() {
  return new Promise(resolve => setImmediate(resolve))
}

test('disabled by default: scheduler creates no interval', async () => {
  const timers = []
  const scheduler = startFollowUpScheduler({
    env: { NODE_ENV: 'development' },
    setInterval: (...args) => { timers.push(args); return {} },
    clearInterval: () => {},
    logger: { info: () => {}, warn: () => {}, error: () => {} },
  })
  assert.equal(scheduler.enabled, false)
  assert.equal(timers.length, 0)
  await scheduler.stop()
})

test('starts when explicitly enabled and creates one interval', async () => {
  const harness = makeHarness()
  assert.equal(harness.scheduler.enabled, true)
  assert.equal(harness.timers.length, 1)
  assert.equal(harness.timers[0].intervalMs, DEFAULT_FOLLOW_UP_SCHEDULER_INTERVAL_MS)
  assert.equal(harness.logs.info.some(message => message.includes('Started:')), true)
  await harness.scheduler.stop()
})

test('timer tick invokes the existing processor and logs aggregate counts', async () => {
  const called = deferred()
  let calls = 0
  const harness = makeHarness({ processDueFollowUps: async () => {
    calls += 1
    called.resolve()
    return { processed: 1, skipped: 2, errors: 0, details: [] }
  } })
  harness.fire()
  await called.promise
  await flush()
  assert.equal(calls, 1)
  assert.equal(harness.logs.info.some(message => message.includes('processed=1 skipped=2 errors=0')), true)
  await harness.scheduler.stop()
})

test('overlapping timer tick is skipped while the current processor is pending', async () => {
  const started = deferred()
  const release = deferred()
  let calls = 0
  const harness = makeHarness({ processDueFollowUps: async () => {
    calls += 1
    started.resolve()
    await release.promise
    return emptyResult
  } })
  harness.fire()
  await started.promise
  harness.fire()
  assert.equal(calls, 1)
  assert.equal(harness.logs.warn.some(message => message.includes('Overlapping tick skipped')), true)
  release.resolve()
  await harness.scheduler.stop()
})

test('a failed tick is caught and the next tick can run', async () => {
  let calls = 0
  const harness = makeHarness({ processDueFollowUps: async () => {
    calls += 1
    if (calls === 1) throw new Error('temporary processor failure')
    return emptyResult
  } })
  harness.fire()
  await flush()
  assert.equal(harness.logs.error.some(message => message.includes('temporary processor failure')), true)
  harness.fire()
  await flush()
  assert.equal(calls, 2)
  assert.equal(harness.logs.info.some(message => message.includes('Tick completed')), true)
  await harness.scheduler.stop()
})

test('stop clears the interval and a stale timer callback cannot start work', async () => {
  let calls = 0
  const harness = makeHarness({ processDueFollowUps: async () => { calls += 1; return emptyResult } })
  const oldCallback = harness.timers[0].callback
  await harness.scheduler.stop()
  assert.deepEqual(harness.cleared, [harness.timers[0]])
  oldCallback()
  await flush()
  assert.equal(calls, 0)
})

test('stop waits for an in-flight tick and prevents another one', async () => {
  const started = deferred()
  const release = deferred()
  let calls = 0
  let stopFinished = false
  const harness = makeHarness({ processDueFollowUps: async () => {
    calls += 1
    started.resolve()
    await release.promise
    return emptyResult
  } })
  harness.fire()
  await started.promise
  const stopping = harness.scheduler.stop().then(() => { stopFinished = true })
  await flush()
  assert.equal(stopFinished, false)
  harness.fire()
  assert.equal(calls, 1)
  release.resolve()
  await stopping
  assert.equal(stopFinished, true)
})

test('valid and invalid interval configuration are handled safely', async () => {
  const valid = makeHarness({ env: { FOLLOW_UP_SCHEDULER_ENABLED: 'true', FOLLOW_UP_SCHEDULER_INTERVAL_MS: '15000' } })
  assert.equal(valid.scheduler.intervalMs, 15000)
  assert.equal(valid.timers[0].intervalMs, 15000)
  await valid.scheduler.stop()

  for (const configured of ['invalid', '0', '-10', '2147483648']) {
    const invalid = makeHarness({ env: { FOLLOW_UP_SCHEDULER_ENABLED: 'true', FOLLOW_UP_SCHEDULER_INTERVAL_MS: configured } })
    assert.equal(invalid.scheduler.intervalMs, DEFAULT_FOLLOW_UP_SCHEDULER_INTERVAL_MS)
    assert.equal(invalid.logs.warn.some(message => message.includes('Invalid interval configuration')), true)
    await invalid.scheduler.stop()
  }
})

test('scheduler delegates workflow work without approval, delivery, qualification, or cadence operations', async () => {
  let processorCalls = 0
  let sideEffectCalls = 0
  const harness = makeHarness({
    processDueFollowUps: async () => { processorCalls += 1; return emptyResult },
    approveDraft: () => { sideEffectCalls += 1 },
    sendMessage: () => { sideEffectCalls += 1 },
    changeQualification: () => { sideEffectCalls += 1 },
    changeCadence: () => { sideEffectCalls += 1 },
  })
  harness.fire()
  await flush()
  assert.equal(processorCalls, 1)
  assert.equal(sideEffectCalls, 0)
  await harness.scheduler.stop()
})
