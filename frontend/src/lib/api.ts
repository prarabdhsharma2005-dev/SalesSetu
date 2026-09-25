/**
 * SalesSetu API Client
 *
 * All requests go through the Next.js rewrite proxy at /api/backend/*
 * which forwards to the Express backend (localhost:5000 in development).
 * This eliminates CORS issues and avoids hard-coding the backend port
 * in client-side code.
 */

// ── Types matching the backend response shapes ─────────────────────────────

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
  email: string
  company: string
  subject: string
  body: string
  status: 'PENDING' | 'APPROVED' | 'SENT' | 'REJECTED'
  sentAt?: string
}

// ── Core fetcher ───────────────────────────────────────────────────────────

/** All API calls go through the Next.js proxy which rewrites to the backend. */
const PROXY_BASE = '/api/backend'

/** Timeout for all API calls in milliseconds */
const TIMEOUT_MS = 8_000

async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

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
      throw new Error(`Request timed out after ${TIMEOUT_MS / 1000}s`)
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

export async function appendLead(lead: Omit<Lead, 'id' | 'createdAt'>) {
  return apiFetch<Lead>('/api/sheets/leads', {
    method: 'POST',
    body: JSON.stringify(lead),
  })
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

export async function updateOutreachStatus(id: string, status: 'PENDING' | 'APPROVED' | 'SENT' | 'REJECTED') {
  return apiFetch<OutreachItem>(`/api/sheets/outreach/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })
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
