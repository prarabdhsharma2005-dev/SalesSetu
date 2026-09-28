import 'dotenv/config'

export type TavilySearchResult = {
  title: string
  url: string
  content: string
}

type TavilyResponse = {
  results?: Array<{
    title?: unknown
    url?: unknown
    content?: unknown
  }>
}

export class TavilyService {
  static async searchPOCs(company: string, website: string): Promise<TavilySearchResult[]> {
    const apiKey = process.env.TAVILY_API_KEY?.trim()
    if (!apiKey) throw new Error('TAVILY_API_KEY is not configured')

    const name = company.trim()
    const domain = website.trim().replace(/^https?:\/\//i, '').split('/')[0]
    if (!name) throw new Error('Company name is required for POC research')

    const contactQuery = `${name} company leadership sales business development partnerships marketing technology procurement executives`
    const profileQuery = `${name} company leadership sales business development partnerships marketing technology procurement LinkedIn`
    const [contactResults, profileResults] = await Promise.all([
      this.search(apiKey, contactQuery, domain ? [domain] : undefined),
      this.search(apiKey, profileQuery),
    ])

    const seen = new Set<string>()
    return [...contactResults, ...profileResults].filter(result => {
      if (seen.has(result.url)) return false
      seen.add(result.url)
      return true
    })
  }

  static async searchCompany(company: string, website: string): Promise<TavilySearchResult[]> {
    const apiKey = process.env.TAVILY_API_KEY?.trim()
    if (!apiKey) throw new Error('TAVILY_API_KEY is not configured')

    const domain = website.trim().replace(/^https?:\/\//i, '').split('/')[0]
    const officialQuery = `${company.trim()} company overview products services`
    const developmentsQuery = `${company.trim()} recent business developments product launches partnerships expansion company news`
    const [officialResults, developmentResults] = await Promise.all([
      this.search(apiKey, officialQuery, domain ? [domain] : undefined),
      this.search(apiKey, developmentsQuery),
    ])

    const seen = new Set<string>()
    return [...officialResults, ...developmentResults].filter(result => {
      if (seen.has(result.url)) return false
      seen.add(result.url)
      return true
    })
  }

  private static async search(apiKey: string, query: string, includeDomains?: string[]): Promise<TavilySearchResult[]> {
    let response: Response
    try {
      response = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: apiKey,
          query,
          search_depth: 'basic',
          max_results: 3,
          include_answer: false,
          ...(includeDomains ? { include_domains: includeDomains } : {}),
        }),
        signal: AbortSignal.timeout(15000),
      })
    } catch {
      throw new Error('Tavily search request failed')
    }

    if (!response.ok) throw new Error(`Tavily search failed (HTTP ${response.status})`)

    let payload: TavilyResponse
    try {
      payload = await response.json() as TavilyResponse
    } catch {
      throw new Error('Tavily returned an invalid response')
    }

    return (Array.isArray(payload.results) ? payload.results : []).flatMap(result => {
      if (typeof result.title !== 'string' || typeof result.url !== 'string' || typeof result.content !== 'string') return []
      const title = result.title.trim()
      const url = result.url.trim()
      const content = result.content.trim()
      if (!title || !url || !content) return []
      try {
        if (!['http:', 'https:'].includes(new URL(url).protocol)) return []
      } catch {
        return []
      }
      return [{ title, url, content: content.slice(0, 1600) }]
    })
  }
}
