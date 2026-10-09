const test = require('node:test')
const assert = require('node:assert/strict')
const { Pool } = require('pg')

test('PostgreSQL snapshot IDs isolate two workspaces and preserve primary', async () => {
  const prior = process.env.DATABASE_URL
  const originalQuery = Pool.prototype.query
  const originalConnect = Pool.prototype.connect
  process.env.DATABASE_URL = 'postgresql://isolated:isolated@localhost/isolated'
  const empty = () => ({ leads: [], deals: [], meetings: [], outreach: [] })
  const rows = new Map([['primary', { version: 1, data: { ...empty(), leads: [{ id: 'owner-record' }] } }]])
  const query = async (sql, params = []) => {
    if (sql.startsWith('SELECT version, data')) { const row = rows.get(params[0]); return { rows: row ? [{ version: String(row.version), data: structuredClone(row.data) }] : [] } }
    if (sql.startsWith('SELECT version FROM')) { const row = rows.get(params[0]); return { rows: row ? [{ version: String(row.version) }] : [] } }
    if (sql.startsWith('INSERT INTO salesetu_state')) { if (rows.has(params[0])) return { rowCount: 0, rows: [] }; rows.set(params[0], { version: 1, data: JSON.parse(params[1]) }); return { rowCount: 1, rows: [{ id: params[0] }] } }
    if (sql.startsWith('UPDATE salesetu_state')) { const row = rows.get(params[1]); row.version++; row.data = JSON.parse(params[0]); return { rowCount: 1 } }
    return { rows: [], rowCount: 0 }
  }
  Pool.prototype.query = query
  Pool.prototype.connect = async () => ({ query, release() {} })
  try {
    const { runInWorkspace } = require('../dist/services/workspace-context.service')
    const { readPostgresSnapshot, writePostgresSnapshot } = require('../dist/services/postgres-store.service')
    const a = '123456789012345678901', b = '999999999999999999999'
    assert.equal((await runInWorkspace(a, () => readPostgresSnapshot())).leads.length, 0)
    assert.equal((await runInWorkspace(b, () => readPostgresSnapshot())).leads.length, 0)
    const aData = await runInWorkspace(a, () => readPostgresSnapshot())
    aData.leads.push({ id: 'same-id' })
    await runInWorkspace(a, () => writePostgresSnapshot(aData))
    assert.equal((await runInWorkspace(a, () => readPostgresSnapshot())).leads.length, 1)
    assert.equal((await runInWorkspace(b, () => readPostgresSnapshot())).leads.length, 0)
    assert.deepEqual(rows.get('primary').data.leads, [{ id: 'owner-record' }])
    const stale = await runInWorkspace(a, () => readPostgresSnapshot())
    const current = await runInWorkspace(a, () => readPostgresSnapshot())
    current.deals.push({ id: 'deal-1' })
    await runInWorkspace(a, () => writePostgresSnapshot(current))
    await assert.rejects(runInWorkspace(a, () => writePostgresSnapshot(stale)), /changed concurrently/)
  } finally {
    Pool.prototype.query = originalQuery
    Pool.prototype.connect = originalConnect
    if (prior === undefined) delete process.env.DATABASE_URL
    else process.env.DATABASE_URL = prior
  }
})
