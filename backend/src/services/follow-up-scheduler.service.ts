import { processDueFollowUps, type FollowUpProcessingResult } from './follow-up-automation.service'

export const DEFAULT_FOLLOW_UP_SCHEDULER_INTERVAL_MS = 60 * 60 * 1000
const DEFAULT_SHUTDOWN_WAIT_MS = 30 * 1000
const MAX_TIMER_DELAY_MS = 2_147_483_647

type TimerHandle = ReturnType<typeof setInterval>
type SchedulerLogger = Pick<Console, 'info' | 'warn' | 'error'>

export interface FollowUpSchedulerOptions {
  enabled?: boolean
  intervalMs?: number
  shutdownWaitMs?: number
  env?: Record<string, string | undefined>
  processDueFollowUps?: () => Promise<FollowUpProcessingResult>
  setInterval?: (callback: () => void, intervalMs: number) => TimerHandle
  clearInterval?: (timer: TimerHandle) => void
  setTimeout?: typeof setTimeout
  clearTimeout?: typeof clearTimeout
  logger?: SchedulerLogger
}

export interface FollowUpSchedulerHandle {
  readonly enabled: boolean
  readonly intervalMs: number
  stop(): Promise<void>
}

function parseInterval(value: string | undefined, fallback: number, logger: SchedulerLogger): number {
  if (value === undefined || value.trim() === '') return fallback
  const parsed = Number(value)
  if (Number.isSafeInteger(parsed) && parsed > 0 && parsed <= MAX_TIMER_DELAY_MS) return parsed
  logger.warn(`[FollowUpScheduler] Invalid interval configuration; using ${fallback}ms.`)
  return fallback
}

function errorSummary(error: unknown, env: Record<string, string | undefined>): string {
  const name = error instanceof Error ? error.name : 'UNKNOWN_ERROR'
  let message = error instanceof Error ? error.message : String(error)
  for (const secret of [env.GEMINI_API_KEY, env.TAVILY_API_KEY]) {
    if (secret) message = message.split(secret).join('[REDACTED]')
  }
  message = message
    .replace(/Bearer\s+[^\s,;]+/gi, 'Bearer [REDACTED]')
    .replace(/([?&](?:key|token|api_key)=)[^&\s]+/gi, '$1[REDACTED]')
    .slice(0, 300)
  return `${name}: ${message || 'No error message.'}`
}

/**
 * Starts a process-local polling loop. Enable it explicitly with
 * FOLLOW_UP_SCHEDULER_ENABLED=true and run it on only one backend instance.
 * The JSON store and this in-memory guard do not provide cross-process claims.
 */
export function startFollowUpScheduler(options: FollowUpSchedulerOptions = {}): FollowUpSchedulerHandle {
  const env = options.env || process.env
  const logger = options.logger || console
  const enabled = options.enabled ?? env.FOLLOW_UP_SCHEDULER_ENABLED?.trim().toLowerCase() === 'true'
  const intervalMs = options.intervalMs !== undefined
    ? parseInterval(String(options.intervalMs), DEFAULT_FOLLOW_UP_SCHEDULER_INTERVAL_MS, logger)
    : parseInterval(env.FOLLOW_UP_SCHEDULER_INTERVAL_MS, DEFAULT_FOLLOW_UP_SCHEDULER_INTERVAL_MS, logger)

  if (!enabled) {
    logger.info('[FollowUpScheduler] Disabled; set FOLLOW_UP_SCHEDULER_ENABLED=true to enable it.')
    return { enabled: false, intervalMs, stop: async () => undefined }
  }

  const runProcessor = options.processDueFollowUps || processDueFollowUps
  const scheduleInterval = options.setInterval || setInterval
  const cancelInterval = options.clearInterval || clearInterval
  const scheduleTimeout = options.setTimeout || setTimeout
  const cancelTimeout = options.clearTimeout || clearTimeout
  const shutdownWaitMs = options.shutdownWaitMs ?? DEFAULT_SHUTDOWN_WAIT_MS
  let stopping = false
  let running = false
  let inFlight: Promise<void> | null = null
  let stopped = false

  const tick = (): Promise<void> => {
    if (stopping) return Promise.resolve()
    if (running) {
      logger.warn('[FollowUpScheduler] Overlapping tick skipped; previous tick is still running.')
      return Promise.resolve()
    }

    running = true
    logger.info('[FollowUpScheduler] Tick started.')
    const current = (async () => {
      try {
        const result = await runProcessor()
        logger.info(`[FollowUpScheduler] Tick completed: processed=${result.processed} skipped=${result.skipped} errors=${result.errors}.`)
      } catch (error) {
        logger.error(`[FollowUpScheduler] Tick failed: ${errorSummary(error, env)}`)
      } finally {
        running = false
        inFlight = null
      }
    })()
    inFlight = current
    return current
  }

  const timer = scheduleInterval(() => { void tick() }, intervalMs)
  if (typeof timer === 'object' && timer !== null && 'unref' in timer && typeof timer.unref === 'function') timer.unref()
  logger.info(`[FollowUpScheduler] Started: intervalMs=${intervalMs} environment=${env.NODE_ENV || 'unspecified'} enabled=true.`)

  return {
    enabled: true,
    intervalMs,
    async stop() {
      if (stopped) return
      stopping = true
      cancelInterval(timer)
      stopped = true
      logger.info('[FollowUpScheduler] Stopped.')

      const pending = inFlight
      if (!pending) return
      let timeout: ReturnType<typeof setTimeout> | undefined
      await Promise.race([
        pending,
        new Promise<void>(resolve => {
          timeout = scheduleTimeout(() => {
            logger.warn(`[FollowUpScheduler] In-flight tick did not finish within ${shutdownWaitMs}ms; continuing shutdown.`)
            resolve()
          }, shutdownWaitMs)
          if (typeof timeout === 'object' && timeout !== null && 'unref' in timeout && typeof timeout.unref === 'function') timeout.unref()
        }),
      ])
      if (timeout) cancelTimeout(timeout)
    },
  }
}
