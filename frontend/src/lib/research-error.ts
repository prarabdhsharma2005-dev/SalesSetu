/** Keep workspace limits distinct from external provider failures on company pages. */
export async function companyResearchResponseError(response: Response): Promise<string> {
  const body = await response.json().catch(() => null) as { code?: unknown; error?: unknown } | null
  const code = typeof body?.code === 'string' ? body.code : ''
  const message = typeof body?.error === 'string' ? body.error : ''
  if (response.status === 429 && code === 'WORKSPACE_QUOTA_EXCEEDED') {
    const seconds = Number(response.headers.get('Retry-After'))
    const reset = Number.isFinite(seconds) && seconds > 0
      ? ` Resets at ${new Date(Date.now() + seconds * 1000).toISOString().replace('T', ' ').slice(0, 16)} UTC.` : ''
    return `${message || 'Workspace discovery limit reached.'}${reset} Company Research was not run.`
  }
  if (response.status === 429 && code === 'PROVIDER_QUOTA') return message || 'Company Research provider quota was reached. Retry later.'
  if (['PROVIDER_NOT_CONFIGURED', 'INSUFFICIENT_EVIDENCE', 'GEMINI_UNAVAILABLE', 'TAVILY_UNAVAILABLE', 'RESEARCH_UNAVAILABLE'].includes(code) && message) return message
  return `Company Research request failed (HTTP ${response.status}). Retry later.`
}
