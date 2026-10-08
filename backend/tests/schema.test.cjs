const test = require('node:test')
const assert = require('node:assert/strict')
const { ensureSchema } = require('../scripts/prepare-schema.cjs')

const definitions = {
  salesetu_state: { id: 'text', version: 'bigint', data: 'jsonb', updated_at: 'timestamp with time zone' },
  salesetu_gmail_tokens: { owner: 'text', envelope: 'text', updated_at: 'timestamp with time zone' },
  salesetu_oauth_states: { digest: 'text', owner: 'text', expires_at: 'timestamp with time zone' },
  salesetu_scheduler_lease: { name: 'text', owner: 'text', expires_at: 'timestamp with time zone' },
  salesetu_migrations: { name: 'text', source_sha256: 'text', applied_at: 'timestamp with time zone' },
}
const keys = { salesetu_state: 'id', salesetu_gmail_tokens: 'owner', salesetu_oauth_states: 'digest', salesetu_scheduler_lease: 'name', salesetu_migrations: 'name' }

function client(existing, incompatible = false) {
  const statements = []
  return {
    statements,
    async query(sql) {
      statements.push(sql)
      if (sql.startsWith('SELECT c.relname')) return { rows: existing.map(relname => ({ relname, relkind: 'r' })) }
      if (sql.startsWith('SELECT table_name, column_name')) return { rows: Object.entries(definitions).flatMap(([table_name, columns]) => Object.entries(columns).map(([column_name, data_type]) => ({ table_name, column_name, data_type: incompatible && table_name === 'salesetu_state' && column_name === 'data' ? 'text' : data_type, is_nullable: 'NO', column_default: ['version', 'updated_at', 'applied_at'].includes(column_name) ? 'expected default' : null }))) }
      if (sql.startsWith('SELECT tc.table_name')) return { rows: Object.entries(keys).map(([table_name, column_name]) => ({ table_name, column_name })) }
      if (sql.startsWith('SELECT indexname')) return { rows: [{ indexname: 'salesetu_oauth_states_expires_idx' }] }
      return { rows: [] }
    },
  }
}

test('schema preparation creates empty schema once and verifies a complete repeat', async () => {
  const empty = client([])
  assert.equal(await ensureSchema(empty), 'created')
  assert.ok(empty.statements.some(sql => sql.includes('CREATE TABLE IF NOT EXISTS salesetu_state')))
  const complete = client(Object.keys(definitions))
  assert.equal(await ensureSchema(complete), 'verified')
  assert.ok(!complete.statements.some(sql => sql.includes('CREATE TABLE IF NOT EXISTS')))
})

test('schema preparation refuses partial or incompatible existing tables', async () => {
  await assert.rejects(ensureSchema(client(['salesetu_state'])), /Partial SalesSetu schema/)
  await assert.rejects(ensureSchema(client(Object.keys(definitions), true)), /schema conflict/)
})
