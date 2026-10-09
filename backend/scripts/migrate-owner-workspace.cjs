#!/usr/bin/env node
// Explicit, repeat-safe owner assignment. Never runs during application startup.
require('dotenv/config')
const fs = require('node:fs')
const path = require('node:path')
const { createHash, createDecipheriv, createCipheriv, randomBytes } = require('node:crypto')
const { Client } = require('pg')

function option(name) { const i = process.argv.indexOf(name); return i < 0 ? null : process.argv[i + 1] }
function checksum(data, token) { return createHash('sha256').update(JSON.stringify(data)).update(token || '').digest('hex') }
function transferEnvelope(envelope, from, to) {
  const key = Buffer.from(process.env.GMAIL_TOKEN_ENCRYPTION_KEY || '', 'base64')
  if (key.length !== 32) throw new Error('Existing 32-byte GMAIL_TOKEN_ENCRYPTION_KEY is required to transfer Gmail credentials.')
  const stored = JSON.parse(envelope)
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(stored.iv, 'base64'))
  decipher.setAuthTag(Buffer.from(stored.tag, 'base64'))
  const tokens = JSON.parse(Buffer.concat([decipher.update(Buffer.from(stored.ciphertext, 'base64')), decipher.final()]).toString('utf8'))
  if (tokens.owner !== from || !tokens.refreshToken) throw new Error('Existing Gmail token owner/key is inconsistent; import refused.')
  tokens.owner = to
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(tokens), 'utf8'), cipher.final()])
  return JSON.stringify({ iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), ciphertext: ciphertext.toString('base64') })
}

async function main() {
  const owner = option('--owner-google-sub')
  const backup = option('--backup')
  const apply = process.argv.includes('--apply')
  const includeGmail = process.argv.includes('--include-gmail-token')
  if (!/^\d{10,32}$/.test(owner || '')) throw new Error('Specify the verified owner Google sub with --owner-google-sub.')
  if (!backup || backup.startsWith('--')) throw new Error('Specify a private, nonexistent backup path with --backup.')
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.')
  if (includeGmail && !process.env.APP_ACCESS_USER) throw new Error('APP_ACCESS_USER is required for optional Gmail token transfer.')
  const client = new Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 10000 })
  await client.connect()
  try {
    await client.query('BEGIN')
    await client.query("SELECT pg_advisory_xact_lock(hashtext('salesetu_owner_workspace_v1'))")
    const primary = await client.query('SELECT data FROM salesetu_state WHERE id = $1 FOR UPDATE', ['primary'])
    if (!primary.rows[0]) throw new Error('Primary snapshot is missing; import/verify existing data first.')
    const token = includeGmail ? await client.query('SELECT envelope FROM salesetu_gmail_tokens WHERE owner = $1 FOR UPDATE', [process.env.APP_ACCESS_USER]) : { rows: [] }
    const envelope = token.rows[0]?.envelope || null
    const sha = checksum(primary.rows[0].data, envelope)
    const counts = Object.fromEntries(Object.entries(primary.rows[0].data).filter(([, value]) => Array.isArray(value)).map(([key, value]) => [key, value.length]))
    const migrationName = `owner_workspace_v1:${owner}`
    const previous = await client.query('SELECT source_sha256 FROM salesetu_migrations WHERE name = $1 FOR UPDATE', [migrationName])
    const destination = await client.query('SELECT data FROM salesetu_state WHERE id = $1 FOR UPDATE', [`workspace:${owner}`])
    const backupPath = path.resolve(backup)
    const repository = path.resolve(__dirname, '../..')
    if (backupPath === repository || backupPath.startsWith(repository + path.sep)) throw new Error('Backup must be outside the repository.')
    if (previous.rows[0]) {
      if (previous.rows[0].source_sha256 !== sha) throw new Error('Primary source changed after owner assignment; manual review required.')
      if (!destination.rows[0] || !fs.existsSync(backupPath)) throw new Error('Migration marker, workspace, or backup is missing; manual review required.')
      const saved = JSON.parse(fs.readFileSync(backupPath, 'utf8'))
      if (saved.owner !== owner || saved.sourceSha256 !== sha || checksum(saved.data, saved.tokenEnvelope) !== sha) throw new Error('Owner backup changed after assignment; manual review required.')
      await client.query('COMMIT')
      console.log(JSON.stringify({ mode: 'already-applied', sha256: sha, counts, gmailIncluded: Boolean(envelope) }))
      return
    }
    if (destination.rows[0]) throw new Error('Owner workspace already exists; no data was overwritten.')
    if (apply && !fs.existsSync(backupPath)) throw new Error('Run dry-run first and review its private backup before --apply.')
    if (fs.existsSync(backupPath)) {
      const saved = JSON.parse(fs.readFileSync(backupPath, 'utf8'))
      if (saved.sourceSha256 !== sha || saved.owner !== owner || checksum(saved.data, saved.tokenEnvelope) !== sha) throw new Error('Existing backup differs from current source or owner; no data was changed.')
    } else {
      fs.mkdirSync(path.dirname(backupPath), { recursive: true })
      fs.writeFileSync(backupPath, JSON.stringify({ owner, sourceSha256: sha, data: primary.rows[0].data, tokenEnvelope: envelope }), { flag: 'wx', mode: 0o600 })
    }
    console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', sha256: sha, counts, gmailIncluded: Boolean(envelope), backup: backupPath }))
    if (!apply) { await client.query('ROLLBACK'); return }
    await client.query('INSERT INTO salesetu_state(id, version, data) VALUES ($1, 1, $2::jsonb)', [`workspace:${owner}`, JSON.stringify(primary.rows[0].data)])
    if (envelope) {
      const updated = transferEnvelope(envelope, process.env.APP_ACCESS_USER, owner)
      const existingToken = await client.query('SELECT owner FROM salesetu_gmail_tokens WHERE owner = $1', [owner])
      if (existingToken.rows.length) throw new Error('Destination Gmail connection already exists; no data was changed.')
      await client.query('INSERT INTO salesetu_gmail_tokens(owner, envelope) VALUES ($1, $2)', [owner, updated])
    }
    await client.query('INSERT INTO salesetu_migrations(name, source_sha256) VALUES ($1, $2)', [migrationName, sha])
    await client.query('COMMIT')
    console.log('Owner workspace assigned once. Primary snapshot remains for coordinated rollback; no existing IDs changed.')
  } catch (error) { await client.query('ROLLBACK'); throw error }
  finally { await client.end() }
}
if (require.main === module) main().catch(error => { console.error(`Owner migration failed: ${typeof error.code === 'string' ? `database error (${error.code})` : error.message}`); process.exitCode = 1 })
module.exports = { main, checksum, transferEnvelope }
