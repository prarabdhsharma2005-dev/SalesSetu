import type { TavilySearchResult } from './tavily.service'

export type ResearchFact = { value: string | number; sourceUrl: string }
export type ResearchFacts = { industry?: ResearchFact; city?: ResearchFact; employees?: ResearchFact }
export type SavedCompanyResearch = {
  summary: string
  sources: Array<{ title: string; url: string }>
  model?: string
  facts: ResearchFacts
  updatedAt: string
}

const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Only direct statements about the named company become lead fields. Search geography is never evidence. */
export function sourceBackedResearchFacts(company: string, sources: TavilySearchResult[]): ResearchFacts {
  const facts: ResearchFacts = {}
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
      const match = content.match(new RegExp(`${named}\\s+(?:is\\s+)?headquartered\\s+in\\s+([A-Za-z]+(?:[ -][A-Za-z]+)?)\\b`, 'i'))
      if (match) facts.city = { value: match[1], sourceUrl: source.url }
    }
    if (!facts.employees) {
      const match = content.match(new RegExp(`${named}\\s+has\\s+([\\d,]+)\\s+employees\\b`, 'i'))
      const count = match ? Number(match[1].replaceAll(',', '')) : NaN
      if (Number.isSafeInteger(count) && count > 0) facts.employees = { value: count, sourceUrl: source.url }
    }
  }
  return facts
}
