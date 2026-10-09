import fs from 'node:fs'
import path from 'node:path'
import type { RequestHandler } from 'express'
import { database, usesPostgres } from './postgres-store.service'
import { currentWorkspace, workspaceStorageKey } from './workspace-context.service'

type Action = 'discovery' | 'ai' | 'send'
const limits: Record<Action, { env: string; fallback: number }> = {
  discovery: { env: 'WORKSPACE_DISCOVERY_DAILY_LIMIT', fallback: 40 },
  ai: { env: 'WORKSPACE_AI_DAILY_LIMIT', fallback: 20 },
  send: { env: 'WORKSPACE_SEND_DAILY_LIMIT', fallback: 10 },
}

function actionFor(method: string, pathName: string, hasSearchFilters: boolean): Action | null {
  if (method === 'POST' && /^\/api\/gmail\/(outreach\/[^/]+\/send|follow-up-sequences\/[^/]+\/steps\/\d+\/send)$/.test(pathName)) return 'send'
  if (method === 'POST' && (/^\/api\/ai\//.test(pathName) || /^\/api\/leads\/[^/]+\/qualify$/.test(pathName) || pathName === '/api/sheets/outreach')) return 'ai'
  if (method === 'GET' && (/^\/api\/leads\/[^/]+\/(pocs|research)$/.test(pathName) || (pathName === '/api/leads' && hasSearchFilters))) return 'discovery'
  return null
}

async function claim(workspace: string, action: Action, limit: number, day: string): Promise<boolean> {
  if (usesPostgres()) {
    const result = await database().query(
      'INSERT INTO salesetu_workspace_usage(workspace, action, window_start, count) VALUES ($1, $2, $3::timestamptz, 1) ON CONFLICT (workspace, action, window_start) DO UPDATE SET count = salesetu_workspace_usage.count + 1 WHERE salesetu_workspace_usage.count < $4 RETURNING count',
      [workspace, action, day, limit],
    )
    return result.rowCount === 1
  }
  // Local JSON mode is a single-process development store; persist counters beside its workspace file.
  const directory = path.join(process.env.DATA_DIR || path.join(__dirname, '../../data'), 'workspaces', workspaceStorageKey(workspace))
  fs.mkdirSync(directory, { recursive: true })
  const file = path.join(directory, 'usage.json')
  const state = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, number> : {}
  const key = `${action}:${day}`
  if ((state[key] || 0) >= limit) return false
  state[key] = (state[key] || 0) + 1
  const temporary = `${file}.${process.pid}.tmp`
  fs.writeFileSync(temporary, JSON.stringify(state), { mode: 0o600 })
  fs.renameSync(temporary, file)
  return true
}

export const enforceWorkspaceQuota: RequestHandler = (req, res, next) => {
  const workspace = currentWorkspace()
  if (!workspace) return next()
  const url = new URL(req.originalUrl, 'http://localhost')
  const normalizedPath = url.pathname.toLowerCase().replace(/\/+$/, '') || '/'
  const hasSearchFilters = ['query', 'industry', 'city', 'intent', 'minScore'].some(key => Boolean(url.searchParams.get(key)))
  const action = actionFor(req.method, normalizedPath, hasSearchFilters)
  if (!action) return next()
  const setting = limits[action]
  const parsed = Number(process.env[setting.env] || setting.fallback)
  const limit = Number.isSafeInteger(parsed) && parsed >= 1 ? parsed : setting.fallback
  const now = Date.now()
  const day = new Date(now).toISOString().slice(0, 10) + 'T00:00:00.000Z'
  claim(workspace, action, limit, day).then(allowed => {
    res.set('X-RateLimit-Limit', String(limit))
    if (!allowed) {
      res.set('Retry-After', String(Math.ceil((Date.parse(day) + 86_400_000 - now) / 1000)))
      return res.status(429).json({ code: 'WORKSPACE_QUOTA_EXCEEDED', error: `Daily ${action} limit reached. Try again after the UTC day resets.` })
    }
    next()
  }).catch(() => res.status(503).json({ error: 'Workspace usage control is unavailable. No provider request was made.' }))
}
