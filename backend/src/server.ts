import 'dotenv/config'

import express, { type ErrorRequestHandler } from 'express'
import cors from 'cors'
import { aiRouter } from './routes/ai.routes'
import { leadsRouter } from './routes/leads.routes'
import { pipelineRouter } from './routes/pipeline.routes'
import { sheetsRouter } from './routes/sheets.routes'
import { GoogleSheetsService } from './services/sheets.service'
import { startFollowUpScheduler, type FollowUpSchedulerHandle } from './services/follow-up-scheduler.service'
import { prepareProductionStore, requireAppAccess } from './services/runtime-config.service'

const app = express()
const PORT = process.env.PORT || 5000
const releaseStore = prepareProductionStore()
process.once('exit', releaseStore)

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
app.get('/health', (_req, res) => {
  res.json({
    status: 'healthy',
    service: 'SalesSetu Backend API',
    timestamp: new Date().toISOString(),
    geminiConfigured: !!process.env.GEMINI_API_KEY,
    storage: { mode: 'DURABLE_JSON_WITH_OPTIONAL_SHEETS_SYNC' },
  })
})

// API Routes
app.use('/api', requireAppAccess)
// Express 4 does not forward rejected async route promises to error middleware.
for (const router of [aiRouter, leadsRouter, pipelineRouter, sheetsRouter]) {
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
const safeError: ErrorRequestHandler = (_error, _req, res, _next) => { res.status(500).json({ error: 'Operation failed. Stored data has not been reset.' }) }
app.use(safeError)

let followUpScheduler: FollowUpSchedulerHandle | undefined
const httpServer = app.listen(PORT, () => {
  console.log(`[SalesSetu API] Server running on http://localhost:${PORT}`)
  console.log(`[SalesSetu Storage] Primary Store: Google Sheets (Mode: ${GoogleSheetsService.getStatus().mode})`)
  if (process.env.FOLLOW_UP_SCHEDULER_ENABLED?.trim().toLowerCase() === 'true') {
    followUpScheduler = startFollowUpScheduler()
  } else {
    console.log('[FollowUpScheduler] Disabled; set FOLLOW_UP_SCHEDULER_ENABLED=true to enable it.')
  }
})

let shutdownTask: Promise<void> | null = null
const shutdown = (signal: NodeJS.Signals) => {
  if (shutdownTask) return
  console.log(`[SalesSetu API] ${signal} received; stopping background work.`)
  shutdownTask = (async () => {
    await followUpScheduler?.stop()
    await new Promise<void>(resolve => {
      const timeout = setTimeout(() => {
        console.warn('[SalesSetu API] Graceful HTTP shutdown timed out; closing remaining connections.')
        httpServer.closeAllConnections()
      }, 15_000)
      timeout.unref()
      httpServer.close(error => {
        clearTimeout(timeout)
        if (error) {
          console.error('[SalesSetu API] HTTP shutdown failed:', error.message)
          process.exitCode = 1
        }
        resolve()
      })
    })
  })()
}

process.once('SIGINT', () => shutdown('SIGINT'))
process.once('SIGTERM', () => shutdown('SIGTERM'))
