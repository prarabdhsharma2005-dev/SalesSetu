import { ApolloLookupError, ApolloService } from './apollo.service'
import { HunterLookupError, HunterService, type HunterLookupMode } from './hunter.service'
import { GoogleSheetsService, type SheetLead } from './sheets.service'
import { confirmedCompanyDomain } from './company-domain.service'
import { currentWorkspace } from './workspace-context.service'

export type WorkEmailProvider = 'hunter' | 'apollo'
type SelectedPoc = { name: string; sourceUrl: string; profileUrl: string | null }

export class PocEmailLookupError extends Error {
  constructor(readonly status: number, readonly code: string, message: string, readonly retryAfterSeconds?: number) { super(message) }
}

export { confirmedCompanyDomain } from './company-domain.service'

export async function lookupPocWorkEmail(lead: SheetLead, poc: SelectedPoc, provider: WorkEmailProvider, hunterMode: HunterLookupMode = 'found_only') {
  if (provider === 'hunter' && process.env.NODE_ENV === 'production' && (!process.env.HUNTER_ALLOWED_WORKSPACE_ID || currentWorkspace() !== process.env.HUNTER_ALLOWED_WORKSPACE_ID)) {
    throw new PocEmailLookupError(403, 'HUNTER_OWNER_ONLY', 'Hunter lookup is available only in the configured owner workspace. Enter and confirm a recipient manually.')
  }
  if (provider === 'apollo' && !ApolloService.customerUseAllowed()) throw new PocEmailLookupError(403, 'CUSTOMER_USE_DISABLED', 'Work-email lookup is disabled for customer use until Apollo licensing is confirmed. Enter and confirm a recipient manually.')
  const domain = confirmedCompanyDomain(lead)
  if (!domain) throw new PocEmailLookupError(422, 'COMPANY_DOMAIN_UNKNOWN', 'No supported company website is saved. Confirm and save the official website in Human Approvals, or enter the recipient manually.')
  const saved = await GoogleSheetsService.getPocEmailEnrichment(lead.id, poc.name, poc.sourceUrl, provider, hunterMode, domain)
  if (saved && saved.profileUrl === poc.profileUrl && Date.now() - Date.parse(saved.lookedUpAt) < 30 * 86_400_000) {
    return { status: 'found' as const, email: saved.email, provider: saved.provider, hunterMode: saved.provider === 'hunter' ? saved.hunterMode || 'found_only' : null, sourceType: saved.sourceType || 'unknown', providerStatus: saved.providerStatus, confidence: saved.confidence ?? null, sourceUrls: saved.sourceUrls || [], matchEvidence: saved.matchEvidence, lookedUpAt: saved.lookedUpAt, cached: true }
  }
  try {
    const result = provider === 'hunter'
      ? await HunterService.findWorkEmail({ name: poc.name, website: domain }, fetch, hunterMode)
      : await ApolloService.findWorkEmail({ name: poc.name, company: lead.company, website: domain, profileUrl: poc.profileUrl })
    if (result.kind !== 'found') throw new PocEmailLookupError(422, result.kind === 'ambiguous' ? 'AMBIGUOUS_MATCH' : 'NO_EMAIL_MATCH', result.kind === 'ambiguous'
      ? `${provider === 'hunter' ? 'Hunter' : 'Apollo'} could not establish the selected person and company unambiguously. No email was saved.`
      : `${provider === 'hunter' ? 'Hunter' : 'Apollo'} found no work email for this selected person. You can enter and confirm an address manually.`)
    const sourceType = 'sourceType' in result && (result.sourceType === 'found' || result.sourceType === 'inferred') ? result.sourceType : 'unknown'
    const record = await GoogleSheetsService.savePocEmailEnrichment({ leadId: lead.id, name: poc.name, sourceUrl: poc.sourceUrl, profileUrl: poc.profileUrl, companyDomain: domain, email: result.email, provider, ...(provider === 'hunter' ? { hunterMode } : {}), sourceType, providerStatus: result.providerStatus, matchEvidence: result.matchEvidence, confidence: 'confidence' in result && typeof result.confidence === 'number' ? result.confidence : null, sourceUrls: 'sourceUrls' in result && Array.isArray(result.sourceUrls) ? result.sourceUrls : [], lookedUpAt: new Date().toISOString() })
    if (!record) throw new PocEmailLookupError(404, 'LEAD_NOT_FOUND', 'Lead no longer exists in this workspace.')
    return { status: 'found' as const, email: record.email, provider: record.provider, hunterMode: record.provider === 'hunter' ? record.hunterMode || 'found_only' : null, sourceType: record.sourceType || 'unknown', providerStatus: record.providerStatus, confidence: record.confidence ?? null, sourceUrls: record.sourceUrls || [], matchEvidence: record.matchEvidence, lookedUpAt: record.lookedUpAt, cached: false }
  } catch (error) {
    if (error instanceof PocEmailLookupError) throw error
    if (error instanceof HunterLookupError) {
      const status = error.code === 'RATE_LIMITED' || error.code === 'QUOTA_EXHAUSTED' ? 429 : error.code === 'ACCESS_UNAVAILABLE' || error.code === 'PRIVACY_RESTRICTED' ? 403 : error.code === 'INVALID_DOMAIN' || error.code === 'INVALID_PERSON' ? 422 : 503
      const message = error.code === 'NOT_CONFIGURED' ? 'Hunter is not configured on this backend. Add HUNTER_API_KEY or enter a recipient manually.'
        : error.code === 'ACCESS_UNAVAILABLE' ? 'Hunter rejected this key or account. Check API access without changing the recipient.'
          : error.code === 'PRIVACY_RESTRICTED' ? 'Hunter cannot process this person for privacy reasons. No email was saved.'
            : error.code === 'INVALID_DOMAIN' ? 'Hunter rejected the company domain. Confirm the saved company website or use manual recipient entry.'
              : error.code === 'INVALID_PERSON' ? 'Hunter rejected the selected POC name. Refresh POC evidence or enter the recipient manually.'
                : error.code === 'RATE_LIMITED' ? `Hunter quota or rate limit reached.${error.retryAfterSeconds ? ` Try again in ${error.retryAfterSeconds} seconds.` : ' Retry later.'}`
                  : error.code === 'QUOTA_EXHAUSTED' ? 'Hunter account usage limit reached. Check the Hunter account allowance before retrying.'
                  : error.code === 'TIMEOUT' ? 'Hunter lookup timed out. No email was saved; retry later or enter a recipient manually.'
                    : 'Hunter lookup is unavailable. No email was saved.'
      throw new PocEmailLookupError(status, error.code, message, error.retryAfterSeconds)
    }
    if (error instanceof ApolloLookupError) {
      const status = error.code === 'RATE_LIMITED' ? 429 : error.code === 'ACCESS_UNAVAILABLE' || error.code === 'CUSTOMER_USE_DISABLED' ? 403 : 503
      const message = error.code === 'NOT_CONFIGURED' ? 'Apollo is not configured. Set APOLLO_API_KEY on the backend, or enter a recipient manually.'
        : error.code === 'CUSTOMER_USE_DISABLED' ? 'Work-email lookup is disabled for customer use until Apollo licensing is confirmed. Enter and confirm a recipient manually.'
          : error.code === 'ACCESS_UNAVAILABLE' ? 'Apollo enrichment access is unavailable for this key or account. Check endpoint permissions and account eligibility.'
            : error.code === 'RATE_LIMITED' ? `Apollo rate limit reached.${error.retryAfterSeconds ? ` Try again in ${error.retryAfterSeconds} seconds.` : ' Retry later.'}`
              : 'Apollo enrichment is unavailable. No email was saved.'
      throw new PocEmailLookupError(status, error.code, message, error.retryAfterSeconds)
    }
    throw new PocEmailLookupError(503, 'UNAVAILABLE', 'Work-email lookup is unavailable. No email was saved.')
  }
}
