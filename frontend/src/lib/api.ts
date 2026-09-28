/**
 * SalesSetu API Client
 *
 * All requests go through the Next.js rewrite proxy at /api/backend/*
 * which forwards to the Express backend (localhost:5000 in development).
 * This eliminates CORS issues and avoids hard-coding the backend port
 * in client-side code.
 */

// ── Types matching the backend response shapes ─────────────────────────────

export type QualificationStatus = 'qualified' | 'needs_review' | 'not_qualified'
export type QualificationRating = 'strong' | 'moderate' | 'weak' | 'unknown'

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
  rating: QualificationRating
  score: number | null
  assessment: string
  evidence: QualificationEvidence[]
}

export interface Lead {
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
  qualificationStatus?: QualificationStatus
  qualificationScore?: number | null
  qualificationReasons?: string[]
  qualificationCriteria?: QualificationCriterion[]
  qualificationEvidence?: QualificationEvidence[]
  qualificationUnknowns?: string[]
  qualificationUpdatedAt?: string
}

export interface LeadQualification {
  status: QualificationStatus
  score: number | null
  reasons: string[]
  criteria: QualificationCriterion[]
  evidence: QualificationEvidence[]
  unknowns: string[]
  updatedAt: string
}

export interface QualificationResponse {
  lead: Lead
  qualification: LeadQualification
}

export interface Deal {
  id: string
  title: string
  company: string
  stage: string
  value: number
  probability: number
  health: string
  nextAction: string
  createdAt?: string
}

export interface Meeting {
  id: string
  title: string
  company: string
  date: string
  attendees: string
  summary: string
  actionItems: string
  sentiment: string
}

export interface OutreachItem {
  id: string
  prospectName: string
  email: string | null
  company: string
  subject: string
  body: string
  status: 'DRAFT' | 'PENDING' | 'PENDING_APPROVAL' | 'APPROVED' | 'DELIVERY_READY' | 'SENT' | 'REJECTED'
  sentAt?: string
  leadId?: string
  pocId?: string
  poc?: { name: string; role: string | null; department: string | null; profileUrl: string | null; sourceUrl: string; confidence: number }
  channel?: 'email' | 'linkedin' | 'whatsapp'
  qualificationStatus?: QualificationStatus
  qualificationScore?: number | null
  reviewRequired?: boolean
  reviewAcknowledged?: boolean
  qualityChecks?: Array<{ key: string; status: 'PASS' | 'WARNING' | 'BLOCKED'; message: string }>
  createdAt?: string
  updatedAt?: string
  approvedAt?: string
  deliveryReadyAt?: string
}

export type FollowUpSequenceStatus = 'ACTIVE' | 'PAUSED' | 'REPLIED' | 'MEETING_BOOKED' | 'COMPLETED' | 'STOPPED'
export interface FollowUpStep {
  id: string
  step: 1 | 2 | 3
  label: string
  dayOffset: number
  status: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'DELIVERY_READY' | 'REJECTED'
  subject: string
  body: string
  createdAt: string | null
  updatedAt: string | null
  approvedAt?: string
}
export interface FollowUpSequence {
  id: string
  outreachId: string
  leadId: string
  company: string
  prospectName: string
  status: FollowUpSequenceStatus
  createdAt: string
  updatedAt: string
  steps: FollowUpStep[]
}

export interface DiscoveredPOC {
  name: string
  role: string | null
  department: string | null
  seniority: string | null
  profileUrl: string | null
  emailStatus: 'unknown' | 'unverified'
  location: string | null
  relevanceReason: string | null
  sourceUrl: string
  confidence: number
  evidenceType: 'sourced' | 'inferred' | 'unknown'
}

export interface POCDiscoveryResponse {
  lead: Lead
  status: 'complete' | 'insufficient_evidence'
  pocs: DiscoveredPOC[]
  sources: Array<{ title: string; url: string; content: string }>
  searchesPerformed: number
}

// ── Core fetcher ───────────────────────────────────────────────────────────

/** All API calls go through the Next.js proxy which rewrites to the backend. */
const PROXY_BASE = '/api/backend'

/** Timeout for all API calls in milliseconds */
const TIMEOUT_MS = 8_000

async function apiFetch<T>(path: string, init: RequestInit = {}, timeoutMs = TIMEOUT_MS): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(`${PROXY_BASE}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...init.headers,
      },
    })

    clearTimeout(timer)

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`API ${res.status}: ${body || res.statusText}`)
    }

    return res.json() as Promise<T>
  } catch (err) {
    clearTimeout(timer)
    if ((err as Error).name === 'AbortError') {
      throw new Error(`Request timed out after ${timeoutMs / 1000}s`)
    }
    throw err
  }
}

// ── Health & Status ────────────────────────────────────────────────────────

export async function getBackendHealth() {
  return apiFetch<{
    status: string
    service: string
    timestamp: string
    geminiConfigured: boolean
    storage: unknown
  }>('/health')
}

export async function getSheetsStatus() {
  return apiFetch<{
    connectedToGoogleSheets: boolean
    mode: string
    sheetId: string
    hasWebhook: boolean
    tabs: string[]
  }>('/api/sheets/status')
}

// ── Leads ──────────────────────────────────────────────────────────────────

export async function getLeads() {
  return apiFetch<{ total: number; leads: Lead[] }>('/api/sheets/leads')
}

export interface LeadSearchFilters {
  query: string
  industry: string
  city: string
  intent: string
}

export async function searchLeads(filters: LeadSearchFilters) {
  const params = new URLSearchParams()
  if (filters.query.trim()) params.set('query', filters.query.trim())
  if (filters.industry !== 'All') params.set('industry', filters.industry)
  if (filters.city !== 'All') params.set('city', filters.city)
  if (filters.intent !== 'All') params.set('intent', filters.intent)
  const queryString = params.toString()
  return apiFetch<{ total: number; leads: Lead[] }>(`/api/leads${queryString ? `?${queryString}` : ''}`)
}

export async function appendLead(lead: Omit<Lead, 'id' | 'createdAt'>) {
  return apiFetch<Lead>('/api/sheets/leads', {
    method: 'POST',
    body: JSON.stringify(lead),
  })
}

export async function discoverPOCs(leadId: string) {
  return apiFetch<POCDiscoveryResponse>(`/api/leads/${encodeURIComponent(leadId)}/pocs`, {}, 60_000)
}

export async function qualifyLead(leadId: string) {
  const unavailable = () => new Error('ICP Rulebook is unavailable in this browser/origin. Save the ICP Rulebook before qualifying.')
  if (typeof window === 'undefined') throw unavailable()

  let saved: string | null
  try {
    saved = window.localStorage.getItem('salesetu_icp_rulebook')
  } catch {
    throw unavailable()
  }
  if (!saved) throw unavailable()

  let parsed: unknown
  try {
    parsed = JSON.parse(saved)
  } catch {
    throw unavailable()
  }
  if (!isUsableQualificationIcp(parsed)) throw unavailable()

  return apiFetch<QualificationResponse>(`/api/leads/${encodeURIComponent(leadId)}/qualify`, {
    method: 'POST',
    body: JSON.stringify({ icp: parsed }),
  }, 60_000)
}

function isUsableQualificationIcp(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const rulebook = value as Record<string, unknown>
  const listFields = ['industries', 'cities', 'stages', 'intents']
  if (!listFields.every(field => Array.isArray(rulebook[field]) && (rulebook[field] as unknown[]).every(item => typeof item === 'string'))) return false
  const readBound = (field: string): number | undefined => {
    const bound = rulebook[field]
    if (bound === undefined || bound === null || bound === '') return undefined
    const parsed = typeof bound === 'number' ? bound : typeof bound === 'string' && /^\d+$/.test(bound.trim()) ? Number(bound) : NaN
    return Number.isSafeInteger(parsed) && parsed >= 0 && parsed <= 10_000_000 ? parsed : NaN
  }
  const minEmp = readBound('minEmp')
  const maxEmp = readBound('maxEmp')
  if (Number.isNaN(minEmp) || Number.isNaN(maxEmp) || Number.isNaN(readBound('minScore'))) return false
  if (minEmp !== undefined && maxEmp !== undefined && minEmp > maxEmp) return false
  const hasEmployeeBound = minEmp !== undefined || maxEmp !== undefined
  return listFields.some(field => (rulebook[field] as string[]).length > 0) || hasEmployeeBound
}

// ── Deals / Pipeline ───────────────────────────────────────────────────────

export async function getDeals() {
  return apiFetch<{ totalPipelineValue: number; deals: Deal[] }>('/api/sheets/deals')
}

export async function appendDeal(deal: Omit<Deal, 'id' | 'createdAt'>) {
  return apiFetch<Deal>('/api/sheets/deals', {
    method: 'POST',
    body: JSON.stringify(deal),
  })
}

export async function updateDealStage(id: string, stage: string) {
  return apiFetch<Deal>(`/api/sheets/deals/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ stage }),
  })
}

// ── Meetings ───────────────────────────────────────────────────────────────

export async function getMeetings() {
  return apiFetch<{ total: number; meetings: Meeting[] }>('/api/sheets/meetings')
}

export async function appendMeeting(meeting: Omit<Meeting, 'id'>) {
  return apiFetch<Meeting>('/api/sheets/meetings', {
    method: 'POST',
    body: JSON.stringify(meeting),
  })
}

// ── Outreach ───────────────────────────────────────────────────────────────

export async function getOutreach() {
  return apiFetch<{ total: number; outreach: OutreachItem[] }>('/api/sheets/outreach')
}

export async function appendOutreach(item: Omit<OutreachItem, 'id'>) {
  return apiFetch<OutreachItem>('/api/sheets/outreach', {
    method: 'POST',
    body: JSON.stringify(item),
  })
}

export async function updateOutreachStatus(id: string, status: OutreachItem['status'], reviewAcknowledged?: boolean) {
  return apiFetch<OutreachItem>(`/api/sheets/outreach/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status, ...(reviewAcknowledged === undefined ? {} : { reviewAcknowledged }) }),
  })
}

export async function editOutreach(id: string, updates: { subject?: string; body?: string }) {
  return apiFetch<OutreachItem>(`/api/sheets/outreach/${id}`, { method: 'PATCH', body: JSON.stringify(updates) })
}

export async function getFollowUpSequences() {
  return apiFetch<{ total: number; sequences: FollowUpSequence[] }>('/api/sheets/follow-up-sequences')
}

export async function createFollowUpSequence(outreachId: string) {
  return apiFetch<FollowUpSequence>('/api/sheets/follow-up-sequences', { method: 'POST', body: JSON.stringify({ outreachId }) })
}

export async function setFollowUpSequenceStatus(id: string, status: FollowUpSequenceStatus) {
  return apiFetch<FollowUpSequence>(`/api/sheets/follow-up-sequences/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) })
}

export async function generateFollowUpDraft(sequenceId: string, step: number) {
  return apiFetch<{ sequence: FollowUpSequence; step: FollowUpStep }>('/api/ai/follow-up-draft', { method: 'POST', body: JSON.stringify({ sequenceId, step }) })
}

export async function updateFollowUpStep(sequenceId: string, step: number, update: { status?: FollowUpStep['status']; subject?: string; body?: string }) {
  return apiFetch<{ sequence: FollowUpSequence; step: FollowUpStep }>(`/api/sheets/follow-up-sequences/${sequenceId}/steps/${step}`, { method: 'PATCH', body: JSON.stringify(update) })
}

// ── AI Endpoints (Gemini) ──────────────────────────────────────────────────

export async function parseICP(query: string) {
  return apiFetch<{
    industries?: string[]
    geography?: { country: string; cities: string[] }
    companySize?: { min: number; max: number }
    targetPersonas?: string[]
    painPoints?: string[]
    rawQuery?: string
    error?: string
  }>('/api/ai/icp-parse', {
    method: 'POST',
    body: JSON.stringify({ query }),
  })
}

export async function draftEmail(prospect: Record<string, unknown>) {
  return apiFetch<{ subject: string; body: string; score?: number }>(
    '/api/ai/draft-email',
    {
      method: 'POST',
      body: JSON.stringify({ prospect }),
    },
    60_000,
  )
}

export async function extractMoM(transcript: string) {
  return apiFetch<{
    summary?: string
    keyDiscussionPoints?: string[]
    actionItems?: Array<{ task: string; assignee: string; due: string }>
    dealHealthScore?: number
    sentiment?: string
    error?: string
  }>('/api/ai/extract-mom', {
    method: 'POST',
    body: JSON.stringify({ transcript }),
  })
}
