import { z } from 'zod'
import type { SheetDeal, SheetLead, SheetMeeting, SheetOutreach } from './sheets.service'

export class MeetingValidationError extends Error {}

const scheduledAt = z.string().datetime({ offset: true })
  .refine(value => Number.isFinite(Date.parse(value)), 'Supply a valid date/time with a UTC offset.')
  .transform(value => new Date(value).toISOString())
const editableFields = {
  title: z.string().trim().min(1).max(300),
  scheduledAt,
  duration: z.number().int().min(1).max(1440).nullable().optional(),
  meetingType: z.enum(['DISCOVERY', 'DEMO', 'FOLLOW_UP', 'NEGOTIATION', 'OTHER']),
  status: z.enum(['SCHEDULED', 'COMPLETED', 'CANCELLED']),
  attendees: z.string().max(5000).optional(),
  notes: z.string().max(20000).optional(),
}
const associationId = z.string().min(1).max(2000).nullable().optional()
const createSchema = z.object({
  ...editableFields,
  leadId: z.string().min(1).max(2000),
  company: z.string().min(1).max(300).optional(),
  pocId: associationId,
  outreachId: associationId,
  dealId: associationId,
}).strict()
const updateSchema = z.object(editableFields).partial().strict().refine(value => Object.keys(value).length > 0, 'Supply at least one editable field.')

function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input)
  if (!result.success) throw new MeetingValidationError(result.error.issues.map(issue => `${issue.path.join('.') || 'meeting'}: ${issue.message}`).join('; '))
  return result.data
}

/** Resolve explicit IDs against existing records. No discovery, fuzzy matching, or external calls. */
export function validateNewMeeting(input: unknown, store: { leads?: SheetLead[]; outreach?: SheetOutreach[]; deals?: SheetDeal[] }) {
  const value = parse(createSchema, input)
  const lead = (store.leads || []).find(item => item.id === value.leadId)
  if (!lead) throw new MeetingValidationError('The selected lead does not exist.')
  if (value.company !== undefined && value.company !== lead.company) throw new MeetingValidationError('Company does not match the selected lead.')

  const outreach = value.outreachId ? (store.outreach || []).find(item => item.id === value.outreachId) : null
  if (value.outreachId && !outreach) throw new MeetingValidationError('The selected outreach record does not exist.')
  if (outreach && (outreach.leadId !== lead.id || outreach.company !== lead.company)) throw new MeetingValidationError('Outreach does not belong to the selected lead/company.')

  // The active application stores sourced POC snapshots and IDs on outreach records.
  const contactRecord = value.pocId ? (store.outreach || []).find(item => item.pocId === value.pocId && item.leadId === lead.id && item.company === lead.company && item.poc?.sourceUrl && item.poc?.name) : null
  if (value.pocId && !contactRecord) throw new MeetingValidationError('The selected POC is not available on a stored outreach record for this lead.')
  if (outreach && value.pocId && outreach.pocId !== value.pocId) throw new MeetingValidationError('POC does not match the selected outreach record.')

  const deal = value.dealId ? (store.deals || []).find(item => item.id === value.dealId) : null
  if (value.dealId && !deal) throw new MeetingValidationError('The selected deal does not exist.')
  if (deal && (deal.company !== lead.company || (deal.leadId && deal.leadId !== lead.id))) throw new MeetingValidationError('Deal does not belong to the selected lead/company.')

  return {
    ...value,
    company: lead.company,
    pocId: value.pocId || null,
    poc: contactRecord?.poc ? { ...contactRecord.poc } : null,
    outreachId: value.outreachId || null,
    dealId: value.dealId || null,
    date: value.scheduledAt, // Keep the legacy field usable for existing consumers.
    duration: value.duration ?? null,
    attendees: value.attendees ?? '',
    notes: value.notes ?? '',
    source: 'MANUAL' as const,
    summary: '', actionItems: '', sentiment: '',
  }
}

export function validateMeetingUpdate(input: unknown) {
  const value = parse(updateSchema, input)
  return { ...value, ...(value.scheduledAt ? { date: value.scheduledAt } : {}) }
}

/** Reading old records must not invent associations, timestamps, or a timezone. */
export function normalizeMeeting(meeting: SheetMeeting): SheetMeeting {
  const oldDate = scheduledAt.safeParse(meeting.date)
  return {
    ...meeting,
    leadId: meeting.leadId ?? null,
    pocId: meeting.pocId ?? null,
    poc: meeting.poc ?? null,
    outreachId: meeting.outreachId ?? null,
    dealId: meeting.dealId ?? null,
    scheduledAt: meeting.scheduledAt ?? (oldDate.success ? oldDate.data : null),
    duration: meeting.duration ?? null,
    meetingType: meeting.meetingType ?? null,
    status: meeting.status ?? null,
    source: meeting.source ?? null,
    notes: meeting.notes ?? '',
    createdAt: meeting.createdAt ?? null,
    updatedAt: meeting.updatedAt ?? null,
  }
}
