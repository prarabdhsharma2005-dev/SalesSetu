type DraftFailure = { code?: string; error?: string; provider?: string; model?: string; quotaKind?: string; retrySeconds?: number; quotaMetric?: string; quotaId?: string; limit?: number }

export function outreachDraftErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  const start = message.indexOf('{')
  let failure: DraftFailure = {}
  if (start >= 0) {
    try { failure = JSON.parse(message.slice(start)) } catch { /* retain original error */ }
  }
  if (failure.code === 'WORKSPACE_QUOTA_EXCEEDED') return `${failure.error || 'Workspace daily AI limit reached.'}${Number.isSafeInteger(failure.retrySeconds) && failure.retrySeconds! > 0 ? ` Retry in approximately ${Math.ceil(failure.retrySeconds! / 60)} minute(s).` : ''} Manual drafting is available.`
  if (failure.code === 'AI_QUOTA') {
    const timing = Number.isSafeInteger(failure.retrySeconds) && failure.retrySeconds! > 0
      ? ` Retry after approximately ${Math.ceil(failure.retrySeconds! / 60)} minute(s).`
      : failure.quotaKind === 'daily' ? ' Retry after the provider daily quota resets.'
        : failure.quotaKind === 'spend' || failure.quotaKind === 'billing' ? ' Check the project billing or spend limit; repeated retries will not help.'
        : ' Check Gemini usage and retry when quota is available.'
    const metric = failure.quotaMetric ? ` Metric: ${failure.quotaMetric}${failure.quotaId ? ` (${failure.quotaId})` : ''}${failure.limit !== undefined ? `, limit ${failure.limit}` : ''}.` : ''
    return `Gemini quota reached${failure.model ? ` for ${failure.model}` : ''}.${metric}${timing} No AI draft was saved. You can write and save a manual draft.`
  }
  return failure.error || message || 'Draft generation failed.'
}
