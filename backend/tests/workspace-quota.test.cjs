const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { Pool } = require('pg')

test('workspace quota returns a durable 429 before a provider request', async () => {
  const prior = { ...process.env }
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'salessetu-quota-'))
  Object.assign(process.env, { DATA_DIR: directory, DATABASE_URL: '', WORKSPACE_AI_DAILY_LIMIT: '1' })
  const { runInWorkspace, workspaceStorageKey } = require('../dist/services/workspace-context.service')
  const { enforceWorkspaceQuota } = require('../dist/services/workspace-quota.service')
  const id = '123456789012345678901'
  const invoke = () => runInWorkspace(id, () => new Promise(resolve => {
    let status = 200, result = null, retry = null
    const response = { status(value) { status = value; return this }, set(name, value) { if (name === 'Retry-After') retry = value; return this }, json(value) { result = value; resolve({ status, result, retry, passed: false }); return this } }
    enforceWorkspaceQuota({ method: 'POST', originalUrl: '/api/ai/draft-email' }, response, () => resolve({ status, result, retry, passed: true }))
  }))
  try {
    assert.equal((await invoke()).passed, true)
    const blocked = await invoke()
    assert.equal(blocked.status, 429)
    assert.equal(blocked.result.code, 'WORKSPACE_QUOTA_EXCEEDED')
    assert.ok(Number(blocked.retry) > 0)
    assert.equal(blocked.result.retrySeconds, Number(blocked.retry))
    const manualSave = await runInWorkspace(id, () => new Promise(resolve => {
      enforceWorkspaceQuota({ method: 'POST', originalUrl: '/api/sheets/outreach' }, {}, () => resolve(true))
    }))
    assert.equal(manualSave, true, 'Saving a manual draft must not consume the AI request quota')
    const file = path.join(directory, 'workspaces', workspaceStorageKey(id), 'usage.json')
    assert.equal(Object.values(JSON.parse(fs.readFileSync(file, 'utf8')))[0], 1)
  } finally {
    fs.rmSync(directory, { recursive: true, force: true })
    for (const key of Object.keys(process.env)) if (!(key in prior)) delete process.env[key]
    Object.assign(process.env, prior)
  }
})

test('company discovery, research, and POC reads share the discovery counter', async () => {
  const prior = { ...process.env }
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'salessetu-discovery-quota-'))
  Object.assign(process.env, { DATA_DIR: directory, DATABASE_URL: '', WORKSPACE_DISCOVERY_DAILY_LIMIT: '2' })
  const { runInWorkspace, workspaceStorageKey } = require('../dist/services/workspace-context.service')
  const { enforceWorkspaceQuota } = require('../dist/services/workspace-quota.service')
  const id = '123456789012345678901'
  const invoke = (method, pathName) => runInWorkspace(id, () => new Promise(resolve => {
    let status = 200, result = null
    const response = { status(value) { status = value; return this }, set() { return this }, json(value) { result = value; resolve({ status, result }); return this } }
    enforceWorkspaceQuota({ method, originalUrl: pathName }, response, () => resolve({ status, result }))
  }))
  try {
    assert.equal((await invoke('POST', '/api/leads/discovery')).status, 200)
    assert.equal((await invoke('GET', '/api/leads/lead-1/research')).status, 200)
    const blocked = await invoke('GET', '/api/leads/lead-1/pocs')
    assert.equal(blocked.status, 429)
    assert.equal(blocked.result.code, 'WORKSPACE_QUOTA_EXCEEDED')
    const usage = JSON.parse(fs.readFileSync(path.join(directory, 'workspaces', workspaceStorageKey(id), 'usage.json'), 'utf8'))
    assert.equal(Object.values(usage)[0], 2)
  } finally {
    fs.rmSync(directory, { recursive: true, force: true })
    for (const key of Object.keys(process.env)) if (!(key in prior)) delete process.env[key]
    Object.assign(process.env, prior)
  }
})

test('production quota uses one atomic PostgreSQL upsert per claim', async () => {
  const prior = { ...process.env }
  const originalQuery = Pool.prototype.query
  Object.assign(process.env, { DATABASE_URL: 'postgresql://isolated:isolated@localhost/isolated', WORKSPACE_SEND_DAILY_LIMIT: '1' })
  let count = 0, calls = 0
  Pool.prototype.query = async (sql, params) => { calls++; assert.match(sql, /ON CONFLICT.*DO UPDATE SET count/); assert.equal(params[0], '123456789012345678901'); assert.equal(params[3], 1); return { rowCount: ++count === 1 ? 1 : 0 } }
  const { runInWorkspace } = require('../dist/services/workspace-context.service')
  const { enforceWorkspaceQuota } = require('../dist/services/workspace-quota.service')
  const invoke = () => runInWorkspace('123456789012345678901', () => new Promise(resolve => {
    let status = 200
    const response = { status(value) { status = value; return this }, set() { return this }, json() { resolve(status); return this } }
    enforceWorkspaceQuota({ method: 'POST', originalUrl: '/api/gmail/outreach/id-1/send' }, response, () => resolve(status))
  }))
  try { assert.equal(await invoke(), 200); assert.equal(await invoke(), 429); assert.equal(calls, 2) }
  finally { Pool.prototype.query = originalQuery; for (const key of Object.keys(process.env)) if (!(key in prior)) delete process.env[key]; Object.assign(process.env, prior) }
})
