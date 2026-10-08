#!/usr/bin/env node
require('dotenv/config')
const fs = require('node:fs')
const path = require('node:path')
const { Client } = require('pg')

const tables = {
  salesetu_state: { id: 'text', version: 'bigint', data: 'jsonb', updated_at: 'timestamp with time zone' },
  salesetu_gmail_tokens: { owner: 'text', envelope: 'text', updated_at: 'timestamp with time zone' },
  salesetu_oauth_states: { digest: 'text', owner: 'text', expires_at: 'timestamp with time zone' },
  salesetu_scheduler_lease: { name: 'text', owner: 'text', expires_at: 'timestamp with time zone' },
  salesetu_migrations: { name: 'text', source_sha256: 'text', applied_at: 'timestamp with time zone' },
}
const primaryKeys = {
  salesetu_state: 'id', salesetu_gmail_tokens: 'owner', salesetu_oauth_states: 'digest',
  salesetu_scheduler_lease: 'name', salesetu_migrations: 'name',
}

/** Run inside a transaction; refuse partial or incompatible existing schemas. */
async function ensureSchema(client) {
  await client.query("SELECT pg_advisory_xact_lock(hashtext('salesetu_schema_v1'))")
  const names = Object.keys(tables)
  const relations = await client.query(
    'SELECT c.relname, c.relkind FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = current_schema() AND c.relname = ANY($1::text[])',
    [names],
  )
  if (relations.rows.length && relations.rows.length !== names.length) throw new Error('Partial SalesSetu schema exists; inspect it before migration.')
  if (relations.rows.some(row => row.relkind !== 'r' && row.relkind !== 'p')) throw new Error('A SalesSetu table name is occupied by a different relation type.')
  const created = relations.rows.length === 0
  if (created) await client.query(fs.readFileSync(path.join(__dirname, '../db/schema.sql'), 'utf8'))

  const columns = await client.query(
    'SELECT table_name, column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = ANY($1::text[])',
    [names],
  )
  for (const name of names) {
    const actual = columns.rows.filter(row => row.table_name === name)
    const expected = tables[name]
    if (actual.length !== Object.keys(expected).length || actual.some(row => expected[row.column_name] !== row.data_type || row.is_nullable !== 'NO')) {
      throw new Error(`SalesSetu schema conflict in ${name}; no migration was applied.`)
    }
    for (const defaulted of ['version', 'updated_at', 'applied_at']) {
      if (defaulted in expected && !actual.find(row => row.column_name === defaulted)?.column_default) throw new Error(`SalesSetu schema conflict in ${name}; a required default is absent.`)
    }
  }
  const keys = await client.query(
    "SELECT tc.table_name, kcu.column_name FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu ON kcu.constraint_name = tc.constraint_name AND kcu.constraint_schema = tc.constraint_schema WHERE tc.table_schema = current_schema() AND tc.constraint_type = 'PRIMARY KEY' AND tc.table_name = ANY($1::text[])",
    [names],
  )
  for (const name of names) if (keys.rows.filter(row => row.table_name === name).length !== 1 || !keys.rows.some(row => row.table_name === name && row.column_name === primaryKeys[name])) {
    throw new Error(`SalesSetu schema conflict in ${name}; primary key differs.`)
  }
  const indexes = await client.query("SELECT indexname FROM pg_indexes WHERE schemaname = current_schema() AND tablename = 'salesetu_oauth_states'")
  if (!indexes.rows.some(row => row.indexname === 'salesetu_oauth_states_expires_idx')) throw new Error('SalesSetu OAuth expiry index is missing.')
  return created ? 'created' : 'verified'
}

async function main() {
  if (!process.env.DATABASE_URL?.trim()) throw new Error('DATABASE_URL is required to prepare the schema.')
  const client = new Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 10_000 })
  await client.connect()
  try {
    await client.query('BEGIN')
    const result = await ensureSchema(client)
    await client.query('COMMIT')
    console.log(`SalesSetu schema ${result}; no application records imported.`)
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally { await client.end() }
}

if (require.main === module) main().catch(error => {
  console.error(`Schema preparation failed: ${typeof error.code === 'string' ? `database error (${error.code})` : error.message}`)
  process.exitCode = 1
})
module.exports = { ensureSchema, main }
