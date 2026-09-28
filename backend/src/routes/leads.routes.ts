import { Router } from 'express'
import { GoogleSheetsService, type SheetLead } from '../services/sheets.service'
import { SalesGeminiService } from '../services/gemini.service'
import { TavilyService } from '../services/tavily.service'
import { validateQualificationIcp } from '../services/qualification-icp.service'
import { parseLeadSearch } from '../services/lead-search.service'

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
      return res.json({ lead: toLeadResponse(lead), status: 'insufficient_evidence', pocs: [], sources: [], searchesPerformed: 2 })
    }

    const pocs = await SalesGeminiService.identifyPOCs({ name: lead.company, website: lead.website }, sources)
    return res.json({
      lead: toLeadResponse(lead),
      status: pocs.length > 0 ? 'complete' : 'insufficient_evidence',
      pocs,
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
      icp = validateQualificationIcp(req.body?.icp)
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
