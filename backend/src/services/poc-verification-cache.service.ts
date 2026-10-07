import type { DiscoveredPOC } from './gemini.service'

type CachedPOCs = {
  expiresAt: number
  pocs: DiscoveredPOC[]
}

const CACHE_TTL_MS = 15 * 60 * 1000
const cache = new Map<string, CachedPOCs>()

export class POCVerificationCache {
  static store(leadId: string, pocs: DiscoveredPOC[]): void {
    if (!leadId || pocs.length === 0) {
      cache.delete(leadId)
      return
    }
    cache.set(leadId, {
      expiresAt: Date.now() + CACHE_TTL_MS,
      pocs: pocs.map(poc => ({ ...poc })),
    })
  }

  static find(leadId: string, name: string, sourceUrl: string): DiscoveredPOC | null {
    const entry = cache.get(leadId)
    if (!entry) return null
    if (entry.expiresAt <= Date.now()) {
      cache.delete(leadId)
      return null
    }
    return entry.pocs.find(poc => poc.name === name && poc.sourceUrl === sourceUrl) || null
  }

  static clear(): void {
    cache.clear()
  }
}
