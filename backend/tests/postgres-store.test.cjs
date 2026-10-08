const test = require('node:test')
const assert = require('node:assert/strict')
const { Pool } = require('pg')

test('isolated PostgreSQL transaction rejects a stale snapshot without losing a collection', async () => {
  const originalQuery = Pool.prototype.query
  const originalConnect = Pool.prototype.connect
  const prior = process.env.DATABASE_URL
  process.env.DATABASE_URL = 'postgresql://isolated:isolated@localhost/isolated'
  let version = 1
  let stored = { leads: [], outreach: [], meetings: [], deals: [], meetingTasks: [], meetingSequenceApplications: [] }
  let commits = 0
  const query = async (sql, params = []) => {
    if (sql.startsWith('SELECT version, data')) return { rows: [{ version: String(version), data: structuredClone(stored) }] }
    if (sql.startsWith('SELECT version FROM')) return { rows: [{ version: String(version) }] }
    if (sql.startsWith('UPDATE salesetu_state')) { stored = JSON.parse(params[0]); version++; return { rows: [] } }
    if (sql === 'COMMIT') commits++
    return { rows: [] }
  }
  Pool.prototype.query = query
  Pool.prototype.connect = async () => ({ query, release() {} })
  try {
    const { readPostgresSnapshot, writePostgresSnapshot } = require('../dist/services/postgres-store.service')
    const first = await readPostgresSnapshot()
    const stale = await readPostgresSnapshot()
    first.meetingTasks.push({ id: 'task-1', revision: 1 })
    await writePostgresSnapshot(first)
    stale.meetingSequenceApplications.push({ id: 'audit-1' })
    await assert.rejects(writePostgresSnapshot(stale), /changed concurrently/)
    assert.equal(commits, 1)
    assert.deepEqual(stored.meetingTasks, [{ id: 'task-1', revision: 1 }])
    assert.deepEqual(stored.meetingSequenceApplications, [])
    assert.equal(version, 2)
  } finally {
    Pool.prototype.query = originalQuery
    Pool.prototype.connect = originalConnect
    if (prior === undefined) delete process.env.DATABASE_URL
    else process.env.DATABASE_URL = prior
  }
})
