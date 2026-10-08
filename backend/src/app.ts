import 'dotenv/config'

import express, { type ErrorRequestHandler } from 'express'
import cors from 'cors'
import { timingSafeEqual } from 'crypto'
import { aiRouter } from './routes/ai.routes'
import { leadsRouter } from './routes/leads.routes'
import { pipelineRouter } from './routes/pipeline.routes'
import { sheetsRouter } from './routes/sheets.routes'
import { gmailOAuthCallback, gmailRouter } from './routes/gmail.routes'
import { GoogleSheetsService } from './services/sheets.service'
import { validateProductionConfig, requireAppAccess } from './services/runtime-config.service'
import { readPostgresSnapshot, usesPostgres, withPostgresSchedulerLease } from './services/postgres-store.service'
import { processDueFollowUps } from './services/follow-up-automation.service'

const app = express()
validateProductionConfig()

const allowedOrigin = process.env.FRONTEND_URL ? process.env.FRONTEND_URL.replace(/\/$/, '') : 'http://localhost:3000'

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true)
    if (
      origin === allowedOrigin ||
      process.env.NODE_ENV !== 'production'
    ) {
      return callback(null, true)
    }
    return callback(null, false)
  },
  credentials: true,
}))
app.use(express.json())

// Root welcome endpoint
app.get('/', (_req, res) => {
  res.json({
    name: 'SalesSetu Backend API',
    status: 'online',
    frontend: process.env.FRONTEND_URL || 'http://localhost:3000',
    endpoints: {
      health: '/health',
      leads: '/api/leads',
      pipeline: '/api/pipeline',
      ai: '/api/ai',
      sheets: '/api/sheets',
    },
  })
})

// Health check
app.get('/health', async (_req, res) => {
  if (usesPostgres()) {
    try { await readPostgresSnapshot() }
    catch { return res.status(503).json({ status: 'unavailable', service: 'SalesSetu Backend API' }) }
  }
  res.json({
    status: 'healthy',
    service: 'SalesSetu Backend API',
    timestamp: new Date().toISOString(),
    geminiConfigured: !!process.env.GEMINI_API_KEY,
    storage: { mode: GoogleSheetsService.getStatus().mode },
  })
})

// API Routes
app.get('/api/gmail/oauth/callback', gmailOAuthCallback)
app.get('/api/cron/follow-ups', async (req, res) => {
  const secret = process.env.CRON_SECRET
  const supplied = req.headers.authorization || ''
  const expected = secret ? `Bearer ${secret}` : ''
  const authorized = Boolean(secret && secret.length >= 32 && supplied.length === expected.length && timingSafeEqual(Buffer.from(supplied), Buffer.from(expected)))
  if (!authorized) return res.status(401).json({ error: 'Scheduled processing is not authorized.' })
  if (process.env.FOLLOW_UP_SCHEDULER_ENABLED !== 'true') return res.status(503).json({ error: 'Scheduled processing is disabled.' })
  try {
    const result = usesPostgres() ? await withPostgresSchedulerLease(() => processDueFollowUps()) : await processDueFollowUps()
    return result ? res.json(result) : res.status(409).json({ error: 'Scheduled processing is already running.' })
  } catch { return res.status(500).json({ error: 'Scheduled processing failed; inspect saved drafts before retrying.' }) }
})
app.use('/api', requireAppAccess)
// Express 4 does not forward rejected async route promises to error middleware.
for (const router of [aiRouter, leadsRouter, pipelineRouter, sheetsRouter, gmailRouter]) {
  for (const layer of router.stack) for (const handler of layer.route?.stack || []) {
    const original = handler.handle
    handler.handle = (req: express.Request, res: express.Response, next: express.NextFunction) => {
      try { Promise.resolve(original(req, res, next)).catch(next) } catch (error) { next(error) }
    }
  }
}
app.use('/api/ai', aiRouter)
app.use('/api/leads', leadsRouter)
app.use('/api/pipeline', pipelineRouter)
app.use('/api/sheets', sheetsRouter)
app.use('/api/gmail', gmailRouter)
const safeError: ErrorRequestHandler = (_error, _req, res, _next) => { res.status(500).json({ error: 'Operation failed. Stored data has not been reset.' }) }
app.use(safeError)


export default app
