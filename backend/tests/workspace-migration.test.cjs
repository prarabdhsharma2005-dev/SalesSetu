const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { Client } = require('pg')

test('owner migration dry-run, apply, and repeat preserve every collection and refuse overwrite', async () => {
  const priorEnv = { ...process.env }, priorArgv = process.argv
  const connect = Client.prototype.connect, query = Client.prototype.query, end = Client.prototype.end
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'salessetu-owner-migration-'))
  const backup = path.join(directory, 'private-backup.json')
  const data = { leads: [{ id: 'lead-1' }], outreach: [{ id: 'draft-1', contentRevision: 2 }], meetings: [], deals: [], meetingTasks: [{ id: 'task-1' }], meetingSequenceApplications: [{ id: 'audit-1' }] }
  const owner = '123456789012345678901'
  let workspace = null, marker = null
  Object.assign(process.env, { DATABASE_URL: 'postgresql://isolated:isolated@localhost/isolated', APP_ACCESS_USER: 'legacy-operator' })
  Client.prototype.connect = async () => undefined
  Client.prototype.end = async () => undefined
  Client.prototype.query = async (sql, params = []) => {
    if (sql.startsWith('SELECT data FROM salesetu_state WHERE id')) return { rows: params[0] === 'primary' ? [{ data: structuredClone(data) }] : workspace ? [{ data: structuredClone(workspace) }] : [] }
    if (sql.startsWith('SELECT source_sha256')) return { rows: marker ? [{ source_sha256: marker }] : [] }
    if (sql.startsWith('INSERT INTO salesetu_state')) { workspace = JSON.parse(params[1]); return { rowCount: 1 } }
    if (sql.startsWith('INSERT INTO salesetu_migrations')) { marker = params[1]; return { rowCount: 1 } }
    return { rows: [], rowCount: 0 }
  }
  const { main } = require('../scripts/migrate-owner-workspace.cjs')
  const originalLog = console.log
  console.log = () => undefined
  try {
    process.argv = ['node', 'script', '--owner-google-sub', owner, '--backup', backup]
    await main()
    assert.equal(workspace, null)
    const saved = JSON.parse(fs.readFileSync(backup, 'utf8'))
    assert.deepEqual(saved.data, data)
    process.argv.push('--apply')
    await main()
    assert.deepEqual(workspace, data)
    assert.equal(marker, saved.sourceSha256)
    await main()
    assert.deepEqual(workspace, data)
    fs.writeFileSync(backup, JSON.stringify({ ...saved, sourceSha256: 'tampered' }))
    await assert.rejects(main(), /backup|marker/i)
  } finally {
    console.log = originalLog
    process.argv = priorArgv
    Client.prototype.connect = connect
    Client.prototype.query = query
    Client.prototype.end = end
    fs.rmSync(directory, { recursive: true, force: true })
    for (const key of Object.keys(process.env)) if (!(key in priorEnv)) delete process.env[key]
    Object.assign(process.env, priorEnv)
  }
})
