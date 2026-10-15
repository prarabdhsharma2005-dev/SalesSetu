import type { QualificationCriterion, QualificationEvidence, SheetLead } from './sheets.service'
import { citedCompanyClaims } from './company-research.service'

export type QualificationIcp = {
  industries: string[]
  cities: string[]
  stages: string[]
  intents: string[]
  minEmp?: number
  maxEmp?: number
  minScore?: number
}

type QualificationLeadFields = Pick<SheetLead, 'industry' | 'country' | 'city' | 'employees' | 'companyResearch'> & Partial<Pick<SheetLead, 'company'>>

const MAX_LIST_ITEMS = 50
const MAX_TEXT_LENGTH = 100

function stringList(value: unknown, field: string): string[] {
  if (value === undefined) return []
  if (!Array.isArray(value) || value.length > MAX_LIST_ITEMS || value.some(item => typeof item !== 'string' || item.length > MAX_TEXT_LENGTH)) {
    throw new Error(`Invalid ICP ${field}`)
  }
  return value.map(item => item.trim()).filter(Boolean)
}

function employeeBound(value: unknown, field: string): number | undefined {
  if (value === undefined || value === null || value === '') return undefined
  const parsed = typeof value === 'number' ? value : typeof value === 'string' && /^\d+$/.test(value.trim()) ? Number(value) : NaN
  if (!Number.isSafeInteger(parsed) || parsed < 0 || parsed > 10_000_000) throw new Error(`Invalid ICP ${field}`)
  return parsed
}

/** Validate and narrow the existing browser rulebook shape before using it server-side. */
export function validateQualificationIcp(value: unknown): QualificationIcp | null {
  if (value === undefined || value === null) return null
  if (typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid ICP rulebook')
  const raw = value as Record<string, unknown>
  const minEmp = employeeBound(raw.minEmp, 'minimum employee count')
  const maxEmp = employeeBound(raw.maxEmp, 'maximum employee count')
  if (minEmp !== undefined && maxEmp !== undefined && minEmp > maxEmp) throw new Error('Invalid ICP employee range')
  return {
    industries: stringList(raw.industries, 'industries'),
    cities: stringList(raw.cities, 'cities'),
    stages: stringList(raw.stages, 'funding stages'),
    intents: stringList(raw.intents, 'intent priorities'),
    minEmp,
    maxEmp,
    minScore: employeeBound(raw.minScore, 'minimum lead score'),
  }
}

const normalize = (value: string) => value.trim().toLowerCase().replace(/[\s_-]+/g, ' ')
const BELLANDUR_WARD_SOURCE = 'https://site.bbmp.gov.in/zonalclassification.html'
const knownIndustries = new Set(['saas', 'fintech', 'edtech', 'healthtech', 'e commerce', 'manufacturing', 'retail', 'logistics'])
const knownCities = new Set(['bengaluru', 'mumbai', 'pune', 'chennai', 'hyderabad', 'delhi', 'new delhi', 'kolkata', 'ahmedabad', 'gurugram', 'noida'])

function industryCategory(value: string): string {
  const normalized = normalize(value)
  if (['fin tech', 'financial technology'].includes(normalized)) return 'fintech'
  if (normalized === 'software as a service') return 'saas'
  if (normalized === 'ecommerce') return 'e commerce'
  return normalized
}

function cityLocation(value: string): { canonical: string; label: string; provenance: string; sourceUrl: string | null } | null {
  const normalized = normalize(value)
  if (normalized === 'bellandur' || normalized === 'bellanduru') {
    // BBMP's Bengaluru ward classification lists Bellandur as ward 150.
    return { canonical: 'bengaluru', label: 'Bengaluru', provenance: 'BBMP Bellandur ward mapping', sourceUrl: BELLANDUR_WARD_SOURCE }
  }
  if (normalized === 'bangalore' || normalized === 'bengaluru') {
    return { canonical: 'bengaluru', label: 'Bengaluru', provenance: 'Bangalore/Bengaluru spelling alias', sourceUrl: null }
  }
  return knownCities.has(normalized) ? { canonical: normalized, label: value.trim(), provenance: 'named city', sourceUrl: null } : null
}

const fintechTaxonomy = [
  { category: 'stockbroking platform', pattern: /\b(?:operates in (?:the )?stock broking|(?:online|digital) stock (?:broking|trading))\b/i, requiresDigitalContext: true },
  { category: 'investment platform', pattern: /\b(?:is|operates as) (?:an? )?(?:online |digital )?investment platform\b/i, requiresDigitalContext: false },
  { category: 'digital financial services', pattern: /\b(?:provides|offers) digital financial services\b/i, requiresDigitalContext: false },
] as const

function citedFintechOperation(lead: QualificationLeadFields): { sourceUrl: string; signal: string; category: string } | null {
  if (!lead.company || !lead.companyResearch) return null
  for (const claim of citedCompanyClaims(lead.company, lead.companyResearch)) {
    if (/\b(?:does not|doesn't|no longer|not)\b/i.test(claim.text)) continue
    for (const entry of fintechTaxonomy) {
      const signal = claim.text.match(entry.pattern)
      if (signal && (!entry.requiresDigitalContext || /\b(?:online|digital|platform|app)\b/i.test(claim.text))) {
        return { sourceUrl: claim.sourceUrl, signal: signal[0], category: entry.category }
      }
    }
  }
  return null
}

function rating(score: number): QualificationCriterion['rating'] {
  if (score >= 75) return 'strong'
  if (score >= 40) return 'moderate'
  return 'weak'
}

function criterion(key: string, label: string, score: number | null, assessment: string, evidence: QualificationEvidence[] = []): QualificationCriterion {
  return {
    key,
    label,
    rating: score === null ? 'unknown' : rating(score),
    score,
    assessment,
    evidence,
  }
}

function comparisonEvidence(criterionKey: string, leadField: string, leadValue: string, icpField: string, icpValues: string[]): QualificationEvidence[] {
  return [
    { criterion: criterionKey, field: leadField, value: leadValue, origin: 'sales_setu_record', sourceUrl: null },
    { criterion: criterionKey, field: icpField, value: icpValues.join(', '), origin: 'user_defined', sourceUrl: null },
  ]
}

/** Deterministic comparisons keep AI from inventing ICP matches or fit scores. */
export function assessIcpCriteria(lead: QualificationLeadFields, icp: QualificationIcp | null): QualificationCriterion[] {
  const definitions = [
    { key: 'industry_fit', label: 'Industry fit' },
    { key: 'geography_fit', label: 'Geography fit' },
    { key: 'company_size', label: 'Company size / employee fit' },
  ]
  if (!icp) return [criterion('icp_fit', 'ICP fit', null, 'Saved ICP rulebook was not supplied.'), ...definitions.map(item => criterion(item.key, item.label, null, 'Required ICP or lead data is unavailable.'))]

  const industry = lead.industry?.trim() || ''
  const originalCategory = industryCategory(industry)
  const fintechOperation = !industry || originalCategory === 'financial services' ? citedFintechOperation(lead) : null
  const normalizedIndustry = fintechOperation ? 'fintech' : originalCategory
  const directIndustryMatch = icp.industries.find(value => industryCategory(value) === originalCategory)
  const matchedIndustry = (fintechOperation ? icp.industries.find(value => industryCategory(value) === 'fintech') : undefined) || directIndustryMatch
  const industryAssessable = Boolean(industry || fintechOperation) && (Boolean(matchedIndustry) || knownIndustries.has(normalizedIndustry))
  const industryScore = icp.industries.length && industryAssessable ? (matchedIndustry ? 100 : 0) : null
  const industryEvidence = icp.industries.length && (industry || fintechOperation)
    ? [
      ...comparisonEvidence('industry_fit', 'industry', industry || 'Not recorded', 'target industries', icp.industries),
      ...(fintechOperation ? [{ criterion: 'industry_fit', field: 'normalized industry', value: `FinTech (${fintechOperation.signal})`, origin: 'ai_inference' as const, sourceUrl: fintechOperation.sourceUrl }]
        : industry && normalizedIndustry !== normalize(industry) ? [{ criterion: 'industry_fit', field: 'normalized industry', value: normalizedIndustry, origin: 'sales_setu_record' as const, sourceUrl: null }] : []),
      ...(matchedIndustry ? [{ criterion: 'industry_fit', field: 'matched ICP industry', value: matchedIndustry, origin: 'user_defined' as const, sourceUrl: null }] : []),
    ] : []
  const industryCriterion = criterion(
    'industry_fit', 'Industry fit', industryScore,
    !icp.industries.length ? 'No target industries are configured; points unknown.'
      : industryScore === null ? `${industry || 'Industry unknown'} cannot be classified against the saved ICP with supported evidence; points unknown.`
        : `${industry || 'Industry unknown'} → ${fintechOperation ? `FinTech (cited ${fintechOperation.category})` : normalizedIndustry}; ${matchedIndustry ? `matches ICP ${matchedIndustry}` : `does not match ICP ${icp.industries.join(', ')}`}; ${industryScore}/100 points.`,
    industryEvidence,
  )

  const city = lead.city?.trim() || ''
  const mappedCity = cityLocation(city)
  const matchedCity = icp.cities.find(value => (cityLocation(value)?.canonical || normalize(value)) === (mappedCity?.canonical || normalize(city)) && Boolean(city))
  const geographyScore = icp.cities.length && city && (mappedCity || matchedCity) ? (matchedCity ? 100 : 0) : null
  const geographyEvidence = icp.cities.length && city
    ? [
      ...comparisonEvidence('geography_fit', 'city', city, 'target cities/hubs', icp.cities),
      ...(mappedCity && (mappedCity.canonical !== normalize(city) || mappedCity.sourceUrl) ? [{ criterion: 'geography_fit', field: 'normalized city', value: `${mappedCity.label} (${mappedCity.provenance})`, origin: mappedCity.sourceUrl ? 'source_backed' as const : 'sales_setu_record' as const, sourceUrl: mappedCity.sourceUrl }] : []),
      ...(matchedCity ? [{ criterion: 'geography_fit', field: 'matched ICP city', value: matchedCity, origin: 'user_defined' as const, sourceUrl: null }] : []),
    ] : []
  const geographyCriterion = criterion(
    'geography_fit', 'Geography fit', geographyScore,
    !icp.cities.length ? 'No target cities are configured; points unknown.'
      : geographyScore === null ? `${city || 'Location unknown'} cannot be mapped to a supported city for this ICP; points unknown.`
        : `${city} → ${mappedCity?.label || city}${mappedCity && mappedCity.provenance !== 'named city' ? ` (${mappedCity.provenance})` : ''}; ${matchedCity ? `matches ICP ${matchedCity}` : `does not match ICP ${icp.cities.join(', ')}`}; ${geographyScore}/100 points.`,
    geographyEvidence,
  )

  const employeeText = String(lead.employees ?? '').trim()
  const employees = employeeText ? Number(employeeText) : NaN
  const hasEmployeeRange = icp.minEmp !== undefined || icp.maxEmp !== undefined
  const employeeKnown = Number.isSafeInteger(employees) && employees >= 0
  const inRange = employeeKnown && (icp.minEmp === undefined || employees >= icp.minEmp) && (icp.maxEmp === undefined || employees <= icp.maxEmp)
  const companySizeScore = hasEmployeeRange && employeeKnown ? (inRange ? 100 : 0) : null
  const rangeLabel = `${icp.minEmp ?? 'no minimum'}–${icp.maxEmp ?? 'no maximum'}`
  const sizeEvidence = companySizeScore === null ? [] : [
    { criterion: 'company_size', field: 'employees', value: String(employees), origin: 'sales_setu_record' as const, sourceUrl: null },
    { criterion: 'company_size', field: 'employee range', value: rangeLabel, origin: 'user_defined' as const, sourceUrl: null },
  ]
  const companySizeCriterion = criterion(
    'company_size', 'Company size / employee fit', companySizeScore,
    companySizeScore === null ? 'Employee range or lead employee count is unavailable; points unknown.' : companySizeScore ? `${employees.toLocaleString()} employees is within the configured range (${rangeLabel}); 100/100 points.` : `${employees.toLocaleString()} employees is outside the configured range (${rangeLabel}); 0/100 points.`,
    sizeEvidence,
  )

  const assessed = [industryCriterion, geographyCriterion, companySizeCriterion].filter(item => item.score !== null)
  const icpFitScore = assessed.length
    ? Math.round(assessed.reduce((sum, item) => sum + (item.score || 0), 0) / assessed.length)
    : null
  const icpFit = criterion(
    'icp_fit', 'ICP fit', icpFitScore,
    icpFitScore === null ? 'No ICP fit dimensions are configured and assessable.' : `Aggregate fit across ${assessed.length} assessable ICP dimension${assessed.length === 1 ? '' : 's'}.`,
    assessed.flatMap(item => item.evidence),
  )
  return [icpFit, industryCriterion, geographyCriterion, companySizeCriterion].map(item => {
    const evidence = item.evidence.map(evidence => {
      const fact = evidence.field === 'industry' ? lead.companyResearch?.facts?.industry
        : evidence.field === 'city' ? lead.companyResearch?.facts?.city
          : evidence.field === 'employees' ? lead.companyResearch?.facts?.employees : undefined
      return fact && String(fact.value) === evidence.value
        ? { ...evidence, origin: fact.basis === 'cited_summary' ? 'ai_inference' as const : 'source_backed' as const, sourceUrl: fact.sourceUrl }
        : evidence
    })
    return {
      ...item,
      assessment: item.key !== 'icp_fit' && evidence.some(value => value.origin === 'ai_inference')
        ? `${item.assessment} Based on a cited AI research summary; the original source excerpt was not retained.`
        : item.assessment,
      evidence,
    }
  })
}

/** Overall score is the rounded, equal-weight average of assessable component dimensions.
 * Unknown dimensions are excluded, a supported mismatch contributes zero, and the ICP
 * roll-up is excluded so industry/geography/size are not counted twice. */
export function calculateQualificationScore(criteria: QualificationCriterion[]): number | null {
  const scored = criteria.filter(item => item.score !== null && item.key !== 'icp_fit')
  return scored.length ? Math.round(scored.reduce((sum, item) => sum + (item.score || 0), 0) / scored.length) : null
}

/** A saved assessment belongs to the ICP revision used when it was generated. */
export function qualificationNeedsRecheck(lead: Pick<SheetLead, 'qualificationStatus' | 'qualificationIcpSavedAt'>, rulebook: Record<string, unknown> | null): boolean {
  if (!lead.qualificationStatus) return false
  return typeof rulebook?.savedAt !== 'string' || !rulebook.savedAt || lead.qualificationIcpSavedAt !== rulebook.savedAt
}
