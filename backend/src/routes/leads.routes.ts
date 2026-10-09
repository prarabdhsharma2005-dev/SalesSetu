import { Router } from 'express'
import { GoogleSheetsService, type SheetLead } from '../services/sheets.service'
import { SalesGeminiService, CompanyDiscoveryAnalysisError } from '../services/gemini.service'
import { TavilyService } from '../services/tavily.service'
import { POCVerificationCache } from '../services/poc-verification-cache.service'
import { validateQualificationIcp } from '../services/qualification-icp.service'
import { parseLeadSearch } from '../services/lead-search.service'
import { currentWorkspace, workspaceMode } from '../services/workspace-context.service'
import { randomUUID } from 'node:crypto'
import { MeetingWorkflowConflictError } from '../services/meeting-workflow.service'
import { discoverySearchQuery, distinctFrom, matchesEvidenceFilters, MAX_DISCOVERY_BATCHES, validateDiscoveryFilters, type DiscoverySession } from '../services/company-discovery.service'

export const leadsRouter = Router()

function intentForStatus(status: string) {
  if (status === 'HOT' || status === 'MEETING_SCHEDULED') return 'HOT'
  if (status === 'WARM' || status === 'CONTACTED') return 'WARM'
  return 'COLD'
}

function toLeadResponse(lead: SheetLead) {
  return {
    ...lead,
    // Keep the existing /api/leads response aliases for existing consumers.
    domain: lead.website,
    score: lead.leadScore,
    intent: lead.intentSignal,
  }
}

leadsRouter.get('/', async (req, res) => {
  const filters = parseLeadSearch(String(req.query.query || ''), {
    industry: String(req.query.industry || ''),
    city: String(req.query.city || ''),
    intent: String(req.query.intent || ''),
  })
  const query = filters.query.toLowerCase()
  const industry = filters.industry.trim().toLowerCase()
  const city = filters.city.trim().toLowerCase()
  const intent = filters.intent.trim().toUpperCase()
  const minScore = req.query.minScore === undefined ? undefined : Number(req.query.minScore)

  const storedLeads = await GoogleSheetsService.getLeads()
  const leads = storedLeads.filter(lead => {
    const matchesQuery = !query || [lead.company, lead.industry, lead.city, lead.intentSignal]
      .some(value => value.toLowerCase().includes(query))
    const matchesIndustry = !industry || lead.industry.toLowerCase() === industry
    const matchesCity = !city || lead.city.toLowerCase() === city
    const matchesIntent = !intent || intentForStatus(lead.status) === intent
    const matchesMinScore = minScore === undefined || lead.leadScore >= minScore
    return matchesQuery && matchesIndustry && matchesCity && matchesIntent && matchesMinScore
  }).map(toLeadResponse)

  res.json({ total: leads.length, leads })
})

function discoveryError(res: import('express').Response, error: unknown) {
  if (error instanceof MeetingWorkflowConflictError) return res.status(409).json({ code: 'DISCOVERY_SESSION_STALE', error: 'Discovery changed while loading more. Reload the session and retry.' })
  if (error instanceof Error && /not configured/.test(error.message)) return res.status(503).json({ code: 'PROVIDER_NOT_CONFIGURED', error: 'Company discovery provider is not configured.' })
  if ((error instanceof CompanyDiscoveryAnalysisError && error.status === 429) || (error instanceof Error && /HTTP 429/.test(error.message))) return res.status(429).json({ code: 'PROVIDER_QUOTA', error: 'The research provider is rate limited. Try again later.' })
  console.error('[CompanyDiscovery] Provider or storage request failed', error instanceof Error ? error.name : 'UNKNOWN')
  return res.status(503).json({ code: 'DISCOVERY_UNAVAILABLE', error: 'Company discovery is unavailable. Retry this batch later.' })
}

leadsRouter.post('/discovery', async (req, res) => {
  if (!workspaceMode() || !currentWorkspace()) return res.status(404).json({ error: 'Private company discovery is unavailable.' })
  let filters
  try { filters = validateDiscoveryFilters(req.body) }
  catch (error) { return res.status(400).json({ error: error instanceof Error ? error.message : 'Invalid discovery query.' }) }
  try {
    const sources = await TavilyService.searchCompanies(discoverySearchQuery(filters, 0))
    const candidates = sources.length ? await SalesGeminiService.identifyCompanies(filters.query, sources) : []
    const saved = await GoogleSheetsService.getLeads()
    const companies = distinctFrom(candidates.filter(candidate => matchesEvidenceFilters(candidate, filters)), saved.map(lead => ({ name: lead.company, website: lead.website })))
    const now = new Date().toISOString()
    const session: DiscoverySession = {
      id: randomUUID(), filters, batch: 0, companies, createdAt: now, updatedAt: now,
      hasMore: sources.length > 0, status: companies.length ? companies.length < candidates.length ? 'partial' : 'complete' : 'empty',
    }
    await GoogleSheetsService.createDiscoverySession(session)
    return res.status(201).json(session)
  } catch (error) { return discoveryError(res, error) }
})

leadsRouter.get('/discovery/:id', async (req, res) => {
  if (!workspaceMode() || !currentWorkspace()) return res.status(404).json({ error: 'Private company discovery is unavailable.' })
  const session = await GoogleSheetsService.getDiscoverySession(req.params.id)
  return session ? res.json(session) : res.status(404).json({ error: 'Discovery session not found or expired.' })
})

leadsRouter.post('/discovery/:id/next', async (req, res) => {
  if (!workspaceMode() || !currentWorkspace()) return res.status(404).json({ error: 'Private company discovery is unavailable.' })
  const session = await GoogleSheetsService.getDiscoverySession(req.params.id)
  if (!session) return res.status(404).json({ error: 'Discovery session not found or expired.' })
  const batch = req.body?.batch
  if (!Number.isInteger(batch) || batch < 1 || batch >= MAX_DISCOVERY_BATCHES || batch > session.batch + 1) return res.status(400).json({ error: 'Invalid discovery continuation.' })
  if (batch <= session.batch) return res.json(session)
  if (!session.hasMore) return res.status(409).json({ error: 'This discovery session has no more batches.' })
  try {
    const sources = await TavilyService.searchCompanies(discoverySearchQuery(session.filters, batch))
    const candidates = sources.length ? await SalesGeminiService.identifyCompanies(session.filters.query, sources) : []
    const filtered = candidates.filter(candidate => matchesEvidenceFilters(candidate, session.filters))
    const updated = await GoogleSheetsService.advanceDiscoverySession(session.id, batch, filtered,
      filtered.length ? filtered.length < candidates.length ? 'partial' : 'complete' : 'empty', sources.length > 0 && batch < MAX_DISCOVERY_BATCHES - 1)
    return updated ? res.json(updated) : res.status(404).json({ error: 'Discovery session not found or expired.' })
  } catch (error) { return discoveryError(res, error) }
})

leadsRouter.post('/discovery/:id/save', async (req, res) => {
  if (!workspaceMode() || !currentWorkspace()) return res.status(404).json({ error: 'Private company discovery is unavailable.' })
  const ids = req.body?.candidateIds
  if (!Array.isArray(ids) || ids.length < 1 || ids.length > 20 || ids.some(id => typeof id !== 'string')) return res.status(400).json({ error: 'Select 1–20 discovered companies to save.' })
  try {
    const result = await GoogleSheetsService.saveDiscoveredCompanies(req.params.id, ids)
    return result ? res.json(result) : res.status(404).json({ error: 'Discovery session not found or expired.' })
  } catch (error) {
    if (error instanceof Error && /not in this discovery session/.test(error.message)) return res.status(400).json({ error: error.message })
    return res.status(503).json({ error: 'Discovered companies could not be saved. Retry without changing the selection.' })
  }
})

leadsRouter.get('/:id/research', async (req, res) => {
  const lead = (await GoogleSheetsService.getLeads()).find(item => item.id === req.params.id)
  if (!lead) return res.status(404).json({ error: 'Lead not found' })

  try {
    const researchResults = await TavilyService.searchCompany(lead.company, lead.website)
    if (researchResults.length === 0) throw new Error('Tavily returned no usable company research results')

    const research = await SalesGeminiService.researchCompany({
      name: lead.company,
      website: lead.website,
      industry: lead.industry,
      city: lead.city,
      country: lead.country,
      intentSignal: lead.intentSignal,
    }, researchResults)
    return res.json({ lead: toLeadResponse(lead), research })
  } catch (err: unknown) {
    const attempts = err instanceof Error && 'attempts' in err
      ? (err as Error & { attempts?: unknown }).attempts
      : undefined
    console.error('[CompanyResearch] Research failed', attempts || 'UNCLASSIFIED_ERROR')
    return res.json({
      lead: toLeadResponse(lead),
      research: null,
      researchError: 'Company research is unavailable right now.',
      researchDiagnostics: attempts,
    })
  }
})

leadsRouter.get('/:id/pocs', async (req, res) => {
  const lead = (await GoogleSheetsService.getLeads()).find(item => item.id === req.params.id)
  if (!lead) return res.status(404).json({ error: 'Lead not found' })

  try {
    const sources = await TavilyService.searchPOCs(lead.company, lead.website)
    if (sources.length === 0) {
      POCVerificationCache.store(lead.id, [])
      return res.json({ lead: toLeadResponse(lead), status: 'insufficient_evidence', pocs: [], sources: [], searchesPerformed: 2 })
    }

    const pocs = await SalesGeminiService.identifyPOCs({ name: lead.company, website: lead.website }, sources)
    POCVerificationCache.store(lead.id, pocs)
    return res.json({
      lead: toLeadResponse(lead),
      status: pocs.length > 0 ? 'complete' : 'insufficient_evidence',
      pocs: pocs.map(poc => ({ ...poc, verificationToken: POCVerificationCache.issue(lead, poc) })),
      sources: sources.map(({ title, url, content }) => ({ title, url, content })),
      searchesPerformed: 2,
    })
  } catch (err: unknown) {
    const reason = err instanceof Error && err.message.includes('TAVILY_API_KEY')
      ? 'POC discovery requires Tavily configuration.'
      : 'POC discovery is unavailable right now.'
    console.error('[POCDiscovery] Discovery failed')
    return res.status(503).json({ error: reason })
  }
})

leadsRouter.post('/:id/qualify', async (req, res) => {
  const lead = (await GoogleSheetsService.getLeads()).find(item => item.id === req.params.id)
  if (!lead) return res.status(404).json({ error: 'Lead not found' })

  try {
    let icp
    try {
      icp = validateQualificationIcp(workspaceMode() ? await GoogleSheetsService.getIcpRulebook() : req.body?.icp)
    } catch (err) {
      return res.status(400).json({ error: err instanceof Error ? err.message : 'Invalid ICP rulebook' })
    }
    const outreach = (await GoogleSheetsService.getOutreach())
      .filter(item => item.company.trim().toLowerCase() === lead.company.trim().toLowerCase())
      .map(item => ({ status: item.status, sentAt: item.sentAt || null }))
    const qualification = await SalesGeminiService.qualifyLead({
      lead: {
        company: lead.company,
        website: lead.website,
        industry: lead.industry,
        country: lead.country,
        city: lead.city,
        employees: lead.employees,
        intentSignal: lead.intentSignal,
        status: lead.status,
      },
      icp,
      intentSourceUrl: null,
      intentDetectedAt: null,
      whyNowScore: null,
      technologyEvidence: null,
      pocs: null,
      engagement: {
        outreachStatuses: outreach.map(item => item.status),
        prospectResponseData: null,
      },
    })
    const qualificationUpdatedAt = new Date().toISOString()
    const updated = await GoogleSheetsService.updateLead(lead.id, {
      qualificationStatus: qualification.status,
      qualificationScore: qualification.score,
      qualificationReasons: qualification.reasons,
      qualificationCriteria: qualification.criteria,
      qualificationEvidence: qualification.evidence,
      qualificationUnknowns: qualification.unknowns,
      qualificationUpdatedAt,
    })
    if (!updated) return res.status(404).json({ error: 'Lead not found' })
    return res.json({ lead: toLeadResponse(updated), qualification: { ...qualification, updatedAt: qualificationUpdatedAt } })
  } catch {
    console.error('[Qualification] Lead qualification failed')
    return res.status(503).json({ error: 'Lead qualification is unavailable right now.' })
  }
})

leadsRouter.get('/:id', async (req, res) => {
  const lead = (await GoogleSheetsService.getLeads()).find(item => item.id === req.params.id)
  if (!lead) return res.status(404).json({ error: 'Lead not found' })
  res.json(toLeadResponse(lead))
})
