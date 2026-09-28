import { GoogleSheetsService, type SheetLead } from './sheets.service'

export type QualificationGateResult =
  | { lead: SheetLead; error?: never; status?: never; reviewRequired: boolean }
  | { lead?: never; error: string; status: 400 | 404 | 409; reviewRequired?: never }
  | null

export async function checkOutreachQualification(leadId: unknown, company: unknown): Promise<QualificationGateResult> {
  const companyName = typeof company === 'string' ? company.trim() : ''
  const id = typeof leadId === 'string' ? leadId.trim() : ''
  const leads = await GoogleSheetsService.getLeads()
  const lead = id
    ? leads.find(item => item.id === id)
    : companyName
      ? leads.find(item => item.company.trim().toLowerCase() === companyName.toLowerCase())
      : undefined

  if (id && !lead) return { status: 404, error: 'Lead not found for outreach.' }
  if (!lead) return null // Existing demo-only prospect flow has no stored lead to qualify.
  if (companyName && lead.company.trim().toLowerCase() !== companyName.toLowerCase()) {
    return { status: 400, error: 'Selected lead does not match the outreach company.' }
  }
  if (lead.qualificationStatus === 'not_qualified') {
    return { status: 409, error: 'This lead is not qualified for outreach.' }
  }
  if (lead.qualificationStatus !== 'qualified' && lead.qualificationStatus !== 'needs_review') {
    return { status: 409, error: 'This lead has not been qualified yet.' }
  }

  return { lead, reviewRequired: lead.qualificationStatus === 'needs_review' }
}
