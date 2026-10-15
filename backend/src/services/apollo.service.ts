/** One explicitly selected person per request. No waterfall, personal email, or phone reveal. */
import { getDomain } from 'tldts'

export type ApolloEmailResult =
  | { kind: 'found'; email: string; providerStatus: string; matchEvidence: string[] }
  | { kind: 'no_match' | 'ambiguous' }

export class ApolloLookupError extends Error {
  constructor(readonly code: 'NOT_CONFIGURED' | 'CUSTOMER_USE_DISABLED' | 'ACCESS_UNAVAILABLE' | 'RATE_LIMITED' | 'UNAVAILABLE', readonly retryAfterSeconds?: number) {
    super(code)
  }
}

export function companyDomain(value: string): string | null {
  try {
    const trimmed = value.trim()
    const url = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`)
    const domain = url.hostname.toLowerCase().replace(/^www\./, '').replace(/\.$/, '')
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.port ||
      domain.length > 253 || !/^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/.test(domain) ||
      domain.split('.').some(label => label.length > 63 || label.startsWith('-') || label.endsWith('-')) ||
      !/^[a-z]{2,}$/.test(domain.split('.').at(-1) || '')) return null
    return getDomain(domain, { allowPrivateDomains: true })
  } catch { return null }
}

const normalized = (value: string) => value.trim().toLocaleLowerCase().replace(/\s+/g, ' ')
const profile = (value: string) => {
  try { const url = new URL(value); return `${url.hostname.toLowerCase().replace(/^www\./, '')}${url.pathname.replace(/\/$/, '').toLowerCase()}` }
  catch { return '' }
}

export const ApolloService = {
  customerUseAllowed() { return process.env.NODE_ENV !== 'production' || process.env.APOLLO_CUSTOMER_USE_ENABLED === 'true' },
  async findWorkEmail(input: { name: string; company: string; website: string; profileUrl?: string | null; providerPersonId?: string | null }, fetcher: typeof fetch = fetch): Promise<ApolloEmailResult> {
    if (!this.customerUseAllowed()) throw new ApolloLookupError('CUSTOMER_USE_DISABLED')
    const key = process.env.APOLLO_API_KEY?.trim()
    if (!key) throw new ApolloLookupError('NOT_CONFIGURED')
    const domain = companyDomain(input.website)
    if (!domain || normalized(input.name).split(' ').length < 2) return { kind: 'ambiguous' }
    const url = new URL('https://api.apollo.io/api/v1/people/match')
    url.searchParams.set('name', input.name.trim())
    url.searchParams.set('domain', domain)
    if (input.providerPersonId) url.searchParams.set('id', input.providerPersonId)
    if (input.profileUrl) url.searchParams.set('linkedin_url', input.profileUrl)
    url.searchParams.set('reveal_personal_emails', 'false')
    url.searchParams.set('reveal_phone_number', 'false')
    url.searchParams.set('run_waterfall_email', 'false')
    url.searchParams.set('run_waterfall_phone', 'false')
    let response: Response
    try {
      response = await fetcher(url, { method: 'POST', headers: { 'x-api-key': key, 'accept': 'application/json', 'content-type': 'application/json', 'cache-control': 'no-cache' }, signal: AbortSignal.timeout(15_000) })
    } catch { throw new ApolloLookupError('UNAVAILABLE') }
    if (response.status === 429) {
      const retry = Number(response.headers.get('retry-after'))
      throw new ApolloLookupError('RATE_LIMITED', Number.isFinite(retry) && retry > 0 ? retry : undefined)
    }
    if (response.status === 401 || response.status === 403) throw new ApolloLookupError('ACCESS_UNAVAILABLE')
    if (!response.ok) throw new ApolloLookupError('UNAVAILABLE')
    let payload: Record<string, unknown>
    try { payload = await response.json() as Record<string, unknown> }
    catch { throw new ApolloLookupError('UNAVAILABLE') }
    const person = payload.person && typeof payload.person === 'object' ? payload.person as Record<string, unknown> : null
    if (!person || payload.match_confidence === 'none') return { kind: 'no_match' }
    const organization = person.organization && typeof person.organization === 'object' ? person.organization as Record<string, unknown> : null
    const returnedDomain = typeof organization?.primary_domain === 'string' ? companyDomain(organization.primary_domain) : null
    const returnedName = typeof person.name === 'string' ? person.name : `${person.first_name || ''} ${person.last_name || ''}`
    const email = typeof person.email === 'string' ? person.email.trim().toLowerCase() : ''
    const emailDomain = email.split('@')[1] || ''
    // A weak identity, different employer, or different sourced profile must never prefill a recipient.
    if (payload.match_confidence !== 'high' || normalized(returnedName) !== normalized(input.name) || returnedDomain !== domain ||
      (input.profileUrl && profile(String(person.linkedin_url || '')) !== profile(input.profileUrl)) ||
      (input.providerPersonId && person.id !== input.providerPersonId)) return { kind: 'ambiguous' }
    if (!email) return { kind: 'no_match' }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || emailDomain !== domain || email.startsWith('email_not_unlocked@')) return { kind: 'ambiguous' }
    return { kind: 'found', email, providerStatus: typeof person.email_status === 'string' ? person.email_status.slice(0, 40) : 'unknown', matchEvidence: ['exact_name', 'employer_domain', ...(input.profileUrl ? ['sourced_profile'] : []), ...(input.providerPersonId ? ['provider_person_id'] : []), 'high_provider_match'] }
  },
}
