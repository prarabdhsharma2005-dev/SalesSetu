import { Pool } from 'pg'
import { randomUUID } from 'crypto'
import { MeetingWorkflowConflictError } from './meeting-workflow.service'

const version = Symbol('salesetu-store-version')
type Snapshot = Record<string, unknown> & { [version]?: number }
let pool: Pool | undefined

export function usesPostgres(env = process.env) { return Boolean(env.DATABASE_URL?.trim()) }

export function database() {
  if (!process.env.DATABASE_URL?.trim()) throw new Error('DATABASE_URL is required for PostgreSQL storage.')
  pool ||= new Pool({ connectionString: process.env.DATABASE_URL, max: 2, connectionTimeoutMillis: 10_000, idleTimeoutMillis: 10_000 })
  return pool
}

function validateCollections(data: unknown): asserts data is Record<string, unknown> {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('SalesSetu PostgreSQL store is invalid.')
  for (const key of ['leads', 'outreach', 'meetings', 'deals']) {
    if (!Array.isArray((data as Record<string, unknown>)[key])) throw new Error(`SalesSetu PostgreSQL store lacks ${key}.`)
  }
}

/** The single JSONB snapshot preserves every existing collection and unknown future fields. */
export async function readPostgresSnapshot(): Promise<Snapshot> {
  const result = await database().query<{ version: string; data: Snapshot }>('SELECT version, data FROM salesetu_state WHERE id = $1', ['primary'])
  if (!result.rows[0]) throw new Error('PostgreSQL store has not been migrated. Run the explicit local-data migration before starting production.')
  const data = result.rows[0].data
  validateCollections(data)
  Object.defineProperty(data, version, { value: Number(result.rows[0].version), enumerable: false })
  return data
}

/** Row lock plus expected version: concurrent writers cannot overwrite each other's collections. */
export async function writePostgresSnapshot(data: Snapshot): Promise<void> {
  const expected = data[version]
  if (!Number.isSafeInteger(expected)) throw new Error('PostgreSQL store write requires a prior versioned read.')
  validateCollections(data)
  const client = await database().connect()
  try {
    await client.query('BEGIN')
    const current = await client.query<{ version: string }>('SELECT version FROM salesetu_state WHERE id = $1 FOR UPDATE', ['primary'])
    if (!current.rows[0] || Number(current.rows[0].version) !== expected) throw new MeetingWorkflowConflictError('Stored data changed concurrently. Reload and retry; no update was applied.')
    await client.query('UPDATE salesetu_state SET data = $1::jsonb, version = version + 1, updated_at = now() WHERE id = $2', [JSON.stringify(data), 'primary'])
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally { client.release() }
}

export async function readEncryptedGmailToken(owner: string) {
  const result = await database().query<{ envelope: string }>('SELECT envelope FROM salesetu_gmail_tokens WHERE owner = $1', [owner])
  return result.rows[0]?.envelope || null
}

export async function writeEncryptedGmailToken(owner: string, envelope: string) {
  await database().query('INSERT INTO salesetu_gmail_tokens(owner, envelope) VALUES ($1, $2) ON CONFLICT (owner) DO UPDATE SET envelope = EXCLUDED.envelope, updated_at = now()', [owner, envelope])
}

export async function deleteEncryptedGmailToken(owner: string) {
  await database().query('DELETE FROM salesetu_gmail_tokens WHERE owner = $1', [owner])
}

export async function saveOAuthState(digest: string, owner: string, expiresAt: Date) {
  await database().query('INSERT INTO salesetu_oauth_states(digest, owner, expires_at) VALUES ($1, $2, $3)', [digest, owner, expiresAt])
}

export async function consumeOAuthState(digest: string, owner: string) {
  const result = await database().query('DELETE FROM salesetu_oauth_states WHERE digest = $1 AND owner = $2 AND expires_at > now() RETURNING digest', [digest, owner])
  return result.rowCount === 1
}

/** Time-bounded database lease prevents overlapping Vercel cron invocations. */
export async function withPostgresSchedulerLease<T>(task: () => Promise<T>): Promise<T | null> {
  const owner = randomUUID()
  const acquired = await database().query(
    "INSERT INTO salesetu_scheduler_lease(name, owner, expires_at) VALUES ('follow-ups', $1, now() + interval '3 minutes') ON CONFLICT (name) DO UPDATE SET owner = EXCLUDED.owner, expires_at = EXCLUDED.expires_at WHERE salesetu_scheduler_lease.expires_at < now() RETURNING owner",
    [owner],
  )
  if (acquired.rowCount !== 1) return null
  try {
    return await task()
  } finally {
    await database().query("DELETE FROM salesetu_scheduler_lease WHERE name = 'follow-ups' AND owner = $1", [owner])
  }
}
