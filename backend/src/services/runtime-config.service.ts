import { timingSafeEqual } from 'crypto'
import fs from 'fs'
import path from 'path'
import type { RequestHandler } from 'express'

export function validateProductionConfig(env = process.env) {
  if (env.NODE_ENV !== 'production') return
  if (!env.GEMINI_API_KEY || !env.TAVILY_API_KEY) throw new Error('Production requires real Gemini and Tavily configuration; demo providers are not enabled.')
  if (!env.APP_ACCESS_USER || !env.APP_ACCESS_PASSWORD || env.APP_ACCESS_PASSWORD.length < 24 || env.APP_ACCESS_USER.includes(':')) throw new Error('Production requires APP_ACCESS_USER and APP_ACCESS_PASSWORD (24+ characters).')
  if (!env.DATABASE_URL?.trim()) throw new Error('Production requires DATABASE_URL for durable PostgreSQL storage.')
  if (!env.FRONTEND_URL || new URL(env.FRONTEND_URL).protocol !== 'https:') throw new Error('Production requires an HTTPS FRONTEND_URL.')
  if (env.FOLLOW_UP_SCHEDULER_ENABLED === 'true' && (!env.CRON_SECRET || env.CRON_SECRET.length < 32)) throw new Error('Enabled scheduled processing requires CRON_SECRET (32+ characters).')
}

/** Single-operator access protection; CORS is never used as authentication. */
export const requireAppAccess: RequestHandler = (req, res, next) => {
  const user = process.env.APP_ACCESS_USER
  const password = process.env.APP_ACCESS_PASSWORD
  if (process.env.NODE_ENV !== 'production' && !user && !password) return next()
  if (!user || !password || password.length < 24) return res.status(503).json({ error: 'Application access is not configured.' })
  const expected = Buffer.from(`Basic ${Buffer.from(`${user}:${password}`).toString('base64')}`)
  const supplied = Buffer.from(req.headers.authorization || '')
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return res.status(401).set('WWW-Authenticate', 'Basic realm="SalesSetu", charset="UTF-8"').json({ error: 'Authentication required.' })
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.headers.origin && req.headers.origin !== process.env.FRONTEND_URL?.replace(/\/$/, '')) return res.status(403).json({ error: 'Request origin is not allowed.' })
  res.set('Cache-Control', 'private, no-store')
  next()
}

/** One OS process owns this durable store. Stale crash locks are recovered on the same host. */
export function acquireStoreLock(directory: string): () => void {
  const lockPath = path.join(directory, '.salessetu.lock')
  try { fs.writeFileSync(lockPath, String(process.pid), { flag: 'wx', mode: 0o600 }) }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
    const owner = Number(fs.readFileSync(lockPath, 'utf8'))
    if (!Number.isInteger(owner) || owner <= 0) throw new Error('Invalid store lock; operator inspection required.')
    try { process.kill(owner, 0); throw new Error('Another process owns the store. Stop it before starting this backend.') }
    catch (probe) {
      if ((probe as NodeJS.ErrnoException).code !== 'ESRCH') throw probe
      fs.unlinkSync(lockPath)
      fs.writeFileSync(lockPath, String(process.pid), { flag: 'wx', mode: 0o600 })
    }
  }
  return () => { if (fs.existsSync(lockPath) && fs.readFileSync(lockPath, 'utf8') === String(process.pid)) fs.unlinkSync(lockPath) }
}

export function prepareProductionStore(env = process.env) {
  validateProductionConfig(env)
  if (env.DATABASE_URL?.trim() || env.NODE_ENV !== 'production') return () => undefined
  const directory = env.DATA_DIR!
  const data = JSON.parse(fs.readFileSync(path.join(directory, 'sheets_store.json'), 'utf8'))
  for (const key of ['leads', 'outreach', 'meetings', 'deals']) if (!Array.isArray(data[key])) throw new Error('Production store must contain the existing core record collections.')
  return acquireStoreLock(directory)
}
