import { z } from 'zod'
import type { SheetDeal, SheetMeeting, SheetMeetingMom, SheetMeetingOutcome, SheetMeetingTask, SheetMomActionItem, SheetFollowUpSequence, SheetOutreach } from './sheets.service'

export class MeetingWorkflowValidationError extends Error {}
export class MeetingWorkflowConflictError extends Error {}

const nullableText = (max: number) => z.string().trim().max(max).nullable().optional().transform(value => value || null)
const optionalNullableText = (max: number) => z.string().trim().max(max).nullable().optional().transform(value => value === undefined ? undefined : value || null)
const actionItemSchema = z.object({
  id: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().min(1).max(2000),
  owner: nullableText(300),
  dueDate: nullableText(100),
}).strict()

const momContentSchema = z.object({
  notes: z.string().trim().min(1, 'Meeting notes are required.').max(100_000),
  summary: z.string().trim().min(1).max(20_000),
  discussionPoints: z.array(z.string().trim().min(1).max(3000)).max(100),
  decisions: z.array(z.string().trim().min(1).max(3000)).max(100),
  actionItems: z.array(actionItemSchema).max(100),
  expectedRevision: z.number().int().min(0),
}).strict()

const generatedMomSchema = z.object({
  summary: z.string().trim().min(1).max(20_000),
  discussionPoints: z.array(z.string().trim().min(1).max(3000)).max(100),
  decisions: z.array(z.string().trim().min(1).max(3000)).max(100),
  actionItems: z.array(z.object({
    description: z.string().trim().min(1).max(2000),
    owner: nullableText(300),
    dueDate: nullableText(100),
  }).strict()).max(100),
}).strict()

const outcomeSchema = z.object({
  notes: z.string().trim().min(1, 'Outcome notes are required.').max(20_000),
  sequenceStatus: z.enum(['PAUSED', 'STOPPED', 'MEETING_BOOKED']).nullable().optional(),
  proposedChanges: z.object({
    stage: z.enum(['DISCOVERY', 'CONTACTED', 'ENGAGED', 'QUALIFIED', 'MEETING_COMPLETED', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST', 'NURTURE']).optional(),
    nextAction: z.string().trim().min(1).max(1000).optional(),
    value: z.number().finite().min(0).max(1_000_000_000_000).optional(),
    probability: z.number().int().min(0).max(100).optional(),
  }).strict(),
  expectedRevision: z.number().int().min(0),
}).strict()

function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input)
  if (!result.success) throw new MeetingWorkflowValidationError(result.error.issues.map(issue => `${issue.path.join('.') || 'request'}: ${issue.message}`).join('; '))
  return result.data
}

export function parseMomContent(input: unknown) { return parse(momContentSchema, input) }
export function parseGeneratedMom(input: unknown) { return parse(generatedMomSchema, input) }
export function parseMomGenerationRequest(input: unknown) {
  return parse(z.object({
    notes: z.string().trim().min(1, 'Meeting notes are required.').max(100_000),
    expectedRevision: z.number().int().min(0),
    replaceExisting: z.boolean().optional().default(false),
    replaceReviewed: z.boolean().optional().default(false),
  }).strict(), input)
}
export function parseExpectedRevision(input: unknown) {
  return parse(z.object({ expectedRevision: z.number().int().min(1) }).strict(), input)
}
export function parseTaskCreation(input: unknown) {
  return parse(z.object({ actionItemId: z.string().trim().min(1).max(200) }).strict(), input)
}
export function parseTaskUpdate(input: unknown) {
  return parse(z.object({
    description: z.string().trim().min(1).max(2000).optional(),
    owner: optionalNullableText(300), dueDate: optionalNullableText(100),
    status: z.enum(['OPEN', 'COMPLETED']).optional(),
    expectedUpdatedAt: z.string().datetime({ offset: true }),
  }).strict().refine(value => Object.keys(value).some(key => key !== 'expectedUpdatedAt'), 'Supply at least one task change.'), input)
}
export function parseOutcome(input: unknown) { return parse(outcomeSchema, input) }
export function parseDealLink(input: unknown) {
  return parse(z.object({ dealId: z.string().trim().min(1).max(2000), confirmed: z.literal(true) }).strict(), input)
}
export function parseOutcomeApply(input: unknown) {
  return parse(z.object({
    expectedRevision: z.number().int().min(1),
    confirmedFields: z.array(z.enum(['stage', 'nextAction', 'value', 'probability'])).min(1).max(4),
  }).strict(), input)
}

export function normalizeMomActionItems(items: Array<{ id?: string; description: string; owner?: string | null; dueDate?: string | null }>, current: SheetMomActionItem[] = [], makeId: () => string): SheetMomActionItem[] {
  const currentIds = new Set(current.map(item => item.id))
  const used = new Set<string>()
  return items.map(item => {
    const id = item.id && currentIds.has(item.id) && !used.has(item.id) ? item.id : makeId()
    used.add(id)
    return { id, description: item.description, owner: item.owner || null, dueDate: item.dueDate || null }
  })
}

export function sameMomContent(current: SheetMeetingMom, next: ReturnType<typeof parseMomContent>): boolean {
  return JSON.stringify({ notes: current.notes, summary: current.summary, discussionPoints: current.discussionPoints, decisions: current.decisions, actionItems: current.actionItems }) ===
    JSON.stringify({ notes: next.notes, summary: next.summary, discussionPoints: next.discussionPoints, decisions: next.decisions, actionItems: next.actionItems.map(item => ({ id: item.id, description: item.description, owner: item.owner || null, dueDate: item.dueDate || null })) })
}

export function sameOutcomeContent(current: SheetMeetingOutcome, next: ReturnType<typeof parseOutcome>): boolean {
  return current.notes === next.notes && (current.sequenceStatus || null) === (next.sequenceStatus || null) && JSON.stringify(current.proposedChanges) === JSON.stringify(next.proposedChanges)
}

export function parseSequenceLink(input: unknown) {
  return parse(z.object({ sequenceId: z.string().min(1).max(2000), expectedUpdatedAt: z.string().nullable(), confirmed: z.literal(true) }).strict(), input)
}
export function parseSequenceApply(input: unknown) {
  return parse(z.object({ expectedRevision: z.number().int().min(1), confirmed: z.literal(true) }).strict(), input)
}
export function sequenceCompatible(meeting: SheetMeeting, sequence: SheetFollowUpSequence, outreach: SheetOutreach[]): boolean {
  const initial = outreach.find(item => item.id === sequence.outreachId)
  return Boolean(meeting.leadId && meeting.outreachId && sequence.leadId === meeting.leadId &&
    sequence.outreachId === meeting.outreachId && initial?.leadId === meeting.leadId &&
    (!meeting.pocId || initial.pocId === meeting.pocId))
}
export function validateSequenceProposal(meeting: SheetMeeting, sequence: SheetFollowUpSequence, next: string) {
  if (!['ACTIVE', 'PAUSED'].includes(sequence.status)) throw new MeetingWorkflowConflictError('A terminal sequence cannot be changed by a meeting outcome.')
  if (next === 'MEETING_BOOKED' && (meeting.status !== 'SCHEDULED' || !meeting.scheduledAt || !Number.isFinite(Date.parse(meeting.scheduledAt)))) {
    throw new MeetingWorkflowValidationError('MEETING_BOOKED requires a scheduled meeting with a valid date.')
  }
}

export function dealCompatible(meeting: SheetMeeting, deal: SheetDeal): boolean {
  if (!meeting.leadId || !meeting.company || deal.company !== meeting.company) return false
  return !deal.leadId || deal.leadId === meeting.leadId
}

export function dealSnapshot(deal: SheetDeal) {
  return { stage: deal.stage, nextAction: deal.nextAction, value: deal.value, probability: deal.probability }
}

export function normalizeHistoricalCollections(data: Record<string, unknown>) {
  return {
    moms: Array.isArray(data.meetingMoms) ? data.meetingMoms as SheetMeetingMom[] : [],
    tasks: Array.isArray(data.meetingTasks) ? data.meetingTasks as SheetMeetingTask[] : [],
    outcomes: Array.isArray(data.meetingOutcomes) ? data.meetingOutcomes as SheetMeetingOutcome[] : [],
    applications: Array.isArray(data.meetingDealApplications) ? data.meetingDealApplications : [],
  }
}
