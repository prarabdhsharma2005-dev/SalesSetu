#!/usr/bin/env node
require('dotenv/config')
const fs = require('node:fs')
const path = require('node:path')
const { Client } = require('pg')

async function main() {
  if (!process.env.DATABASE_URL?.trim()) throw new Error('DATABASE_URL is required.')
  const client = new Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 10000 })
  await client.connect()
  try {
    await client.query('BEGIN')
    await client.query("SELECT pg_advisory_xact_lock(hashtext('salesetu_workspace_schema_v1'))")
    const existing = await client.query("SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'salesetu_workspace_usage'")
    if (existing.rows.length) {
      const expected = { workspace: 'text', action: 'text', window_start: 'timestamp with time zone', count: 'integer' }
      if (existing.rows.length !== 4 || existing.rows.some(row => expected[row.column_name] !== row.data_type || row.is_nullable !== 'NO')) throw new Error('Conflicting workspace usage table; no change made.')
    } else await client.query(fs.readFileSync(path.join(__dirname, '../db/workspace-schema.sql'), 'utf8'))
    await client.query('COMMIT')
    console.log('Workspace quota schema ready; no application records changed.')
  } catch (error) { await client.query('ROLLBACK'); throw error }
  finally { await client.end() }
}
if (require.main === module) main().catch(error => { console.error(`Workspace schema preparation failed: ${typeof error.code === 'string' ? `database error (${error.code})` : error.message}`); process.exitCode = 1 })
