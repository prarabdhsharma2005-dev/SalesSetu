export type LeadSearchFilters = {
  query: string
  industry: string
  city: string
  intent: string
}

const INDUSTRIES = [
  'SaaS', 'FinTech', 'EdTech', 'HealthTech', 'E-commerce',
  'Manufacturing', 'InsurTech', 'AI Sales OS',
]

const CITIES = [
  'Bangalore', 'Bengaluru', 'Mumbai', 'Chennai', 'Hyderabad', 'Pune',
  'Delhi', 'Delhi-NCR', 'Gurgaon', 'Coimbatore',
]

function extractValue(input: string, values: string[]): { value: string; remainder: string } | undefined {
  for (const value of values) {
    const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/[- ]/g, '[- ]')
    const match = new RegExp(`(^|\\b)${escaped}(?=$|\\b)`, 'i').exec(input)
    if (match) {
      const start = match.index + match[1].length
      return {
        value,
        remainder: `${input.slice(0, match.index)} ${input.slice(start + match[0].length - match[1].length)}`,
      }
    }
  }
  return undefined
}

function cleanRemainder(value: string): string {
  return value
    .replace(/\b(?:companies|company|leads|lead|in|from|at|with|and|the|for|of|to|show|find|search)\b/gi, ' ')
    .replace(/[.,!?;:]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Extract only explicit categories/locations and canonical intent labels; keep all other terms literal. */
export function parseLeadSearch(query: string, explicit: Partial<LeadSearchFilters> = {}): LeadSearchFilters {
  let remainder = query.trim()
  const extractedIndustry = extractValue(remainder, INDUSTRIES)
  if (extractedIndustry) remainder = extractedIndustry.remainder

  const extractedCity = extractValue(remainder, CITIES)
  if (extractedCity) remainder = extractedCity.remainder

  const extractedIntent = extractValue(remainder, ['HOT', 'WARM', 'COLD'])
  if (extractedIntent) remainder = extractedIntent.remainder

  return {
    query: cleanRemainder(remainder),
    industry: explicit.industry && explicit.industry !== 'All'
      ? explicit.industry
      : extractedIndustry?.value || '',
    city: explicit.city && explicit.city !== 'All'
      ? explicit.city
      : extractedCity?.value || '',
    intent: explicit.intent && explicit.intent !== 'All'
      ? explicit.intent
      : extractedIntent?.value.toUpperCase() || '',
  }
}
