import fs from 'node:fs'
import path from 'node:path'
import { Router } from 'express'
import { deletePostgresWorkspace, usesPostgres } from '../services/postgres-store.service'
import { currentWorkspace, workspaceMode, workspaceStorageKey } from '../services/workspace-context.service'
import { GmailService } from '../services/gmail.service'

export const accountRouter = Router()

accountRouter.delete('/', async (_req, res) => {
  const id = currentWorkspace()
  if (!workspaceMode() || !id) return res.status(404).json({ error: 'Workspace account operation unavailable.' })
  try {
    if (usesPostgres()) await deletePostgresWorkspace(id)
    else {
      const base = path.resolve(process.env.DATA_DIR || path.join(__dirname, '../../data'), 'workspaces')
      const directory = path.resolve(base, workspaceStorageKey(id))
      if (path.dirname(directory) !== base) throw new Error('Invalid workspace storage path.')
      fs.rmSync(directory, { recursive: true, force: true })
    }
    GmailService.clearPendingStatesForWorkspace(id)
    return res.json({ deleted: true })
  } catch { return res.status(503).json({ error: 'Workspace deletion did not complete. No other account was affected.' }) }
})
