const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { spawnSync } = require('node:child_process')

test('production Vercel entry exports Express without a local listener or filesystem store', () => {
  const backend = path.resolve(__dirname, '..')
  const pkg = JSON.parse(fs.readFileSync(path.join(backend, 'package.json'), 'utf8'))
  const vercel = JSON.parse(fs.readFileSync(path.join(backend, 'vercel.json'), 'utf8'))
  assert.equal(pkg.main, 'dist/app.js')
  assert.equal(vercel.framework, 'express')
  assert.ok(!vercel.crons)
  assert.equal(fs.existsSync(path.join(backend, 'src/server.ts')), false)
  const script = `
    const fs = require('node:fs');
    const net = require('node:net');
    const pg = require('pg');
    fs.writeFileSync = () => { throw new Error('filesystem write during import'); };
    net.Server.prototype.listen = () => { throw new Error('local listener during import'); };
    pg.Pool.prototype.query = () => { throw new Error('database query during import'); };
    const app = require('./dist/app').default;
    if (typeof app !== 'function') throw new Error('Express app was not exported');
    process.stdout.write('serverless entry imported');
  `
  const child = spawnSync(process.execPath, ['-e', script], {
    cwd: backend, encoding: 'utf8',
    env: {
      ...process.env,
      NODE_ENV: 'production', DATABASE_URL: 'postgresql://isolated:isolated@localhost/isolated',
      GEMINI_API_KEY: 'isolated', TAVILY_API_KEY: 'isolated', FRONTEND_URL: 'https://frontend.example.invalid',
      APP_ACCESS_USER: 'isolated', APP_ACCESS_PASSWORD: 'isolated-password-long-enough',
      DATA_DIR: 'C:/nonexistent-salesetu-store', SINGLE_INSTANCE: 'false', FOLLOW_UP_SCHEDULER_ENABLED: 'false',
    },
  })
  assert.equal(child.status, 0, child.stderr)
  assert.equal(child.stdout, 'serverless entry imported')
})

test('Vercel cron endpoint rejects missing authorization and stays disabled initially', async () => {
  const saved = { secret: process.env.CRON_SECRET, enabled: process.env.FOLLOW_UP_SCHEDULER_ENABLED, database: process.env.DATABASE_URL }
  process.env.CRON_SECRET = 'isolated-test-secret-at-least-32-characters'
  process.env.FOLLOW_UP_SCHEDULER_ENABLED = 'false'
  delete process.env.DATABASE_URL
  const app = require('../dist/app').default
  const server = app.listen(0)
  await new Promise(resolve => server.once('listening', resolve))
  const url = `http://127.0.0.1:${server.address().port}/api/cron/follow-ups`
  try {
    assert.equal((await fetch(url)).status, 401)
    const disabled = await fetch(url, { headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` } })
    assert.equal(disabled.status, 503)
  } finally {
    await new Promise(resolve => server.close(resolve))
    for (const [key, value] of [['CRON_SECRET', saved.secret], ['FOLLOW_UP_SCHEDULER_ENABLED', saved.enabled], ['DATABASE_URL', saved.database]]) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
})

test('migration dry run validates all collections without a database connection', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'salesetu-migration-test-'))
  const source = path.join(directory, 'isolated.json')
  fs.writeFileSync(source, JSON.stringify({ leads: [], outreach: [], meetings: [], deals: [], meetingTasks: [{ id: 'test' }] }))
  try {
    const command = spawnSync(process.execPath, ['scripts/migrate-local.cjs', '--source', source], { cwd: path.resolve(__dirname, '..'), env: { ...process.env, DATABASE_URL: '' }, encoding: 'utf8' })
    assert.equal(command.status, 0, command.stderr)
    const result = JSON.parse(command.stdout.trim())
    assert.equal(result.mode, 'dry-run')
    assert.equal(result.counts.meetingTasks, 1)
  } finally { fs.rmSync(directory, { recursive: true, force: true }) }
})
