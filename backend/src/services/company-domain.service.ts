import { companyDomain } from './apollo.service'

type CompanySources = { company: string; companyResearch?: { sources: Array<{ title: string; url: string }> } | null; discoverySources?: Array<{ title: string; url: string }> }

/** A first-party HTTPS host whose registrable label identifies the researched company. */
function firstPartyDomain(company: string, sources: Array<{ title: string; url: string }>): string | null {
  const companyLabel = company.toLowerCase().replace(/[^a-z0-9]/g, '')
  if (companyLabel.length < 3) return null
  const recognizedSuffixes = new Set(['com', 'org', 'net', 'io', 'ai', 'in', 'co', 'tech', 'app', 'dev', 'co.in', 'com.au'])
  const domains = new Set<string>()
  for (const source of sources) {
    try {
      if (typeof source?.url !== 'string' || typeof source?.title !== 'string') continue
      const url = new URL(source.url)
      if (url.protocol !== 'https:' || url.username || url.password || url.port) continue
      const parts = companyDomain(url.hostname)?.split('.') || []
      const suffixLength = ['co.in', 'com.au'].includes(parts.slice(-2).join('.')) ? 2 : 1
      const brand = parts.at(-suffixLength - 1)?.replace(/[^a-z0-9]/g, '')
      const root = parts.slice(-suffixLength - 1).join('.')
      const companyWithoutHr = companyLabel.endsWith('hr') ? companyLabel.slice(0, -2) : ''
      if ((brand === companyLabel || (brand === companyWithoutHr && source.title.toLowerCase().includes(company.toLowerCase()))) &&
        recognizedSuffixes.has(parts.slice(-suffixLength).join('.'))) domains.add(root)
    } catch { /* Invalid source is not official-website evidence. */ }
  }
  return domains.size === 1 ? [...domains][0] : null
}

export function firstPartyResearchDomain(lead: CompanySources): string | null {
  return firstPartyDomain(lead.company, lead.companyResearch?.sources || [])
}

export function firstPartyDiscoveryDomain(lead: CompanySources): string | null {
  return firstPartyDomain(lead.company, lead.discoverySources || [])
}

export function confirmedCompanyDomain(lead: CompanySources & { website?: string | null }): string | null {
  return companyDomain(lead.website || '') || firstPartyResearchDomain(lead) || firstPartyDiscoveryDomain(lead)
}
