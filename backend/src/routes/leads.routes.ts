import { Router } from 'express'
import { GoogleSheetsService, type SheetLead } from '../services/sheets.service'
import { SalesGeminiService, CompanyDiscoveryAnalysisError } from '../services/gemini.service'
import { TavilyService } from '../services/tavily.service'
import { POCVerificationCache } from '../services/poc-verification-cache.service'
import { assessIcpCriteria, validateQualificationIcp } from '../services/qualification-icp.service'
import { parseLeadSearch } from '../services/lead-search.service'
import { currentWorkspace, workspaceMode } from '../services/workspace-context.service'
import { randomUUID } from 'node:crypto'
import { MeetingWorkflowConflictError } from '../services/meeting-workflow.service'
import { discoverySearchQuery, distinctFrom, matchesEvidenceFilters, MAX_DISCOVERY_BATCHES, validateDiscoveryFilters, type DiscoverySession } from '../services/company-discovery.service'
import { citedSummaryResearchFacts, mergeResearchFacts, sourceBackedResearchFacts } from '../services/company-research.service'

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
  const archived = workspaceMode() && req.query.archived === 'true'
  const leads = storedLeads.filter(lead => {
    const matchesQuery = !query || [lead.company, lead.industry, lead.city, lead.intentSignal]
      .some(value => value.toLowerCase().includes(query))
    const matchesIndustry = !industry || lead.industry.toLowerCase() === industry
    const matchesCity = !city || lead.city.toLowerCase() === city
    const matchesIntent = !intent || intentForStatus(lead.status) === intent
    const matchesMinScore = minScore === undefined || lead.leadScore >= minScore
    return Boolean(lead.archivedAt) === archived && matchesQuery && matchesIndustry && matchesCity && matchesIntent && matchesMinScore
  }).map(toLeadResponse)

  res.json({ total: leads.length, leads })
})

leadsRouter.post('/archive', async (req, res) => {
  if (!workspaceMode() || !currentWorkspace()) return res.status(404).json({ error: 'Private lead archive is unavailable.' })
  const { ids, all, archived, expectedCount } = req.body || {}
  if (typeof archived !== 'boolean' || !Number.isInteger(expectedCount) || expectedCount < 1 || expectedCount > 10_000 ||
    (all !== true && (!Array.isArray(ids) || ids.length !== expectedCount || ids.some((id: unknown) => typeof id !== 'string' || id.length > 120))) ||
    (all === true && ids !== undefined)) return res.status(400).json({ error: 'Confirm a current, non-empty lead selection and count.' })
  try { return res.json(await GoogleSheetsService.setLeadArchived({ ids, all: all === true, archived, expectedCount })) }
  catch (error) {
    if (error instanceof MeetingWorkflowConflictError) return res.status(409).json({ error: error.message })
    return res.status(503).json({ error: 'Lead archive change could not be saved.' })
  }
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

leadsRouter.delete('/discovery/:id', async (req, res) => {
  if (!workspaceMode() || !currentWorkspace()) return res.status(404).json({ error: 'Private company discovery is unavailable.' })
  await GoogleSheetsService.clearDiscoverySession(req.params.id)
  return res.json({ cleared: true })
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

async function runCompanyResearch(lead: SheetLead) {
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
  const citedFacts = citedSummaryResearchFacts(lead.company, research)
  const excerptFacts = sourceBackedResearchFacts(lead.company, researchResults)
  return GoogleSheetsService.saveCompanyResearch(lead.id, {
    ...research,
    facts: mergeResearchFacts(citedFacts, excerptFacts),
    updatedAt: new Date().toISOString(),
  })
}

function companyResearchFailure(error: unknown) {
  const message = error instanceof Error ? error.message : ''
  const attempts = error instanceof Error && 'attempts' in error && Array.isArray(error.attempts)
    ? error.attempts as Array<{ status?: number; type?: string }> : []
  if (/TAVILY_API_KEY|GEMINI_API_KEY|not configured/i.test(message)) return { code: 'PROVIDER_NOT_CONFIGURED', message: 'Company research needs Tavily and Gemini configuration.', status: 503 }
  if (/no usable company research results/.test(message)) return { code: 'INSUFFICIENT_EVIDENCE', message: 'Company research found no usable search results for this lead.', status: 422 }
  if (/HTTP 429/.test(message) || attempts.some(attempt => attempt.status === 429)) return { code: 'PROVIDER_QUOTA', message: 'Company research provider quota or rate limit was reached. Retry later.', status: 429 }
  if (attempts.length) return { code: 'GEMINI_UNAVAILABLE', message: 'Gemini could not produce a company research summary. Retry later.', status: 503 }
  if (/Tavily/.test(message)) return { code: 'TAVILY_UNAVAILABLE', message: 'Tavily search is unavailable for Company Research. Retry later.', status: 503 }
  return { code: 'RESEARCH_UNAVAILABLE', message: 'Company research could not be completed or saved. Existing lead data was preserved.', status: 503 }
}

leadsRouter.get('/:id/research', async (req, res) => {
  const lead = (await GoogleSheetsService.getLeads()).find(item => item.id === req.params.id)
  if (!lead) return res.status(404).json({ error: 'Lead not found' })
  if (lead.companyResearch) return res.json({ lead: toLeadResponse(lead), research: lead.companyResearch })

  try {
    const saved = await runCompanyResearch(lead)
    if (!saved) return res.status(404).json({ error: 'Lead not found' })
    return res.json({ lead: toLeadResponse(saved), research: saved.companyResearch })
  } catch (err: unknown) {
    const failure = companyResearchFailure(err)
    const attempts = err instanceof Error && 'attempts' in err
      ? (err as Error & { attempts?: unknown }).attempts
      : undefined
    console.error('[CompanyResearch] Research failed', failure.code)
    return res.json({
      lead: toLeadResponse(lead),
      research: null,
      researchError: failure.message,
      researchErrorCode: failure.code,
      researchDiagnostics: attempts,
    })
  }
})

// A cached summary with no usable facts can be retried only by an explicit user action.
leadsRouter.post('/:id/research/refresh', async (req, res) => {
  const lead = (await GoogleSheetsService.getLeads()).find(item => item.id === req.params.id)
  if (!lead) return res.status(404).json({ error: 'Lead not found' })
  try {
    const saved = await runCompanyResearch(lead)
    if (!saved) return res.status(404).json({ error: 'Lead not found' })
    return res.json({ lead: toLeadResponse(saved), research: saved.companyResearch })
  } catch (err: unknown) {
    const failure = companyResearchFailure(err)
    console.error('[CompanyResearch] Refresh failed', failure.code)
    return res.status(failure.status).json({ code: failure.code, error: `${failure.message} Existing saved research was preserved.` })
  }
})

// Explicit, provider-free repair for older dossiers saved before cited facts were mapped.
leadsRouter.post('/:id/research/repair', async (req, res) => {
  const result = await GoogleSheetsService.repairCompanyResearchFromSavedEvidence(req.params.id)
  if (!result) return res.status(404).json({ error: 'Lead not found' })
  if (!result.lead.companyResearch) return res.status(409).json({ error: 'Run Company Research for this saved lead first.' })
  if (!result.repaired) return res.status(422).json({ error: 'Saved research has no additional supported company facts. Refresh research explicitly if new evidence is needed.' })
  return res.json({ lead: toLeadResponse(result.lead), research: result.lead.companyResearch })
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
    const discovered = pocs.map(poc => ({ ...poc, verificationToken: POCVerificationCache.issue(lead, poc) }))
    return res.json({
      lead: toLeadResponse(lead),
      status: pocs.length > 0 ? 'complete' : 'insufficient_evidence',
      pocs: discovered,
      sources: sources.map(({ title, url, content }) => ({ title, url, content })),
      searchesPerformed: 2,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : ''
    const status = /HTTP 429/.test(message) || (err instanceof CompanyDiscoveryAnalysisError && err.status === 429) ? 429 : 503
    const reason = message.includes('TAVILY_API_KEY') ? 'POC discovery requires Tavily configuration.'
      : message.includes('Gemini is not configured') ? 'POC discovery requires Gemini configuration.'
        : status === 429 ? 'POC discovery provider quota is unavailable. Try again later.'
          : 'POC discovery provider is unavailable right now. Retry later.'
    console.error('[POCDiscovery] Discovery failed', status === 429 ? 'PROVIDER_QUOTA' : 'PROVIDER_UNAVAILABLE')
    return res.status(status).json({ error: reason })
  }
})

leadsRouter.post('/:id/qualify', async (req, res) => {
  let lead = (await GoogleSheetsService.getLeads()).find(item => item.id === req.params.id)
  if (!lead) return res.status(404).json({ error: 'Lead not found' })

  try {
    let icp
    let icpSavedAt: string | null = null
    try {
      const rulebook = workspaceMode() ? await GoogleSheetsService.getIcpRulebook() : req.body?.icp
      icp = validateQualificationIcp(rulebook)
      icpSavedAt = rulebook && typeof rulebook === 'object' && typeof rulebook.savedAt === 'string' ? rulebook.savedAt : null
    } catch (err) {
      return res.status(400).json({ error: err instanceof Error ? err.message : 'Invalid ICP rulebook' })
    }
    if (workspaceMode() && !icp) return res.status(409).json({ error: 'Save an ICP Rulebook in this workspace before qualifying this lead.' })
    // Reuse stored citations before scoring. This is provider-free and repeat-safe.
    if (lead.companyResearch) {
      const repaired = await GoogleSheetsService.repairCompanyResearchFromSavedEvidence(lead.id)
      if (repaired) lead = repaired.lead
    }
    const assessedLead = lead
    if (workspaceMode() && !assessIcpCriteria(lead, icp).some(item => item.key !== 'icp_fit' && item.score !== null)) {
      return res.status(409).json({ error: 'This lead has no assessable industry, city, or employee count. Research this saved company, then qualify again.' })
    }
    const outreach = (await GoogleSheetsService.getOutreach())
      .filter(item => item.company.trim().toLowerCase() === assessedLead.company.trim().toLowerCase())
      .map(item => ({ status: item.status, sentAt: item.sentAt || null }))
    const qualification = await SalesGeminiService.qualifyLead({
      lead: {
        company: lead.company,
        website: lead.website,
        industry: lead.industry,
        country: lead.country,
        city: lead.city,
        employees: lead.employees,
        companyResearch: lead.companyResearch,
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
      qualificationIcpSavedAt: icpSavedAt,
      qualificationResearchUpdatedAt: lead.companyResearch?.updatedAt || null,
    })
    if (!updated) return res.status(404).json({ error: 'Lead not found' })
    const currentLead = (await GoogleSheetsService.getLeads()).find(item => item.id === assessedLead.id) || updated
    return res.json({ lead: toLeadResponse(currentLead), qualification: { ...qualification, updatedAt: qualificationUpdatedAt } })
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
