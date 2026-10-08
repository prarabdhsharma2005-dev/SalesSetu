#!/usr/bin/env node
// Explicit, repeat-safe import. Never reads the default runtime store implicitly.
require('dotenv/config')
const fs = require('node:fs')
const path = require('node:path')
const { createHash, createDecipheriv, createCipheriv, randomBytes } = require('node:crypto')
const { Client } = require('pg')
const { ensureSchema } = require('./prepare-schema.cjs')

function option(name) {
  const index = process.argv.indexOf(name)
  return index < 0 ? null : process.argv[index + 1]
}

async function main() {
  const source = option('--source')
  const tokenFile = option('--gmail-token')
  const apply = process.argv.includes('--apply')
  if (!source || source.startsWith('--')) throw new Error('Specify an explicit --source path. Use --apply only after reviewing a dry run.')
  const bytes = fs.readFileSync(path.resolve(source))
  const data = JSON.parse(bytes.toString('utf8'))
  for (const key of ['leads', 'outreach', 'meetings', 'deals']) if (!Array.isArray(data?.[key])) throw new Error(`Source is missing the ${key} collection.`)
  for (const [key, value] of Object.entries(data)) if (['followUpSequences', 'meetingMoms', 'meetingTasks', 'meetingOutcomes', 'meetingDealApplications', 'meetingSequenceApplications'].includes(key) && !Array.isArray(value)) throw new Error(`Source ${key} is not a collection.`)
  const tokenBytes = tokenFile ? fs.readFileSync(path.resolve(tokenFile)) : null
  const digest = createHash('sha256').update(bytes).update(tokenBytes || '').digest('hex')
  const counts = Object.fromEntries(Object.entries(data).filter(([, value]) => Array.isArray(value)).map(([key, value]) => [key, value.length]))
  console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', sha256: digest, counts, encryptedGmailTokenIncluded: Boolean(tokenBytes) }))
  if (!apply) return
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required for --apply.')

  let envelope = null
  if (tokenBytes) {
    if (!process.env.APP_ACCESS_USER) throw new Error('APP_ACCESS_USER is required to migrate Gmail tokens.')
    const key = Buffer.from(process.env.GMAIL_TOKEN_ENCRYPTION_KEY || '', 'base64')
    if (key.length !== 32) throw new Error('A valid existing GMAIL_TOKEN_ENCRYPTION_KEY is required.')
    const stored = JSON.parse(tokenBytes.toString('utf8'))
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(stored.iv, 'base64'))
    decipher.setAuthTag(Buffer.from(stored.tag, 'base64'))
    const tokens = JSON.parse(Buffer.concat([decipher.update(Buffer.from(stored.ciphertext, 'base64')), decipher.final()]).toString('utf8'))
    if (!tokens.refreshToken || !tokens.senderEmail) throw new Error('Encrypted Gmail token record is incomplete.')
    tokens.owner = process.env.APP_ACCESS_USER
    const iv = randomBytes(12)
    const cipher = createCipheriv('aes-256-gcm', key, iv)
    const ciphertext = Buffer.concat([cipher.update(JSON.stringify(tokens), 'utf8'), cipher.final()])
    envelope = JSON.stringify({ iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), ciphertext: ciphertext.toString('base64') })
  }

  const client = new Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 10_000 })
  await client.connect()
  try {
    await client.query('BEGIN')
    await ensureSchema(client)
    const prior = await client.query('SELECT source_sha256 FROM salesetu_migrations WHERE name = $1 FOR UPDATE', ['local_snapshot_v1'])
    if (prior.rows[0]) {
      if (prior.rows[0].source_sha256 !== digest) throw new Error('A different local snapshot was already imported. Existing PostgreSQL data was not changed.')
      await client.query('COMMIT')
      console.log('Already imported: exact source checksum matches; no records changed.')
      return
    }
    const existing = await client.query('SELECT id FROM salesetu_state WHERE id = $1 FOR UPDATE', ['primary'])
    if (existing.rows.length) throw new Error('PostgreSQL already contains SalesSetu data. Import refused to overwrite it.')
    await client.query('INSERT INTO salesetu_state(id, version, data) VALUES ($1, 1, $2::jsonb)', ['primary', JSON.stringify(data)])
    if (envelope) {
      const tokenExisting = await client.query('SELECT owner FROM salesetu_gmail_tokens WHERE owner = $1', [process.env.APP_ACCESS_USER])
      if (tokenExisting.rows.length) throw new Error('PostgreSQL already has a Gmail connection for this operator; import refused.')
      await client.query('INSERT INTO salesetu_gmail_tokens(owner, envelope) VALUES ($1, $2)', [process.env.APP_ACCESS_USER, envelope])
    }
    await client.query('INSERT INTO salesetu_migrations(name, source_sha256) VALUES ($1, $2)', ['local_snapshot_v1', digest])
    await client.query('COMMIT')
    console.log('Import committed once. Preserve the source backup and verify application reads before switching traffic.')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally { await client.end() }
}

if (require.main === module) main().catch(error => {
  const message = typeof error.code === 'string' ? `Database operation failed (${error.code}).` : error.message
  console.error(`Migration failed: ${message}`)
  process.exitCode = 1
})
module.exports = { main }
