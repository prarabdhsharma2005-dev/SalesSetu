type Detail = { '@type'?: string; violations?: Array<{ quotaMetric?: string; quotaId?: string; quotaValue?: string }>; retryDelay?: string }

function safeIdentifier(value: unknown): string | undefined {
  return typeof value === 'string' && /^[a-zA-Z0-9_.\/-]{1,160}$/.test(value) ? value : undefined
}

export function geminiQuotaDetails(error: unknown) {
  const record = error && typeof error === 'object' ? error as Record<string, unknown> : {}
  const message = typeof record.message === 'string' ? record.message : ''
  // The SDK may put Google RPC details in the message or on errorDetails.
  let embedded: { error?: { details?: Detail[] } } = {}
  const jsonStart = message.indexOf('{')
  if (jsonStart >= 0) {
    try { embedded = JSON.parse(message.slice(jsonStart)) } catch { /* unavailable */ }
  }
  const details = Array.isArray(record.errorDetails) ? record.errorDetails as Detail[]
    : Array.isArray(record.details) ? record.details as Detail[] : embedded.error?.details || []
  const violation = details.flatMap(detail => detail.violations || [])[0]
  const retry = details.find(detail => typeof detail.retryDelay === 'string')?.retryDelay
  const header = record.headers && typeof record.headers === 'object' && 'get' in record.headers && typeof record.headers.get === 'function'
    ? record.headers.get('retry-after') : undefined
  const retryValue = retry || (typeof header === 'string' && /^\d+$/.test(header) ? `${header}s` : undefined)
  const retrySeconds = typeof retryValue === 'string' && /^\d+(?:\.\d+)?s$/.test(retryValue) ? Math.ceil(Number(retryValue.slice(0, -1))) : undefined
  const quotaMetric = safeIdentifier(violation?.quotaMetric)
  const quotaId = safeIdentifier(violation?.quotaId)
  const limit = typeof violation?.quotaValue === 'string' && /^\d+$/.test(violation.quotaValue) ? Number(violation.quotaValue) : undefined
  const model = safeIdentifier(record.attemptedModel)
  const signal = `${quotaMetric || ''} ${quotaId || ''}`.toLowerCase()
  const quotaKind = /spend|budget|cost/.test(signal) ? 'spend'
    : /billing/.test(signal) ? 'billing'
      : /per_day|perday|daily|rpd|_day/.test(signal) ? 'daily'
    : /per_minute|perminute|rpm|tpm|_minute/.test(signal) ? 'per_minute'
      : 'unknown'
  return { provider: 'Gemini', model, quotaMetric, quotaId, limit, retrySeconds, quotaKind }
}
