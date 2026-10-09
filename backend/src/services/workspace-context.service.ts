import { AsyncLocalStorage } from 'node:async_hooks'
import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import type { RequestHandler } from 'express'

const context = new AsyncLocalStorage<string>()
export const workspaceMode = (env = process.env) => env.GOOGLE_WORKSPACES_ENABLED === 'true'
export const currentWorkspace = () => context.getStore() || null
export const runInWorkspace = <T>(id: string, task: () => T): T => context.run(id, task)
export const workspaceStorageKey = (id: string) => createHash('sha256').update(`salesetu-workspace:${id}`).digest('hex')

/** The service assertion is generated only by the authenticated Next.js server. */
export const requireWorkspace: RequestHandler = (req, res, next) => {
  if (!workspaceMode()) return req.header('x-salesetu-workspace')
    ? res.status(503).json({ error: 'Workspace mode is not configured on the backend.' })
    : next()
  const secret = process.env.INTERNAL_PROXY_SECRET || ''
  const id = req.header('x-salesetu-workspace') || ''
  const timestamp = req.header('x-salesetu-timestamp') || ''
  const signature = req.header('x-salesetu-signature') || ''
  const time = Number(timestamp)
  if (secret.length < 32 || !/^\d{10,32}$/.test(id) || !/^\d{13}$/.test(timestamp) || !Number.isSafeInteger(time) || Math.abs(Date.now() - time) > 30_000 || !/^[a-f0-9]{64}$/.test(signature)) {
    return res.status(401).json({ error: 'Authenticated workspace is required.' })
  }
  const message = `v1\n${timestamp}\n${id}\n${req.method}\n${req.originalUrl}`
  const expected = createHmac('sha256', secret).update(message).digest()
  const supplied = Buffer.from(signature, 'hex')
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return res.status(401).json({ error: 'Authenticated workspace is required.' })
  return runInWorkspace(id, () => next())
}
