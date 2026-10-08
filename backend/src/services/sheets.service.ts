import fs from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'
import { readPostgresSnapshot, usesPostgres, writePostgresSnapshot } from './postgres-store.service'
import { normalizeMeeting, validateMeetingUpdate, validateNewMeeting } from './meeting.service'
import {
  MeetingWorkflowConflictError, MeetingWorkflowValidationError, dealCompatible, dealSnapshot,
  normalizeHistoricalCollections, normalizeMomActionItems, parseExpectedRevision, parseGeneratedMom, parseMomContent,
  parseOutcome, parseOutcomeApply, parseTaskCreation, parseTaskUpdate, sameMomContent, sameOutcomeContent,
  parseSequenceLink, parseSequenceApply, sequenceCompatible, validateSequenceProposal,
} from './meeting-workflow.service'

function nextIsoTimestamp(previous?: string | null): string {
  const previousTime = previous ? Date.parse(previous) : Number.NaN
  return new Date(Math.max(Date.now(), Number.isFinite(previousTime) ? previousTime + 1 : 0)).toISOString()
}

export interface SheetLead {
  id: string
  company: string
  website: string
  industry: string
  country: string
  city: string
  employees: number | string
  intentSignal: string
  leadScore: number
  status: string
  createdAt?: string
  qualificationStatus?: 'qualified' | 'needs_review' | 'not_qualified'
  qualificationScore?: number | null
  qualificationReasons?: string[]
  qualificationCriteria?: QualificationCriterion[]
  qualificationEvidence?: QualificationEvidence[]
  qualificationUnknowns?: string[]
  qualificationUpdatedAt?: string
}

export interface QualificationEvidence {
  criterion: string
  field: string
  value: string
  origin: 'source_backed' | 'sales_setu_record' | 'user_defined' | 'ai_inference' | 'unknown'
  sourceUrl: string | null
}

export interface QualificationCriterion {
  key: string
  label: string
  rating: 'strong' | 'moderate' | 'weak' | 'unknown'
  score: number | null
  assessment: string
  evidence: QualificationEvidence[]
}

export interface SheetDeal {
  id: string
  leadId?: string
  title: string
  company: string
  stage: string
  value: number
  probability: number
  health: string
  nextAction: string
  createdAt?: string
  updatedAt?: string
}

export interface SheetMeeting {
  id: string
  sequenceId?: string | null
  leadId?: string | null
  pocId?: string | null
  poc?: SheetOutreach['poc'] | null
  outreachId?: string | null
  dealId?: string | null
  dealLinkedAt?: string | null
  dealLinkSource?: 'USER_CONFIRMED' | null
  scheduledAt?: string | null
  duration?: number | null
  meetingType?: 'DISCOVERY' | 'DEMO' | 'FOLLOW_UP' | 'NEGOTIATION' | 'OTHER' | null
  status?: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | null
  source?: string | null
  notes?: string
  createdAt?: string | null
  updatedAt?: string | null
  title: string
  company: string
  date: string
  attendees: string
  summary: string
  actionItems: string
  sentiment: string
}

export interface SheetMomActionItem {
  id: string
  description: string
  owner: string | null
  dueDate: string | null
}

export interface SheetMeetingMom {
  id: string
  meetingId: string
  leadId: string | null
  company: string
  pocId: string | null
  outreachId: string | null
  dealId: string | null
  notes: string
  summary: string
  discussionPoints: string[]
  decisions: string[]
  actionItems: SheetMomActionItem[]
  status: 'DRAFT' | 'REVIEWED'
  revision: number
  createdAt: string
  updatedAt: string
  reviewedAt: string | null
}

export interface SheetMeetingTask {
  id: string
  meetingId: string
  momId: string
  actionItemId: string
  description: string
  owner: string | null
  dueDate: string | null
  status: 'OPEN' | 'COMPLETED'
  createdAt: string
  updatedAt: string
  completedAt: string | null
}

export interface SheetDealProposal {
  stage?: string
  nextAction?: string
  value?: number
  probability?: number
}

export interface SheetMeetingOutcome {
  id: string
  meetingId: string
  leadId: string | null
  company: string
  dealId: string | null
  notes: string
  proposedChanges: SheetDealProposal
  status: 'DRAFT' | 'REVIEWED' | 'APPLIED'
  revision: number
  createdAt: string
  updatedAt: string
  reviewedAt: string | null
  appliedAt: string | null
  reviewedDealSnapshot: Pick<SheetDeal, 'stage' | 'nextAction' | 'value' | 'probability'> | null
  sequenceStatus?: 'PAUSED' | 'STOPPED' | 'MEETING_BOOKED' | null
  reviewedSequence?: { id: string; status: FollowUpSequenceStatus; updatedAt: string; meetingUpdatedAt: string | null } | null
}

export interface SheetSequenceApplication {
  id: string; meetingId: string; outcomeId: string; outcomeRevision: number; sequenceId: string
  previousStatus: FollowUpSequenceStatus; status: FollowUpSequenceStatus; appliedAt: string
}

export interface SheetMeetingDealApplication {
  id: string
  meetingId: string
  outcomeId: string
  outcomeRevision: number
  dealId: string
  changedFields: SheetDealProposal
  appliedAt: string
  actorId?: string
}

export interface SheetOutreach {
  id: string
  prospectName: string
  email: string | null
  company: string
  subject: string
  body: string
  status: 'DRAFT' | 'PENDING_APPROVAL' | 'PENDING' | 'APPROVED' | 'DELIVERY_READY' | 'SENDING' | 'DELIVERY_UNKNOWN' | 'SENT' | 'REJECTED'
  sentAt?: string
  contentRevision?: number
  approvedRevision?: number | null
  recipientConfirmedAt?: string | null
  recipientSource?: 'MANUALLY_CONFIRMED' | null
  gmailMessageId?: string
  gmailThreadId?: string
  rfcMessageId?: string
  senderEmail?: string
  sendAttemptId?: string
  sendStartedAt?: string
  clientDraftId?: string
  leadId?: string
  pocId?: string
  poc?: { name: string; role: string | null; department: string | null; relevance?: string | null; profileUrl: string | null; sourceUrl: string; confidence: number }
  channel?: 'email' | 'linkedin' | 'whatsapp'
  qualificationStatus?: 'qualified' | 'needs_review'
  qualificationScore?: number | null
  reviewRequired?: boolean
  reviewAcknowledged?: boolean
  qualityChecks?: Array<{ key: string; status: 'PASS' | 'WARNING' | 'BLOCKED'; message: string }>
  createdAt?: string
  updatedAt?: string
  approvedAt?: string
  approvedBy?: string | null
  deliveryReadyAt?: string
}

export type FollowUpSequenceStatus = 'ACTIVE' | 'PAUSED' | 'REPLIED' | 'MEETING_BOOKED' | 'COMPLETED' | 'STOPPED'
export interface SheetFollowUpStep {
  id: string
  step: 1 | 2 | 3 | 4
  label: string
  dayOffset: number
  status: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'DELIVERY_READY' | 'SENDING' | 'DELIVERY_UNKNOWN' | 'SENT' | 'REJECTED'
  subject: string
  body: string
  createdAt: string | null
  updatedAt: string | null
  approvedAt?: string
  deliveryReadyAt?: string
  contentRevision?: number
  approvedRevision?: number | null
  sentAt?: string
  gmailMessageId?: string
  gmailThreadId?: string
  rfcMessageId?: string
  sendAttemptId?: string
  sendStartedAt?: string
}
export interface SheetFollowUpSequence {
  id: string
  outreachId: string
  leadId: string
  company: string
  prospectName: string
  status: FollowUpSequenceStatus
  createdAt: string
  updatedAt: string
  /** UTC scheduling anchor: confirmed sentAt for Gmail policy, or legacy DELIVERY_READY marker. */
  cadenceAnchorAt?: string | null
  anchorPolicy?: 'LEGACY_DELIVERY_READY' | 'GMAIL_SENT'
  steps: SheetFollowUpStep[]
}

export function normalizeCadenceAnchorAt(value: unknown): string | null {
  if (typeof value !== 'string' || !/(?:Z|[+-]\d{2}:\d{2})$/i.test(value)) return null
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null
}

const LOCAL_STORAGE_DIR = process.env.DATA_DIR || path.join(__dirname, '../../data')
const LOCAL_STORAGE_FILE = path.join(LOCAL_STORAGE_DIR, 'sheets_store.json')

/**
 * Service to manage SalesSetu data stored directly in Google Sheets,
 * with local caching fallback for immediate usability.
 */
export class GoogleSheetsService {
  private static get sheetId(): string {
    return process.env.GOOGLE_SHEET_ID || ''
  }
  private static get webhookUrl(): string {
    return process.env.GOOGLE_SHEETS_WEBHOOK_URL || ''
  }

  /**
   * Ensure local file storage exists for fallback / sync
   */
  private static ensureStorage() {
    if (!fs.existsSync(LOCAL_STORAGE_DIR)) {
      fs.mkdirSync(LOCAL_STORAGE_DIR, { recursive: true })
    }
    if (!fs.existsSync(LOCAL_STORAGE_FILE)) {
      if (process.env.NODE_ENV === 'production') throw new Error('Durable SalesSetu store is missing. Restore a reviewed backup before startup.')
      const initialData = {
        leads: [
          {
            id: 'lead-1',
            company: 'Zoho Corporation',
            website: 'zoho.com',
            industry: 'SaaS',
            country: 'India',
            city: 'Chennai',
            employees: 15000,
            intentSignal: 'Hiring heavily in BD & AI Expansion',
            leadScore: 72,
            status: 'PROSPECT',
            createdAt: new Date().toISOString(),
          },
          {
            id: 'lead-2',
            company: 'Razorpay',
            website: 'razorpay.com',
            industry: 'FinTech',
            country: 'India',
            city: 'Bangalore',
            employees: 3000,
            intentSignal: 'Launched Capital arm, active partnerships',
            leadScore: 91,
            status: 'CONTACTED',
            createdAt: new Date().toISOString(),
          },
          {
            id: 'lead-3',
            company: 'BrowserStack',
            website: 'browserstack.com',
            industry: 'SaaS',
            country: 'India',
            city: 'Mumbai',
            employees: 1200,
            intentSignal: 'RFP for outbound sales automation tools',
            leadScore: 94,
            status: 'MEETING_SCHEDULED',
            createdAt: new Date().toISOString(),
          },
        ],
        deals: [
          {
            id: 'deal-1',
            title: 'Enterprise AI Suite Expansion',
            company: 'BrowserStack',
            stage: 'PROPOSAL',
            value: 45000,
            probability: 75,
            health: 'STRONG',
            nextAction: 'Send updated SOC2 compliance pack',
            createdAt: new Date().toISOString(),
          },
          {
            id: 'deal-2',
            title: 'Outbound Automation Pilot',
            company: 'Razorpay',
            stage: 'DISCOVERY',
            value: 24000,
            probability: 50,
            health: 'NEEDS_ATTENTION',
            nextAction: 'Follow up with Head of Partnerships',
            createdAt: new Date().toISOString(),
          },
        ],
        meetings: [],
        outreach: [],
      }
      fs.writeFileSync(LOCAL_STORAGE_FILE, JSON.stringify(initialData, null, 2), 'utf-8')
    }
  }

  private static async readData(strict = true) {
    if (usesPostgres()) return readPostgresSnapshot()
    this.ensureStorage()
    try {
      const raw = fs.readFileSync(LOCAL_STORAGE_FILE, 'utf-8')
      return JSON.parse(raw)
    } catch (error) {
      if (strict) throw error
      return { leads: [], deals: [], meetings: [], outreach: [] }
    }
  }

  private static async writeData(data: unknown) {
    if (usesPostgres()) return writePostgresSnapshot(data as Record<string, unknown>)
    this.ensureStorage()
    const temporary = `${LOCAL_STORAGE_FILE}.${randomUUID()}.tmp`
    try {
      fs.writeFileSync(temporary, JSON.stringify(data, null, 2), { encoding: 'utf-8', mode: 0o600 })
      fs.renameSync(temporary, LOCAL_STORAGE_FILE)
    } finally {
      if (fs.existsSync(temporary)) fs.unlinkSync(temporary)
    }
  }

  /**
   * Get current connection status
   */
  static getStatus() {
    return {
      connectedToGoogleSheets: false,
      webhookConfigured: !!this.webhookUrl,
      mode: usesPostgres() ? 'POSTGRES_WITH_OPTIONAL_SHEETS_SYNC' : this.webhookUrl ? 'APPS_SCRIPT_WEBHOOK' : this.sheetId ? 'GOOGLE_SHEETS_API' : 'LOCAL_SHEET_CACHE',
      sheetId: this.sheetId || 'Not configured (using local sheet cache)',
      hasWebhook: !!this.webhookUrl,
      tabs: ['Leads', 'Deals', 'Meetings', 'Outreach'],
    }
  }

  /**
   * Send data to Google Sheet via Webhook if configured
   */
  private static async syncToGoogleSheet(action: string, tab: string, payload: unknown) {
    if (!this.webhookUrl) return { synced: false, reason: 'No webhook URL provided' }

    try {
      const response = await fetch(this.webhookUrl, {
        signal: AbortSignal.timeout(10_000),
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, tab, payload, timestamp: new Date().toISOString() }),
      })
      return { synced: response.ok, status: response.status }
    } catch (err) {
      console.warn('[GoogleSheetsService] Webhook push failed; local data retained.')
      return { synced: false, error: 'External sync failed.' }
    }
  }

  // ─── LEADS ────────────────────────────────────────────────────────────

  static async getLeads(): Promise<SheetLead[]> {
    const data = await this.readData()
    return data.leads || []
  }

  static async appendLead(lead: Omit<SheetLead, 'id' | 'createdAt'>): Promise<SheetLead> {
    const data = await this.readData()
    const newLead: SheetLead = {
      ...lead,
      id: `lead_${Date.now()}`,
      createdAt: new Date().toISOString(),
    }
    data.leads = [newLead, ...(data.leads || [])]
    await this.writeData(data)

    // Trigger sync to Google Sheet in background without delaying client response
    this.syncToGoogleSheet('APPEND', 'Leads', newLead).catch(err => {
      console.warn('[GoogleSheetsService] Background sync to sheet failed:', err)
    })
    return newLead
  }

  static async updateLead(id: string, updates: Partial<SheetLead>): Promise<SheetLead | null> {
    const data = await this.readData()
    const index = (data.leads || []).findIndex((l: SheetLead) => l.id === id)
    if (index === -1) return null

    data.leads[index] = { ...data.leads[index], ...updates }
    await this.writeData(data)
    this.syncToGoogleSheet('UPDATE', 'Leads', data.leads[index]).catch(err => {
      console.warn('[GoogleSheetsService] Background sync to sheet failed:', err)
    })
    return data.leads[index]
  }

  // ─── DEALS / PIPELINE ─────────────────────────────────────────────────

  static async getDeals(): Promise<SheetDeal[]> {
    const data = await this.readData()
    return data.deals || []
  }

  static async appendDeal(deal: Omit<SheetDeal, 'id' | 'createdAt'>): Promise<SheetDeal> {
    const data = await this.readData()
    const newDeal: SheetDeal = {
      ...deal,
      id: `deal_${Date.now()}`,
      createdAt: new Date().toISOString(),
    }
    data.deals = [newDeal, ...(data.deals || [])]
    await this.writeData(data)
    this.syncToGoogleSheet('APPEND', 'Deals', newDeal).catch(err => {
      console.warn('[GoogleSheetsService] Background sync to sheet failed:', err)
    })
    return newDeal
  }

  static async updateDealStage(id: string, stage: string): Promise<SheetDeal | null> {
    const data = await this.readData()
    const index = (data.deals || []).findIndex((d: SheetDeal) => d.id === id)
    if (index === -1) return null

    data.deals[index].stage = stage
    await this.writeData(data)
    this.syncToGoogleSheet('UPDATE', 'Deals', data.deals[index]).catch(err => {
      console.warn('[GoogleSheetsService] Background sync to sheet failed:', err)
    })
    return data.deals[index]
  }

  // ─── MEETINGS ─────────────────────────────────────────────────────────

  static async getMeetings(): Promise<SheetMeeting[]> {
    const data = await this.readData(true)
    return (data.meetings || []).map(normalizeMeeting)
  }

  static async appendMeeting(meeting: unknown): Promise<SheetMeeting> {
    const data = await this.readData(true)
    const validated = validateNewMeeting(meeting, data)
    const now = new Date().toISOString()
    const newMeeting: SheetMeeting = {
      ...validated,
      id: `meeting_${randomUUID()}`,
      createdAt: now,
      updatedAt: now,
    }
    data.meetings = [newMeeting, ...(data.meetings || [])]
    await this.writeData(data)
    this.syncToGoogleSheet('APPEND', 'Meetings', newMeeting).catch(err => {
      console.warn('[GoogleSheetsService] Background sync to sheet failed:', err)
    })
    return newMeeting
  }

  static async updateMeeting(id: string, updates: unknown): Promise<SheetMeeting | null> {
    const data = await this.readData(true)
    const index = (data.meetings || []).findIndex((meeting: SheetMeeting) => meeting.id === id)
    if (index === -1) return null
    const validated = validateMeetingUpdate(updates)
    const updated = { ...data.meetings[index], ...validated, updatedAt: new Date().toISOString() }
    data.meetings[index] = updated
    await this.writeData(data)
    this.syncToGoogleSheet('UPDATE', 'Meetings', updated).catch(err => {
      console.warn('[GoogleSheetsService] Background sync to sheet failed:', err)
    })
    return normalizeMeeting(updated)
  }

  static async getMeetingWorkflow(meetingId: string) {
    const data = await this.readData(true)
    const meeting = (data.meetings || []).find((item: SheetMeeting) => item.id === meetingId)
    if (!meeting) return null
    const collections = normalizeHistoricalCollections(data)
    const deal = meeting.dealId ? (data.deals || []).find((item: SheetDeal) => item.id === meeting.dealId) || null : null
    return {
      meeting: normalizeMeeting(meeting),
      mom: collections.moms.find(item => item.meetingId === meetingId) || null,
      tasks: collections.tasks.filter(item => item.meetingId === meetingId),
      outcome: collections.outcomes.find(item => item.meetingId === meetingId) || null,
      deal,
      compatibleDeals: meeting.leadId ? (data.deals || []).filter((item: SheetDeal) => dealCompatible(meeting, item)) : [],
      applications: collections.applications.filter((item: SheetMeetingDealApplication) => item.meetingId === meetingId),
      compatibleSequences: (data.followUpSequences || []).filter((item: SheetFollowUpSequence) => sequenceCompatible(meeting, item, data.outreach || [])),
      sequence: (data.followUpSequences || []).find((item: SheetFollowUpSequence) => item.id === meeting.sequenceId) || null,
      sequenceApplications: (data.meetingSequenceApplications || []).filter((item: SheetSequenceApplication) => item.meetingId === meetingId),
    }
  }

  static async saveMeetingMom(meetingId: string, input: unknown): Promise<SheetMeetingMom | null> {
    const data = await this.readData(true)
    const meeting = (data.meetings || []).find((item: SheetMeeting) => item.id === meetingId)
    if (!meeting) return null
    const value = parseMomContent(input)
    const collections = normalizeHistoricalCollections(data)
    const index = collections.moms.findIndex(item => item.meetingId === meetingId)
    const current = index >= 0 ? collections.moms[index] : null
    if ((current?.revision || 0) !== value.expectedRevision) throw new MeetingWorkflowConflictError('MoM changed since it was loaded. Reload before saving.')
    const actionItems = normalizeMomActionItems(value.actionItems, current?.actionItems, () => `action_${randomUUID()}`)
    const comparable = { ...value, actionItems }
    if (current && sameMomContent(current, comparable)) return current
    const now = new Date().toISOString()
    const mom: SheetMeetingMom = {
      id: current?.id || `mom_${randomUUID()}`, meetingId: meeting.id, leadId: meeting.leadId || null,
      company: meeting.company, pocId: meeting.pocId || null, outreachId: meeting.outreachId || null, dealId: meeting.dealId || null,
      notes: value.notes, summary: value.summary, discussionPoints: value.discussionPoints,
      decisions: value.decisions, actionItems, status: 'DRAFT', revision: (current?.revision || 0) + 1,
      createdAt: current?.createdAt || now, updatedAt: now, reviewedAt: null,
    }
    if (index >= 0) collections.moms[index] = mom
    else collections.moms.unshift(mom)
    data.meetingMoms = collections.moms
    await this.writeData(data)
    this.syncToGoogleSheet(index >= 0 ? 'UPDATE' : 'APPEND', 'Meeting MoM', mom).catch(err => console.warn('[GoogleSheetsService] Background sync to sheet failed:', err))
    return mom
  }

  static async saveGeneratedMeetingMom(meetingId: string, input: { notes: string; generated: unknown; expectedRevision: number; replaceExisting: boolean; replaceReviewed: boolean }): Promise<SheetMeetingMom | null> {
    const data = await this.readData(true)
    const meeting = (data.meetings || []).find((item: SheetMeeting) => item.id === meetingId)
    if (!meeting) return null
    const generated = parseGeneratedMom(input.generated)
    const collections = normalizeHistoricalCollections(data)
    const current = collections.moms.find(item => item.meetingId === meetingId)
    if ((current?.revision || 0) !== input.expectedRevision) throw new MeetingWorkflowConflictError('MoM changed during generation. The generated draft was not saved.')
    if (current && !input.replaceExisting) throw new MeetingWorkflowConflictError('A saved MoM already exists. Confirm replacement before regenerating.')
    if (current?.status === 'REVIEWED' && !input.replaceReviewed) throw new MeetingWorkflowConflictError('Reviewed MoM requires explicit replacement confirmation.')
    return this.saveMeetingMom(meetingId, {
      notes: input.notes, ...generated, expectedRevision: input.expectedRevision,
    })
  }

  static async reviewMeetingMom(meetingId: string, input: unknown): Promise<SheetMeetingMom | null> {
    const data = await this.readData(true)
    const meetingExists = (data.meetings || []).some((item: SheetMeeting) => item.id === meetingId)
    if (!meetingExists) return null
    const { expectedRevision } = parseExpectedRevision(input)
    const collections = normalizeHistoricalCollections(data)
    const index = collections.moms.findIndex(item => item.meetingId === meetingId)
    if (index < 0) throw new MeetingWorkflowValidationError('Save a MoM draft before review.')
    const current = collections.moms[index]
    if (current.revision !== expectedRevision) throw new MeetingWorkflowConflictError('MoM changed since it was loaded. Reload before review.')
    if (current.status === 'REVIEWED') return current
    const now = new Date().toISOString()
    const reviewed = { ...current, status: 'REVIEWED' as const, revision: current.revision + 1, updatedAt: now, reviewedAt: now }
    collections.moms[index] = reviewed
    data.meetingMoms = collections.moms
    await this.writeData(data)
    this.syncToGoogleSheet('UPDATE', 'Meeting MoM', reviewed).catch(err => console.warn('[GoogleSheetsService] Background sync to sheet failed:', err))
    return reviewed
  }

  static async createMeetingTask(meetingId: string, input: unknown): Promise<{ task: SheetMeetingTask; created: boolean } | null> {
    const data = await this.readData(true)
    const meetingExists = (data.meetings || []).some((item: SheetMeeting) => item.id === meetingId)
    if (!meetingExists) return null
    const { actionItemId } = parseTaskCreation(input)
    const collections = normalizeHistoricalCollections(data)
    const mom = collections.moms.find(item => item.meetingId === meetingId)
    if (!mom || mom.status !== 'REVIEWED') throw new MeetingWorkflowConflictError('Review the current MoM before creating tasks.')
    const action = mom.actionItems.find(item => item.id === actionItemId)
    if (!action) throw new MeetingWorkflowValidationError('Action item not found in the current MoM.')
    const existing = collections.tasks.find(item => item.meetingId === meetingId && (item.actionItemId === action.id || item.description.trim().toLowerCase() === action.description.trim().toLowerCase()))
    if (existing) return { task: existing, created: false }
    const now = new Date().toISOString()
    const task: SheetMeetingTask = {
      id: `task_${randomUUID()}`, meetingId, momId: mom.id, actionItemId: action.id,
      description: action.description, owner: action.owner, dueDate: action.dueDate,
      status: 'OPEN', createdAt: now, updatedAt: now, completedAt: null,
    }
    collections.tasks.unshift(task)
    data.meetingTasks = collections.tasks
    await this.writeData(data)
    this.syncToGoogleSheet('APPEND', 'Tasks', task).catch(err => console.warn('[GoogleSheetsService] Background sync to sheet failed:', err))
    return { task, created: true }
  }

  static async updateMeetingTask(taskId: string, input: unknown): Promise<SheetMeetingTask | null> {
    const data = await this.readData(true)
    const value = parseTaskUpdate(input)
    const collections = normalizeHistoricalCollections(data)
    const index = collections.tasks.findIndex(item => item.id === taskId)
    if (index < 0) return null
    const current = collections.tasks[index]
    if (current.updatedAt !== value.expectedUpdatedAt) throw new MeetingWorkflowConflictError('Task changed since it was loaded. Reload before saving.')
    const now = nextIsoTimestamp(current.updatedAt)
    const status = value.status || current.status
    const task: SheetMeetingTask = {
      ...current,
      ...(value.description !== undefined ? { description: value.description } : {}),
      ...(value.owner !== undefined ? { owner: value.owner } : {}),
      ...(value.dueDate !== undefined ? { dueDate: value.dueDate } : {}),
      status, updatedAt: now,
      completedAt: status === 'COMPLETED' ? current.completedAt || now : null,
    }
    collections.tasks[index] = task
    data.meetingTasks = collections.tasks
    await this.writeData(data)
    this.syncToGoogleSheet('UPDATE', 'Tasks', task).catch(err => console.warn('[GoogleSheetsService] Background sync to sheet failed:', err))
    return task
  }

  static async saveMeetingOutcome(meetingId: string, input: unknown): Promise<SheetMeetingOutcome | null> {
    const data = await this.readData(true)
    const meeting = (data.meetings || []).find((item: SheetMeeting) => item.id === meetingId)
    if (!meeting) return null
    const value = parseOutcome(input)
    const collections = normalizeHistoricalCollections(data)
    const index = collections.outcomes.findIndex(item => item.meetingId === meetingId)
    const current = index >= 0 ? collections.outcomes[index] : null
    if ((current?.revision || 0) !== value.expectedRevision) throw new MeetingWorkflowConflictError('Outcome changed since it was loaded. Reload before saving.')
    if (current && sameOutcomeContent(current, value)) return current
    const now = new Date().toISOString()
    const outcome: SheetMeetingOutcome = {
      id: current?.id || `outcome_${randomUUID()}`, meetingId, leadId: meeting.leadId || null, company: meeting.company,
      dealId: meeting.dealId || null, notes: value.notes, proposedChanges: value.proposedChanges,
      status: 'DRAFT', revision: (current?.revision || 0) + 1, createdAt: current?.createdAt || now,
      updatedAt: now, reviewedAt: null, appliedAt: null, reviewedDealSnapshot: null,
      sequenceStatus: value.sequenceStatus || null, reviewedSequence: null,
    }
    if (index >= 0) collections.outcomes[index] = outcome
    else collections.outcomes.unshift(outcome)
    data.meetingOutcomes = collections.outcomes
    await this.writeData(data)
    this.syncToGoogleSheet(index >= 0 ? 'UPDATE' : 'APPEND', 'Meetings', { ...outcome, recordType: 'MEETING_OUTCOME' }).catch(err => console.warn('[GoogleSheetsService] Background sync to sheet failed:', err))
    return outcome
  }

  static async linkMeetingDeal(meetingId: string, dealId: string): Promise<SheetMeeting | null> {
    const data = await this.readData(true)
    const meetingIndex = (data.meetings || []).findIndex((item: SheetMeeting) => item.id === meetingId)
    if (meetingIndex < 0) return null
    const meeting: SheetMeeting = data.meetings[meetingIndex]
    const deal = (data.deals || []).find((item: SheetDeal) => item.id === dealId)
    if (!deal) throw new MeetingWorkflowValidationError('Deal not found.')
    if (!dealCompatible(meeting, deal)) throw new MeetingWorkflowValidationError('Deal is not compatible with the meeting lead/company.')
    if (meeting.dealId === deal.id) return normalizeMeeting(meeting)
    const collections = normalizeHistoricalCollections(data)
    const protectedOutcome = collections.outcomes.find(item => item.meetingId === meetingId && item.status !== 'DRAFT')
    if (protectedOutcome) throw new MeetingWorkflowConflictError('A reviewed or applied outcome already protects the current deal association.')
    const now = new Date().toISOString()
    const updated = { ...meeting, dealId: deal.id, dealLinkedAt: now, dealLinkSource: 'USER_CONFIRMED' as const, updatedAt: now }
    data.meetings[meetingIndex] = updated
    const draftIndex = collections.outcomes.findIndex(item => item.meetingId === meetingId)
    if (draftIndex >= 0) {
      collections.outcomes[draftIndex] = { ...collections.outcomes[draftIndex], dealId: deal.id, revision: collections.outcomes[draftIndex].revision + 1, updatedAt: now, reviewedAt: null, reviewedDealSnapshot: null }
      data.meetingOutcomes = collections.outcomes
    }
    await this.writeData(data)
    this.syncToGoogleSheet('UPDATE', 'Meetings', updated).catch(err => console.warn('[GoogleSheetsService] Background sync to sheet failed:', err))
    return normalizeMeeting(updated)
  }

  static async reviewMeetingOutcome(meetingId: string, input: unknown): Promise<SheetMeetingOutcome | null> {
    const data = await this.readData(true)
    const meeting = (data.meetings || []).find((item: SheetMeeting) => item.id === meetingId)
    if (!meeting) return null
    const { expectedRevision } = parseExpectedRevision(input)
    const collections = normalizeHistoricalCollections(data)
    const index = collections.outcomes.findIndex(item => item.meetingId === meetingId)
    if (index < 0) throw new MeetingWorkflowValidationError('Save an outcome before review.')
    const current = collections.outcomes[index]
    if (current.revision !== expectedRevision) throw new MeetingWorkflowConflictError('Outcome changed since it was loaded. Reload before review.')
    if (current.status === 'REVIEWED') return current
    if (current.status === 'APPLIED') return current
    const hasProposal = Object.keys(current.proposedChanges).length > 0
    const deal = meeting.dealId ? (data.deals || []).find((item: SheetDeal) => item.id === meeting.dealId) : null
    if (hasProposal && !deal) throw new MeetingWorkflowValidationError('Link a compatible deal before reviewing a proposed deal update.')
    if (deal && !dealCompatible(meeting, deal)) throw new MeetingWorkflowValidationError('The linked deal is no longer compatible with the meeting.')
    const now = new Date().toISOString()
    const reviewed: SheetMeetingOutcome = {
      ...current, dealId: deal?.id || null, status: 'REVIEWED', revision: current.revision + 1,
      updatedAt: now, reviewedAt: now, reviewedDealSnapshot: deal ? dealSnapshot(deal) : null,
    }
    if (current.sequenceStatus) {
      const sequence = (data.followUpSequences || []).find((item: SheetFollowUpSequence) => item.id === meeting.sequenceId)
      if (!sequence || !sequenceCompatible(meeting, sequence, data.outreach || [])) throw new MeetingWorkflowValidationError('Explicitly link a compatible sequence before reviewing its status change.')
      validateSequenceProposal(meeting, sequence, current.sequenceStatus)
      reviewed.reviewedSequence = { id: sequence.id, status: sequence.status, updatedAt: sequence.updatedAt, meetingUpdatedAt: meeting.updatedAt || null }
    }
    collections.outcomes[index] = reviewed
    data.meetingOutcomes = collections.outcomes
    await this.writeData(data)
    this.syncToGoogleSheet('UPDATE', 'Meetings', { ...reviewed, recordType: 'MEETING_OUTCOME' }).catch(err => console.warn('[GoogleSheetsService] Background sync to sheet failed:', err))
    return reviewed
  }

  static async applyMeetingOutcome(meetingId: string, input: unknown): Promise<{ outcome: SheetMeetingOutcome; deal: SheetDeal; application: SheetMeetingDealApplication; repeated: boolean } | null> {
    const data = await this.readData(true)
    const meeting = (data.meetings || []).find((item: SheetMeeting) => item.id === meetingId)
    if (!meeting) return null
    const value = parseOutcomeApply(input)
    const collections = normalizeHistoricalCollections(data)
    const outcomeIndex = collections.outcomes.findIndex(item => item.meetingId === meetingId)
    if (outcomeIndex < 0) throw new MeetingWorkflowValidationError('Meeting outcome not found.')
    const outcome = collections.outcomes[outcomeIndex]
    const prior = (collections.applications as SheetMeetingDealApplication[]).find(item => item.outcomeId === outcome.id && item.outcomeRevision === value.expectedRevision)
    if (outcome.status === 'APPLIED' && prior) {
      const appliedDeal = (data.deals || []).find((item: SheetDeal) => item.id === prior.dealId)
      if (!appliedDeal) throw new MeetingWorkflowConflictError('The previously updated deal is unavailable.')
      return { outcome, deal: appliedDeal, application: prior, repeated: true }
    }
    if (outcome.status !== 'REVIEWED' || outcome.revision !== value.expectedRevision) throw new MeetingWorkflowConflictError('Review the current outcome before applying it.')
    if (!meeting.dealId || outcome.dealId !== meeting.dealId) throw new MeetingWorkflowConflictError('The reviewed deal association changed. Review the outcome again.')
    const dealIndex = (data.deals || []).findIndex((item: SheetDeal) => item.id === meeting.dealId)
    if (dealIndex < 0) throw new MeetingWorkflowValidationError('Linked deal not found.')
    const deal: SheetDeal = data.deals[dealIndex]
    if (!dealCompatible(meeting, deal)) throw new MeetingWorkflowValidationError('The linked deal is not compatible with the meeting.')
    const confirmed = [...new Set(value.confirmedFields)]
    for (const field of confirmed) {
      if (!(field in outcome.proposedChanges)) throw new MeetingWorkflowValidationError(`No proposed ${field} change is available.`)
      if (!outcome.reviewedDealSnapshot || deal[field] !== outcome.reviewedDealSnapshot[field]) throw new MeetingWorkflowConflictError(`Deal ${field} changed after review. Review the outcome again.`)
    }
    const changedFields = Object.fromEntries(confirmed.map(field => [field, outcome.proposedChanges[field]])) as SheetDealProposal
    const now = new Date().toISOString()
    const updatedDeal = { ...deal, ...changedFields, updatedAt: now }
    const appliedOutcome = { ...outcome, status: 'APPLIED' as const, appliedAt: now, updatedAt: now }
    const application: SheetMeetingDealApplication = {
      id: `deal_application_${randomUUID()}`, meetingId, outcomeId: outcome.id,
      outcomeRevision: outcome.revision, dealId: deal.id, changedFields, appliedAt: now,
    }
    data.deals[dealIndex] = updatedDeal
    collections.outcomes[outcomeIndex] = appliedOutcome
    data.meetingOutcomes = collections.outcomes
    data.meetingDealApplications = [application, ...collections.applications]
    await this.writeData(data)
    this.syncToGoogleSheet('UPDATE', 'Deals', updatedDeal).catch(err => console.warn('[GoogleSheetsService] Background sync to sheet failed:', err))
    this.syncToGoogleSheet('APPEND', 'Activity Log', { ...application, activityType: 'MEETING_OUTCOME_APPLIED' }).catch(err => console.warn('[GoogleSheetsService] Background sync to sheet failed:', err))
    return { outcome: appliedOutcome, deal: updatedDeal, application, repeated: false }
  }

  // ─── OUTREACH ─────────────────────────────────────────────────────────

  static async linkMeetingSequence(meetingId: string, input: unknown): Promise<SheetMeeting | null> {
    const value = parseSequenceLink(input)
    const data = await this.readData(true)
    const meeting: SheetMeeting | undefined = (data.meetings || []).find((item: SheetMeeting) => item.id === meetingId)
    if (!meeting) return null
    if ((meeting.updatedAt || null) !== value.expectedUpdatedAt) throw new MeetingWorkflowConflictError('Meeting changed; reload before linking.')
    const sequence = (data.followUpSequences || []).find((item: SheetFollowUpSequence) => item.id === value.sequenceId)
    if (!sequence || !sequenceCompatible(meeting, sequence, data.outreach || [])) throw new MeetingWorkflowValidationError('Sequence must match the explicit meeting outreach, lead and POC IDs.')
    if (meeting.sequenceId === sequence.id) return normalizeMeeting(meeting)
    const outcome = (data.meetingOutcomes || []).find((item: SheetMeetingOutcome) => item.meetingId === meetingId)
    if (outcome && outcome.status !== 'DRAFT') throw new MeetingWorkflowConflictError('Save the outcome as a new draft before changing its sequence association.')
    meeting.sequenceId = sequence.id
    meeting.updatedAt = nextIsoTimestamp(meeting.updatedAt)
    await this.writeData(data)
    return normalizeMeeting(meeting)
  }

  static async applyMeetingSequenceOutcome(meetingId: string, input: unknown) {
    const value = parseSequenceApply(input)
    const data = await this.readData(true)
    const meeting: SheetMeeting | undefined = (data.meetings || []).find((item: SheetMeeting) => item.id === meetingId)
    if (!meeting) return null
    const outcome: SheetMeetingOutcome | undefined = (data.meetingOutcomes || []).find((item: SheetMeetingOutcome) => item.meetingId === meetingId)
    if (!outcome || outcome.revision !== value.expectedRevision || !['REVIEWED', 'APPLIED'].includes(outcome.status)) throw new MeetingWorkflowConflictError('Review the current outcome before applying a sequence change.')
    const prior = (data.meetingSequenceApplications || []).find((item: SheetSequenceApplication) => item.outcomeId === outcome.id && item.outcomeRevision === value.expectedRevision)
    if (prior) return { application: prior as SheetSequenceApplication, repeated: true }
    const snapshot = outcome.reviewedSequence
    const sequence: SheetFollowUpSequence | undefined = (data.followUpSequences || []).find((item: SheetFollowUpSequence) => item.id === meeting.sequenceId)
    if (!outcome.sequenceStatus || !snapshot || !sequence || snapshot.id !== sequence.id || !sequenceCompatible(meeting, sequence, data.outreach || [])) throw new MeetingWorkflowConflictError('The reviewed sequence association is unavailable or changed.')
    if (sequence.updatedAt !== snapshot.updatedAt || sequence.status !== snapshot.status || (meeting.updatedAt || null) !== snapshot.meetingUpdatedAt) throw new MeetingWorkflowConflictError('Meeting or sequence changed after review. Save a revised outcome and review again.')
    validateSequenceProposal(meeting, sequence, outcome.sequenceStatus)
    const application: SheetSequenceApplication = { id: `sequence_application_${randomUUID()}`, meetingId, outcomeId: outcome.id, outcomeRevision: outcome.revision, sequenceId: sequence.id, previousStatus: sequence.status, status: outcome.sequenceStatus, appliedAt: new Date().toISOString() }
    sequence.status = outcome.sequenceStatus
    sequence.updatedAt = nextIsoTimestamp(sequence.updatedAt)
    data.meetingSequenceApplications = [application, ...(data.meetingSequenceApplications || [])]
    await this.writeData(data)
    return { application, repeated: false }
  }

  static async getRecommendationData() {
    const data = await this.readData(true)
    return { leads: data.leads || [], outreach: data.outreach || [], sequences: data.followUpSequences || [], meetings: (data.meetings || []).map(normalizeMeeting), moms: data.meetingMoms || [], outcomes: data.meetingOutcomes || [], tasks: data.meetingTasks || [], deals: data.deals || [], sequenceApplications: data.meetingSequenceApplications || [] }
  }

  static async getOutreach(): Promise<SheetOutreach[]> {
    const data = await this.readData()
    return data.outreach || []
  }

  static async appendOutreach(outreach: Omit<SheetOutreach, 'id'>): Promise<SheetOutreach> {
    const data = await this.readData()
    if (outreach.clientDraftId && (data.outreach || []).some((item: SheetOutreach) => item.clientDraftId === outreach.clientDraftId)) {
      return (data.outreach as SheetOutreach[]).find(item => item.clientDraftId === outreach.clientDraftId)!
    }
    const createdAt = new Date().toISOString()
    const newOutreach: SheetOutreach = {
      ...outreach,
      id: `outreach_${randomUUID()}`,
      createdAt: outreach.createdAt || createdAt,
      updatedAt: createdAt,
    }
    data.outreach = [newOutreach, ...(data.outreach || [])]
    await this.writeData(data)
    this.syncToGoogleSheet('APPEND', 'Outreach', newOutreach).catch(err => {
      console.warn('[GoogleSheetsService] Background sync to sheet failed:', err)
    })
    return newOutreach
  }

  static async updateOutreach(id: string, updates: Partial<SheetOutreach>, expectedUpdatedAt?: string): Promise<SheetOutreach | null> {
    const data = await this.readData()
    const index = (data.outreach || []).findIndex((o: SheetOutreach) => o.id === id)
    if (index === -1) return null
    if (expectedUpdatedAt !== undefined && data.outreach[index].updatedAt !== expectedUpdatedAt) throw new MeetingWorkflowConflictError('Outreach changed since it was loaded. Reload and review the current revision.')

    data.outreach[index] = { ...data.outreach[index], ...updates, updatedAt: nextIsoTimestamp(data.outreach[index].updatedAt) }
    await this.writeData(data)
    this.syncToGoogleSheet('UPDATE', 'Outreach', data.outreach[index]).catch(err => {
      console.warn('[GoogleSheetsService] Background sync to sheet failed:', err)
    })
    return data.outreach[index]
  }

  /** Commit Gmail confirmation and any new-policy cadence anchor in one JSON write. */
  static async confirmOutreachSent(id: string, attemptId: string, confirmation: Pick<SheetOutreach, 'gmailMessageId' | 'gmailThreadId' | 'rfcMessageId' | 'senderEmail'>) {
    const data = await this.readData()
    const index = (data.outreach || []).findIndex((item: SheetOutreach) => item.id === id)
    const item: SheetOutreach | undefined = data.outreach?.[index]
    if (!item || item.status !== 'SENDING' || item.sendAttemptId !== attemptId) throw new MeetingWorkflowConflictError('Send attempt changed before confirmation. Check the mailbox and record.')
    const sentAt = new Date().toISOString()
    const sent: SheetOutreach = { ...item, ...confirmation, status: 'SENT', sentAt, updatedAt: nextIsoTimestamp(item.updatedAt) }
    data.outreach[index] = sent
    for (const sequence of (data.followUpSequences || []) as SheetFollowUpSequence[]) {
      if (sequence.outreachId !== id || sequence.anchorPolicy !== 'GMAIL_SENT') continue
      sequence.cadenceAnchorAt = sentAt
      sequence.steps = sequence.steps.map(step => step.step === 1 ? { ...step, status: 'SENT' as const, subject: sent.subject, body: sent.body, sentAt, gmailMessageId: confirmation.gmailMessageId, gmailThreadId: confirmation.gmailThreadId, rfcMessageId: confirmation.rfcMessageId, updatedAt: sentAt } : step)
      sequence.updatedAt = nextIsoTimestamp(sequence.updatedAt)
    }
    await this.writeData(data)
    this.syncToGoogleSheet('UPDATE', 'Outreach', sent).catch(() => undefined)
    return sent
  }

  static async confirmFollowUpSent(sequenceId: string, stepNumber: number, attemptId: string, confirmation: Pick<SheetFollowUpStep, 'gmailMessageId' | 'gmailThreadId' | 'rfcMessageId'>) {
    const data = await this.readData()
    const sequence = ((data.followUpSequences || []) as SheetFollowUpSequence[]).find(item => item.id === sequenceId)
    const step = sequence?.steps.find(item => item.step === stepNumber)
    if (!sequence || !step || step.status !== 'SENDING' || step.sendAttemptId !== attemptId) throw new MeetingWorkflowConflictError('Follow-up send attempt changed before confirmation. Check the mailbox and record.')
    const sentAt = new Date().toISOString()
    sequence.steps = sequence.steps.map(item => item.id === step.id ? { ...item, ...confirmation, status: 'SENT' as const, sentAt, updatedAt: sentAt } : item)
    sequence.updatedAt = nextIsoTimestamp(sequence.updatedAt)
    await this.writeData(data)
    this.syncToGoogleSheet('UPDATE', 'Outreach', { ...sequence, recordType: 'FOLLOW_UP_SEQUENCE' }).catch(() => undefined)
    return sequence
  }

  static async getSequences(): Promise<SheetFollowUpSequence[]> {
    const data = await this.readData()
    return Array.isArray(data.followUpSequences) ? data.followUpSequences : []
  }

  static async createSequence(outreach: SheetOutreach): Promise<SheetFollowUpSequence> {
    const data = await this.readData()
    data.followUpSequences ||= []
    const existing = data.followUpSequences.find((sequence: SheetFollowUpSequence) => sequence.outreachId === outreach.id)
    if (existing) throw new Error('A follow-up sequence already exists for this outreach.')
    const now = new Date().toISOString()
    const anchorPolicy = outreach.channel === 'email' ? 'GMAIL_SENT' as const : 'LEGACY_DELIVERY_READY' as const
    const cadenceAnchorAt = anchorPolicy === 'GMAIL_SENT' ? normalizeCadenceAnchorAt(outreach.sentAt) : outreach.status === 'DELIVERY_READY' ? normalizeCadenceAnchorAt(outreach.deliveryReadyAt) : null
    const sequence: SheetFollowUpSequence = {
      id: `sequence_${randomUUID()}`,
      outreachId: outreach.id,
      leadId: outreach.leadId!,
      company: outreach.company,
      prospectName: outreach.prospectName,
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
      cadenceAnchorAt,
      anchorPolicy,
      steps: [
        { id: `step_${randomUUID()}`, step: 1, label: 'Initial outreach', dayOffset: 0, status: outreach.status === 'SENT' ? 'SENT' : outreach.status === 'DELIVERY_READY' ? 'DELIVERY_READY' : 'APPROVED', subject: outreach.subject, body: outreach.body, createdAt: outreach.createdAt || now, updatedAt: now, ...(outreach.approvedAt ? { approvedAt: outreach.approvedAt } : {}), ...(anchorPolicy === 'GMAIL_SENT' && cadenceAnchorAt ? { sentAt: cadenceAnchorAt } : cadenceAnchorAt ? { deliveryReadyAt: cadenceAnchorAt } : {}) },
        { id: `step_${randomUUID()}`, step: 2, label: 'Follow-up 1', dayOffset: 3, status: 'DRAFT', subject: '', body: '', createdAt: null, updatedAt: null },
        { id: `step_${randomUUID()}`, step: 3, label: 'Follow-up 2 / Value-add', dayOffset: 7, status: 'DRAFT', subject: '', body: '', createdAt: null, updatedAt: null },
        { id: `step_${randomUUID()}`, step: 4, label: 'Final Follow-up', dayOffset: 12, status: 'DRAFT', subject: '', body: '', createdAt: null, updatedAt: null },
      ],
    }
    data.followUpSequences.unshift(sequence)
    await this.writeData(data)
    this.syncToGoogleSheet('APPEND', 'Outreach', { ...sequence, recordType: 'FOLLOW_UP_SEQUENCE' }).catch(err => console.warn('[GoogleSheetsService] Background sync to sheet failed:', err))
    return sequence
  }

  static async updateSequence(id: string, updates: Partial<SheetFollowUpSequence>, expectedUpdatedAt?: string): Promise<SheetFollowUpSequence | null> {
    const data = await this.readData()
    const sequences = Array.isArray(data.followUpSequences) ? data.followUpSequences : []
    const index = sequences.findIndex((sequence: SheetFollowUpSequence) => sequence.id === id)
    if (index === -1) return null
    if (expectedUpdatedAt !== undefined && sequences[index].updatedAt !== expectedUpdatedAt) throw new MeetingWorkflowConflictError('Sequence changed during this operation. Reload and retry.')
    sequences[index] = { ...sequences[index], ...updates, updatedAt: nextIsoTimestamp(sequences[index].updatedAt) }
    data.followUpSequences = sequences
    await this.writeData(data)
    this.syncToGoogleSheet('UPDATE', 'Outreach', { ...sequences[index], recordType: 'FOLLOW_UP_SEQUENCE' }).catch(err => console.warn('[GoogleSheetsService] Background sync to sheet failed:', err))
    return sequences[index]
  }
}
