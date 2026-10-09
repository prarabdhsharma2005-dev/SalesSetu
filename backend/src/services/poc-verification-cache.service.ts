import { createHmac, randomBytes, timingSafeEqual } from 'crypto'
import type { DiscoveredPOC } from './gemini.service'

type CachedPOCs = {
  expiresAt: number
  pocs: DiscoveredPOC[]
}

const CACHE_TTL_MS = 15 * 60 * 1000
const cache = new Map<string, CachedPOCs>()
const localSigningKey = randomBytes(32)
type LeadIdentity = { id: string; company: string; website?: string }

function signature(payload: string): Buffer {
  // PostgreSQL deployments share DATABASE_URL across instances; local JSON mode uses one process.
  const key = process.env.DATABASE_URL?.trim() || localSigningKey
  return createHmac('sha256', key).update(`salesetu-poc-selection-v1:${payload}`).digest()
}

export class POCVerificationCache {
  static issue(lead: LeadIdentity, poc: DiscoveredPOC): string {
    const payload = Buffer.from(JSON.stringify({
      version: 1, leadId: lead.id, company: lead.company, website: lead.website || '',
      poc, expiresAt: Date.now() + CACHE_TTL_MS,
    })).toString('base64url')
    return `${payload}.${signature(payload).toString('base64url')}`
  }

  static verify(lead: LeadIdentity, selected: { name: string; sourceUrl: string; verificationToken?: unknown }, now = Date.now()): DiscoveredPOC | null {
    const token = selected.verificationToken
    if (typeof token !== 'string' || token.length > 8192) return null
    const parts = token.split('.')
    if (parts.length !== 2) return null
    try {
      const supplied = Buffer.from(parts[1], 'base64url')
      const expected = signature(parts[0])
      if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null
      const value = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8')) as {
        version?: number; leadId?: string; company?: string; website?: string; expiresAt?: number; poc?: DiscoveredPOC
      }
      if (value.version !== 1 || value.leadId !== lead.id || value.company !== lead.company ||
        value.website !== (lead.website || '') || typeof value.expiresAt !== 'number' || value.expiresAt <= now ||
        value.poc?.name !== selected.name || value.poc?.sourceUrl !== selected.sourceUrl) return null
      return value.poc
    } catch { return null }
  }

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
