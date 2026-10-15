import { companyDomain } from './apollo.service'

export type HunterEmailResult =
  | { kind: 'found'; email: string; sourceType: 'found' | 'inferred' | 'unknown'; providerStatus: string; confidence: number | null; sourceUrls: string[]; matchEvidence: string[] }
  | { kind: 'no_match' | 'ambiguous' }
export type HunterLookupMode = 'found_only' | 'include_inferred'

export class HunterLookupError extends Error {
  constructor(readonly code: 'NOT_CONFIGURED' | 'ACCESS_UNAVAILABLE' | 'RATE_LIMITED' | 'QUOTA_EXHAUSTED' | 'PRIVACY_RESTRICTED' | 'INVALID_DOMAIN' | 'INVALID_PERSON' | 'TIMEOUT' | 'UNAVAILABLE', readonly retryAfterSeconds?: number) {
    super(code)
  }
}

const normalize = (value: string) => value.trim().toLocaleLowerCase().replace(/\s+/g, ' ')
const safeSource = (value: unknown): value is string => {
  if (typeof value !== 'string') return false
  try { return ['http:', 'https:'].includes(new URL(value).protocol) } catch { return false }
}

/** One explicit lookup. The standard endpoint is used only when the user opts in. */
export const HunterService = {
  async findWorkEmail(input: { name: string; website: string }, fetcher: typeof fetch = fetch, mode: HunterLookupMode = 'found_only'): Promise<HunterEmailResult> {
    const key = process.env.HUNTER_API_KEY?.trim()
    if (!key) throw new HunterLookupError('NOT_CONFIGURED')
    const domain = companyDomain(input.website)
    if (!domain || normalize(input.name).split(' ').length < 2) return { kind: 'ambiguous' }
    const url = new URL(mode === 'include_inferred' ? 'https://api.hunter.io/v2/email-finder' : 'https://api.hunter.io/v2/email-finder/found')
    url.searchParams.set('domain', domain)
    url.searchParams.set('full_name', input.name.trim())
    url.searchParams.set('max_duration', '10')
    let response: Response
    try {
      response = await fetcher(url, { method: 'GET', headers: { 'X-API-KEY': key, accept: 'application/json', 'cache-control': 'no-cache' }, signal: AbortSignal.timeout(15_000) })
    } catch (error) { throw new HunterLookupError(error instanceof Error && /timeout|aborted/i.test(error.name + error.message) ? 'TIMEOUT' : 'UNAVAILABLE') }
    if (response.status === 429 || response.status === 403) {
      const retry = Number(response.headers.get('retry-after'))
      throw new HunterLookupError(response.status === 429 ? 'QUOTA_EXHAUSTED' : 'RATE_LIMITED', Number.isFinite(retry) && retry > 0 ? retry : undefined)
    }
    if (response.status === 401) throw new HunterLookupError('ACCESS_UNAVAILABLE')
    if (response.status === 451) throw new HunterLookupError('PRIVACY_RESTRICTED')
    if (response.status === 400) {
      let id = ''
      try {
        const payload = await response.json() as { errors?: Array<{ id?: string }> }
        id = payload.errors?.[0]?.id || ''
      } catch { /* Hunter supplied no usable error identifier. */ }
      throw new HunterLookupError(id === 'invalid_domain' ? 'INVALID_DOMAIN' : id === 'invalid_full_name' || id === 'invalid_first_name' || id === 'invalid_last_name' ? 'INVALID_PERSON' : 'UNAVAILABLE')
    }
    if (response.status !== 200) throw new HunterLookupError('UNAVAILABLE')
    let payload: unknown
    try { payload = await response.json() }
    catch { throw new HunterLookupError('UNAVAILABLE') }
    if (!payload || typeof payload !== 'object' || Array.isArray(payload) || !Object.hasOwn(payload, 'data')) throw new HunterLookupError('UNAVAILABLE')
    const data = (payload as Record<string, unknown>).data
    if (data === null) return { kind: 'no_match' }
    if (!data || typeof data !== 'object' || Array.isArray(data) || !Object.hasOwn(data, 'email')) throw new HunterLookupError('UNAVAILABLE')
    const person = data as Record<string, unknown>
    if (person.email === null || person.email === '') return { kind: 'no_match' }
    if (typeof person.email !== 'string') throw new HunterLookupError('UNAVAILABLE')
    const returnedName = `${typeof person.first_name === 'string' ? person.first_name : ''} ${typeof person.last_name === 'string' ? person.last_name : ''}`.trim()
    const returnedDomain = typeof person.domain === 'string' ? companyDomain(person.domain) : null
    const email = person.email.trim().toLowerCase()
    const sourceUrls = Array.isArray(person.sources) ? [...new Set(person.sources.map(item => item && typeof item === 'object' ? (item as Record<string, unknown>).uri : null).filter(safeSource))].slice(0, 20) : []
    const sourceType = person.source_type === 'found' ? 'found' : person.source_type === 'generated' || person.source_type === 'inferred' ? 'inferred' : 'unknown'
    // Exact selected-person and employer checks apply in both modes. A found address needs a public source.
    if (normalize(returnedName) !== normalize(input.name) || returnedDomain !== domain ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.split('@')[1] !== domain ||
      (sourceType === 'found' && sourceUrls.length === 0) || (mode === 'found_only' && (sourceType === 'inferred' || sourceUrls.length === 0))) return { kind: 'ambiguous' }
    const verification = person.verification && typeof person.verification === 'object' ? person.verification as Record<string, unknown> : null
    const score = typeof person.score === 'number' && Number.isFinite(person.score) && person.score >= 0 && person.score <= 100 ? person.score : null
    return { kind: 'found', email, sourceType, providerStatus: typeof verification?.status === 'string' ? verification.status.slice(0, 40) : 'unknown', confidence: score, sourceUrls, matchEvidence: ['exact_name', 'employer_domain', ...(sourceType === 'found' ? ['web_found_email'] : sourceType === 'inferred' ? ['provider_inference'] : ['source_type_unknown'])] }
  },
}
