import 'dotenv/config'
import app from './app'
import { GoogleSheetsService } from './services/sheets.service'
import { startFollowUpScheduler, type FollowUpSchedulerHandle } from './services/follow-up-scheduler.service'
import { prepareProductionStore } from './services/runtime-config.service'

const PORT = process.env.PORT || 5000
const releaseStore = prepareProductionStore()
process.once('exit', releaseStore)

let followUpScheduler: FollowUpSchedulerHandle | undefined
const httpServer = app.listen(PORT, () => {
  console.log(`[SalesSetu API] Server running on http://localhost:${PORT}`)
  console.log(`[SalesSetu Storage] Primary Store: ${GoogleSheetsService.getStatus().mode}`)
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
