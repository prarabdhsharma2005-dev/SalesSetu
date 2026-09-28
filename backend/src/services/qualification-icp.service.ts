import type { QualificationCriterion, QualificationEvidence, SheetLead } from './sheets.service'

export type QualificationIcp = {
  industries: string[]
  cities: string[]
  stages: string[]
  intents: string[]
  minEmp?: number
  maxEmp?: number
  minScore?: number
}

type QualificationLeadFields = Pick<SheetLead, 'industry' | 'country' | 'city' | 'employees'>

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

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, ' ')
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
  const industryScore = icp.industries.length && industry
    ? (icp.industries.some(value => normalize(value) === normalize(industry)) ? 100 : 0)
    : null
  const industryCriterion = criterion(
    'industry_fit', 'Industry fit', industryScore,
    industryScore === null ? 'Target industries or the lead industry are unavailable.' : industryScore ? `${industry} matches a target industry.` : `${industry} does not match the configured target industries.`,
    industryScore === null ? [] : comparisonEvidence('industry_fit', 'industry', industry, 'target industries', icp.industries),
  )

  const city = lead.city?.trim() || ''
  const geographyScore = icp.cities.length && city
    ? (icp.cities.some(value => normalize(value) === normalize(city)) ? 100 : 0)
    : null
  const geographyCriterion = criterion(
    'geography_fit', 'Geography fit', geographyScore,
    geographyScore === null ? 'Target cities or the lead city are unavailable.' : geographyScore ? `${city} matches a target city/hub.` : `${city} does not match the configured target cities/hubs.`,
    geographyScore === null ? [] : comparisonEvidence('geography_fit', 'city', city, 'target cities/hubs', icp.cities),
  )

  const employees = typeof lead.employees === 'number' ? lead.employees : Number(String(lead.employees ?? '').trim())
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
    companySizeScore === null ? 'Employee range or lead employee count is unavailable.' : companySizeScore ? `${employees.toLocaleString()} employees is within the configured range (${rangeLabel}).` : `${employees.toLocaleString()} employees is outside the configured range (${rangeLabel}).`,
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
  return [icpFit, industryCriterion, geographyCriterion, companySizeCriterion]
}

/** Component dimensions count once toward the overall score; ICP fit is their roll-up. */
export function calculateQualificationScore(criteria: QualificationCriterion[]): number | null {
  const scored = criteria.filter(item => item.score !== null && item.key !== 'icp_fit')
  return scored.length ? Math.round(scored.reduce((sum, item) => sum + (item.score || 0), 0) / scored.length) : null
}
