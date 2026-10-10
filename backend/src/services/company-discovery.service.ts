import { randomUUID } from 'node:crypto'
import type { TavilySearchResult } from './tavily.service'

export const MAX_DISCOVERY_BATCHES = 6
export const DISCOVERY_BATCH_SIZE = 10

export type DiscoveryFilters = { query: string; industry: string; city: string; intent: string }
export type DiscoveredCompany = {
  id: string
  name: string
  domain: string | null
  industry: string | null
  city: string | null
  country: string | null
  employees: number | null
  companyLinkedInUrl: string | null
  sources: Array<{ title: string; url: string; snippet: string }>
}
export type DiscoverySession = {
  id: string
  filters: DiscoveryFilters
  batch: number
  companies: DiscoveredCompany[]
  createdAt: string
  updatedAt: string
  hasMore: boolean
  status: 'complete' | 'partial' | 'empty'
}

export function normalizeCompanyDomain(value: string): string | null {
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`)
    if (!['http:', 'https:'].includes(url.protocol)) return null
    const host = url.hostname.toLowerCase().replace(/^www\./, '').replace(/\.$/, '')
    return host.includes('.') && !/\s/.test(host) ? host : null
  } catch { return null }
}

export function companyIdentity(company: { name: string; domain?: string | null; website?: string | null }): string[] {
  const domain = normalizeCompanyDomain(company.domain || company.website || '')
  const name = typeof company.name === 'string' ? company.name.toLowerCase().replace(/[^a-z0-9]+/g, '') : ''
  return [...(domain ? [`domain:${domain}`] : []), ...(name ? [`name:${name}`] : [])]
}

function sourceHas(source: { title: string; content: string }, value: string): boolean {
  const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(^|[^a-z0-9])${escaped}(?=$|[^a-z0-9])`, 'i').test(`${source.title} ${source.content}`)
}

function supportedText(value: unknown, sources: TavilySearchResult[]): string | null {
  if (typeof value !== 'string') return null
  const text = value.trim().slice(0, 120)
  return text && sources.some(source => sourceHas(source, text)) ? text : null
}

/** Only a cited company-page result naming this company can supply its LinkedIn URL. */
export function sourceBackedCompanyLinkedInUrl(name: string, sources: Array<{ title: string; url: string; content?: string; snippet?: string }>): string | null {
  for (const source of sources) {
    if (!sourceHas({ title: source.title, content: source.content ?? source.snippet ?? '' }, name)) continue
    try {
      const url = new URL(source.url)
      if (url.protocol !== 'https:' || !['linkedin.com', 'www.linkedin.com'].includes(url.hostname.toLowerCase())) continue
      if (url.username || url.password || url.port || !/^\/company\/[a-z0-9_-]+\/?$/i.test(url.pathname)) continue
      return url.toString()
    } catch { /* An invalid source URL is not a company profile. */ }
  }
  return null
}

/** AI output is a suggestion; only facts present in the supplied source text survive. */
export function groundDiscoveredCompanies(raw: unknown, searchResults: TavilySearchResult[]): DiscoveredCompany[] {
  if (!Array.isArray(raw)) return []
  const sourceByUrl = new Map(searchResults.map(source => [source.url, source]))
  const seen = new Set<string>()
  return raw.slice(0, 30).flatMap(value => {
    if (!value || typeof value !== 'object') return []
    const item = value as Record<string, unknown>
    const name = typeof item.name === 'string' ? item.name.trim().replace(/\s+/g, ' ').slice(0, 120) : ''
    const cited = Array.isArray(item.sourceUrls) ? item.sourceUrls.flatMap(url => typeof url === 'string' && sourceByUrl.has(url) ? [sourceByUrl.get(url)!] : []) : []
    const supporting = cited.filter(source => name.length >= 3 && sourceHas(source, name))
    if (!supporting.length) return []
    const domain = typeof item.domain === 'string' ? normalizeCompanyDomain(item.domain) : null
    const compactName = name.toLowerCase().replace(/[^a-z0-9]+/g, '')
    const supportedDomain = domain && supporting.some(source =>
      sourceHas(source, domain) || (normalizeCompanyDomain(source.url) === domain && domain.split('.')[0].replace(/[^a-z0-9]/g, '').includes(compactName))) ? domain : null
    const ids = companyIdentity({ name, domain: supportedDomain })
    if (ids.some(id => seen.has(id))) return []
    ids.forEach(id => seen.add(id))
    const employeeValue = typeof item.employees === 'number' && Number.isSafeInteger(item.employees) && item.employees > 0 ? item.employees : null
    const employees = employeeValue && supporting.some(source => new RegExp(`\\b(?:${employeeValue}\\s+(?:employees|staff|people)|(?:employees|staff|team of)\\s+${employeeValue})\\b`, 'i').test(`${source.title} ${source.content}`)) ? employeeValue : null
    return [{
      id: randomUUID(), name, domain: supportedDomain,
      industry: supportedText(item.industry, supporting),
      city: supportedText(item.city, supporting),
      country: supportedText(item.country, supporting),
      employees,
      companyLinkedInUrl: sourceBackedCompanyLinkedInUrl(name, supporting),
      sources: supporting.map(source => ({ title: source.title, url: source.url, snippet: source.content.slice(0, 350) })),
    }]
  }).slice(0, DISCOVERY_BATCH_SIZE)
}

export function distinctFrom(companies: DiscoveredCompany[], existing: Array<{ name: string; domain?: string | null; website?: string | null }>) {
  const seen = new Set(existing.flatMap(companyIdentity))
  return companies.filter(company => {
    const ids = companyIdentity(company)
    if (ids.some(id => seen.has(id))) return false
    ids.forEach(id => seen.add(id))
    return true
  })
}

export function matchesEvidenceFilters(company: DiscoveredCompany, filters: DiscoveryFilters): boolean {
  const comparable = (value: string) => value.trim().toLowerCase().replace('bengaluru', 'bangalore')
  // Optional filters steer provider search. Unknown sourced fields remain unknown,
  // while an explicitly sourced contradiction excludes the company.
  return (!filters.industry || company.industry === null || comparable(company.industry) === comparable(filters.industry))
    && (!filters.city || company.city === null || comparable(company.city) === comparable(filters.city))
}

export function validateDiscoveryFilters(input: unknown): DiscoveryFilters {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('A company discovery query is required.')
  const value = input as Record<string, unknown>
  const query = typeof value.query === 'string' ? value.query.trim() : ''
  if (!query || query.length > 240) throw new Error('Enter a query of 1–240 characters.')
  const field = (key: string) => {
    const text = typeof value[key] === 'string' ? value[key].trim() : ''
    if (text.length > 80) throw new Error(`${key} filter is too long.`)
    return text === 'All' ? '' : text
  }
  const intent = field('intent')
  if (intent && !['HOT', 'WARM', 'COLD'].includes(intent)) throw new Error('Unsupported intent filter.')
  return { query, industry: field('industry'), city: field('city'), intent }
}

export function discoverySearchQuery(filters: DiscoveryFilters, batch: number): string {
  const expansions = [
    'companies official websites', 'company directories and profiles', 'businesses and vendors',
    'emerging companies', 'established companies', 'additional company profiles',
  ]
  return [filters.query, filters.industry, filters.city, filters.intent && `${filters.intent.toLowerCase()} business signals`, expansions[batch]].filter(Boolean).join(' ')
}
