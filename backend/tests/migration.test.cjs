const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { Client } = require('pg')

test('explicit PostgreSQL import is atomic, repeat-safe, and refuses a changed source', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'salesetu-import-isolated-'))
  const source = path.join(directory, 'source.json')
  fs.writeFileSync(source, JSON.stringify({ leads: [], outreach: [], meetings: [], deals: [], meetingTasks: [{ id: 'isolated-task' }] }))
  const saved = { argv: process.argv, url: process.env.DATABASE_URL, connect: Client.prototype.connect, query: Client.prototype.query, end: Client.prototype.end, log: console.log }
  process.argv = [process.execPath, 'scripts/migrate-local.cjs', '--source', source, '--apply']
  process.env.DATABASE_URL = 'postgresql://isolated:isolated@localhost/isolated'
  let migration = null, document = null, inserts = 0, commits = 0, rollbacks = 0
  Client.prototype.connect = async () => undefined
  Client.prototype.end = async () => undefined
  Client.prototype.query = async (sql, params = []) => {
    if (sql.startsWith('SELECT source_sha256')) return { rows: migration ? [{ source_sha256: migration }] : [] }
    if (sql.startsWith('SELECT id FROM salesetu_state')) return { rows: document ? [{ id: 'primary' }] : [] }
    if (sql.startsWith('INSERT INTO salesetu_state')) { document = JSON.parse(params[1]); inserts++; return { rows: [] } }
    if (sql.startsWith('INSERT INTO salesetu_migrations')) { migration = params[1]; return { rows: [] } }
    if (sql === 'COMMIT') commits++
    if (sql === 'ROLLBACK') rollbacks++
    return { rows: [] }
  }
  console.log = () => undefined
  const schema = require('../scripts/prepare-schema.cjs')
  const originalEnsureSchema = schema.ensureSchema
  schema.ensureSchema = async () => 'verified'
  try {
    const { main } = require('../scripts/migrate-local.cjs')
    await main()
    await main()
    assert.equal(inserts, 1)
    assert.equal(commits, 2)
    assert.equal(document.meetingTasks[0].id, 'isolated-task')
    fs.writeFileSync(source, JSON.stringify({ leads: [], outreach: [], meetings: [], deals: [], meetingTasks: [{ id: 'changed' }] }))
    await assert.rejects(main(), /different local snapshot/)
    assert.equal(rollbacks, 1)
    assert.equal(inserts, 1)
  } finally {
    process.argv = saved.argv
    if (saved.url === undefined) delete process.env.DATABASE_URL
    else process.env.DATABASE_URL = saved.url
    Client.prototype.connect = saved.connect
    Client.prototype.query = saved.query
    Client.prototype.end = saved.end
    console.log = saved.log
    schema.ensureSchema = originalEnsureSchema
    fs.rmSync(directory, { recursive: true, force: true })
  }
})
