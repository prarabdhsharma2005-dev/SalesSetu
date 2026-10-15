import type { TavilySearchResult } from './tavily.service'

export type ResearchFact = { value: string | number; sourceUrl: string; basis?: 'cited_summary' }
export type ResearchFacts = { industry?: ResearchFact; city?: ResearchFact; employees?: ResearchFact }
/** Do not choose one employee figure when cited and excerpt evidence disagree. */
export function mergeResearchFacts(summary: ResearchFacts, excerpts: ResearchFacts): ResearchFacts {
  const merged = { ...summary, ...excerpts }
  if (summary.employees && excerpts.employees && Number(summary.employees.value) !== Number(excerpts.employees.value)) delete merged.employees
  return merged
}
export type SavedCompanyResearch = {
  summary: string
  sources: Array<{ title: string; url: string }>
  model?: string
  facts: ResearchFacts
  updatedAt: string
}

const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Company-attributed summary claims whose citations exactly match saved, company-named sources. */
export function citedCompanyClaims(company: string, research: Pick<SavedCompanyResearch, 'summary' | 'sources'>): Array<{ text: string; sourceUrl: string }> {
  const name = company.trim()
  if (!name || !research.summary || !Array.isArray(research.sources)) return []
  const named = escape(name)
  const claims = research.summary.matchAll(new RegExp(`(?:^|[.!?]\\s+|\\n)\\s*(${named}\\b[^.!?()\\n]{0,400})\\(([^)]*)\\)`, 'gim'))
  const supported: Array<{ text: string; sourceUrl: string }> = []
  for (const match of claims) {
    const text = match[1].trim()
    if (/\b(?:inference|possibly|reportedly|might|may|unverified)\b/i.test(text)) continue
    const urls = match[2].match(/https?:\/\/[^\s,)]+/g) || []
    const sourceUrl = urls.find(url => research.sources.some(source => {
      if (source.url !== url || !new RegExp(`^${named}(?:\\b|[\\s:–-])`, 'i').test(source.title)) return false
      try { return ['http:', 'https:'].includes(new URL(url).protocol) } catch { return false }
    }))
    if (sourceUrl) supported.push({ text, sourceUrl })
  }
  return supported
}

/** Only direct statements about the named company become lead fields. Search geography is never evidence. */
export function sourceBackedResearchFacts(company: string, sources: TavilySearchResult[]): ResearchFacts {
  const facts: ResearchFacts = {}
  const employeeCounts = new Map<number, ResearchFact>()
  const name = company.trim()
  if (!name) return facts
  const named = escape(name)
  for (const source of sources) {
    try { if (!['http:', 'https:'].includes(new URL(source.url).protocol)) continue }
    catch { continue }
    const content = `${source.title}. ${source.content}`
    if (!facts.industry) {
      const match = content.match(new RegExp(`${named}\\s+(?:is|operates as)\\s+(?:an?\\s+)?(SaaS|FinTech|EdTech|HealthTech|E-commerce)\\s+company\\b`, 'i'))
      if (match) facts.industry = { value: match[1], sourceUrl: source.url }
    }
    if (!facts.city) {
      // Keep the city tied to a direct statement about this company, even when
      // its industry is mentioned between the name and “headquartered”.
      const match = content.match(new RegExp(`${named}\\s+(?:(?:is\\s+)?(?:an?\\s+)?(?:SaaS|FinTech|EdTech|HealthTech|E-commerce)\\s+company\\s+)?(?:is\\s+)?headquartered\\s+in\\s+([A-Za-z]+(?:[ -][A-Za-z]+)?)\\b`, 'i'))
      if (match) facts.city = { value: match[1], sourceUrl: source.url }
    }
    for (const match of content.matchAll(new RegExp(`${named}\\s+(?:has|employs)\\s+([\\d,]+)\\s+(?:employees|people)\\b`, 'gi'))) {
      const count = Number(match[1].replaceAll(',', ''))
      if (Number.isSafeInteger(count) && count > 0) employeeCounts.set(count, { value: count, sourceUrl: source.url })
    }
  }
  if (employeeCounts.size === 1) facts.employees = [...employeeCounts.values()][0]
  return facts
}

/** Recover only direct company claims with a citation to a saved company-named source.
 * The original snippets were not stored in older dossiers, so these facts retain
 * their AI-summary provenance instead of being labelled independently verified. */
export function citedSummaryResearchFacts(company: string, research: Pick<SavedCompanyResearch, 'summary' | 'sources'>): ResearchFacts {
  const facts: ResearchFacts = {}
  const name = company.trim()
  if (!name) return facts
  const named = escape(name)
  const employeeCounts = new Map<number, ResearchFact>()
  for (const { text: claim, sourceUrl: citation } of citedCompanyClaims(company, research)) {
    const industry = claim.match(new RegExp(`^${named}\\b[^.!?]{0,140}\\bis\\s+(?:an?\\s+)?(?:multi-product\\s+)?(financial services|financial technology|FinTech|SaaS|EdTech|HealthTech|e-commerce)\\s+(?:company|platform|business)\\b`, 'i'))
    // A directly company-attributed "fintech solutions platform" is a sourced
    // industry statement too; unrelated mentions of fintech are not.
    const fintechPlatform = new RegExp(`^${named}\\b[^.!?]{0,100}\\bis\\s+(?:an?\\s+)?[^.!?]{0,80}\\bfintech\\s+(?:solutions?\\s+)?(?:company|platform|business)\\b`, 'i').test(claim)
    if (!facts.industry && (industry || fintechPlatform)) facts.industry = { value: industry?.[1] || 'FinTech', sourceUrl: citation, basis: 'cited_summary' }
    const city = claim.match(/\b(?:headquartered|based)\s+in\s+([A-Za-z]+(?:[ -][A-Za-z]+)?)(?=\s*[,.;]|\s+and\b|$)/i)
    if (city && !facts.city) facts.city = { value: city[1], sourceUrl: citation, basis: 'cited_summary' }
    for (const employees of claim.matchAll(/\b(?:has|employs)\s+([\d,]+)\s+(?:employees|people)\b/gi)) {
      const count = Number(employees[1].replaceAll(',', ''))
      if (Number.isSafeInteger(count) && count > 0) employeeCounts.set(count, { value: count, sourceUrl: citation, basis: 'cited_summary' })
    }
  }
  if (employeeCounts.size === 1) facts.employees = [...employeeCounts.values()][0]
  return facts
}
