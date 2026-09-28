'use client'

/**
 * useBackend — typed React Query hooks for every backend resource.
 *
 * Each hook:
 *   - Returns live data from the Express backend when available
 *   - Falls back to demo data immediately on error (no blank screens)
 *   - Uses React Query caching so navigating between pages is instant
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getLeads, appendLead,
  getDeals, appendDeal, updateDealStage,
  getMeetings, appendMeeting,
  getOutreach, appendOutreach, updateOutreachStatus,
  editOutreach, getFollowUpSequences, createFollowUpSequence, setFollowUpSequenceStatus, generateFollowUpDraft, updateFollowUpStep,
  getBackendHealth,
  parseICP, draftEmail, extractMoM, searchLeads, discoverPOCs, qualifyLead,
  type Lead, type LeadSearchFilters, type Deal, type Meeting, type OutreachItem, type POCDiscoveryResponse, type QualificationResponse,
  type FollowUpSequence, type FollowUpSequenceStatus, type FollowUpStep,
} from './api'
import {
  DEMO_COMPANIES, DEMO_DEALS, DEMO_MEETINGS,
} from './demo-data'

// ── Helpers ────────────────────────────────────────────────────────────────

/** Convert a DEMO_COMPANIES entry into the Lead shape the backend uses */
function demoCompanyToLead(c: typeof DEMO_COMPANIES[0]): Lead {
  return {
    id: c.id,
    company: c.name,
    website: c.website || `${c.name.toLowerCase().replace(/\s+/g, '')}.com`,
    industry: c.industry,
    country: 'India',
    city: c.city,
    employees: c.employeeCount,
    intentSignal: c.recentDevelopments || '',
    leadScore: c.leadScore,
    status: c.intentStatus === 'HOT' ? 'MEETING_SCHEDULED' : c.intentStatus === 'WARM' ? 'CONTACTED' : 'PROSPECT',
    createdAt: new Date().toISOString(),
  }
}

function demoDealToDeal(d: typeof DEMO_DEALS[0]): Deal {
  const anyD = d as Record<string, unknown>
  return {
    id: d.id,
    title: String(anyD.title || anyD.name || 'Sales Opportunity'),
    company: String(anyD.company || anyD.companyId || 'Enterprise Client'),
    stage: d.stage,
    value: typeof d.value === 'number' ? d.value : 0,
    probability: d.probability,
    health: d.health,
    nextAction: String(anyD.nextAction || anyD.nextBestAction || ''),
    createdAt: new Date().toISOString(),
  }
}

// ── Backend health ──────────────────────────────────────────────────────────

export function useBackendHealth() {
  return useQuery({
    queryKey: ['health'],
    queryFn: getBackendHealth,
    // Retry quietly; don't throw on offline backend
    retry: 1,
    staleTime: 60_000,
  })
}

// ── Leads ───────────────────────────────────────────────────────────────────

export function useLeads() {
  return useQuery({
    queryKey: ['leads'],
    queryFn: async () => {
      try {
        const { leads } = await getLeads()
        return leads && leads.length > 0
          ? leads
          : DEMO_COMPANIES.map(demoCompanyToLead)
      } catch {
        // Backend offline → use demo data so the UI never breaks
        return DEMO_COMPANIES.map(demoCompanyToLead)
      }
    },
    staleTime: 30_000,
  })
}

/** Stored backend leads only; POC discovery must not target demo IDs. */
export function usePOCLeads() {
  return useQuery({
    queryKey: ['poc-discovery-leads'],
    queryFn: async () => (await getLeads()).leads,
    staleTime: 30_000,
  })
}

export function useDiscoverPOCs() {
  return useMutation<POCDiscoveryResponse, Error, string>({
    mutationFn: discoverPOCs,
  })
}

export function useLeadSearch(filters: LeadSearchFilters) {
  return useQuery({
    queryKey: ['lead-search', filters],
    queryFn: async () => (await searchLeads(filters)).leads,
    staleTime: 30_000,
  })
}

export function useAppendLead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (lead: Omit<Lead, 'id' | 'createdAt'>) => appendLead(lead),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leads'] })
    },
  })
}

export function useQualifyLead() {
  const qc = useQueryClient()
  return useMutation<QualificationResponse, Error, string>({
    mutationFn: qualifyLead,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lead-search'] })
      qc.invalidateQueries({ queryKey: ['leads'] })
      qc.invalidateQueries({ queryKey: ['poc-discovery-leads'] })
    },
  })
}

// ── Deals / Pipeline ────────────────────────────────────────────────────────

export function useDeals() {
  return useQuery({
    queryKey: ['deals'],
    queryFn: async () => {
      try {
        const { deals } = await getDeals()
        return deals && deals.length > 0
          ? deals
          : DEMO_DEALS.map(demoDealToDeal)
      } catch {
        return DEMO_DEALS.map(demoDealToDeal)
      }
    },
    staleTime: 30_000,
  })
}

export function useAppendDeal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (deal: Omit<Deal, 'id' | 'createdAt'>) => appendDeal(deal),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deals'] })
    },
  })
}

export function useUpdateDealStage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, stage }: { id: string; stage: string }) =>
      updateDealStage(id, stage),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deals'] })
    },
  })
}

// ── Meetings ────────────────────────────────────────────────────────────────

function demoMeetingToMeeting(m: typeof DEMO_MEETINGS[0]): Meeting {
  return {
    id: m.id,
    title: m.title,
    company: m.companyId,
    date: m.scheduledAt instanceof Date
      ? m.scheduledAt.toISOString()
      : String(m.scheduledAt),
    attendees: '',
    summary: m.agenda || '',
    actionItems: '',
    sentiment: m.status === 'COMPLETED' ? 'Positive' : 'Neutral',
  }
}

export function useMeetings() {
  return useQuery({
    queryKey: ['meetings'],
    queryFn: async () => {
      try {
        const { meetings } = await getMeetings()
        return meetings && meetings.length > 0
          ? meetings
          : DEMO_MEETINGS.map(demoMeetingToMeeting)
      } catch {
        return DEMO_MEETINGS.map(demoMeetingToMeeting)
      }
    },
    staleTime: 30_000,
  })
}

export function useAppendMeeting() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (meeting: Omit<Meeting, 'id'>) => appendMeeting(meeting),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['meetings'] })
    },
  })
}

// ── Outreach ────────────────────────────────────────────────────────────────

export function useOutreach() {
  return useQuery({
    queryKey: ['outreach'],
    queryFn: async () => (await getOutreach()).outreach,
    staleTime: 30_000,
  })
}

export function useAppendOutreach() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (item: Omit<OutreachItem, 'id'>) => appendOutreach(item),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['outreach'] })
    },
  })
}

export function useUpdateOutreachStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status, reviewAcknowledged }: { id: string; status: OutreachItem['status']; reviewAcknowledged?: boolean }) =>
      updateOutreachStatus(id, status, reviewAcknowledged),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['outreach'] })
    },
  })
}

export function useEditOutreach() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: ({ id, ...updates }: { id: string; subject?: string; body?: string }) => editOutreach(id, updates), onSuccess: () => qc.invalidateQueries({ queryKey: ['outreach'] }) })
}

export function useFollowUpSequences() {
  return useQuery({ queryKey: ['follow-up-sequences'], queryFn: async () => (await getFollowUpSequences()).sequences, staleTime: 10_000 })
}

export function useCreateFollowUpSequence() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: createFollowUpSequence, onSuccess: () => qc.invalidateQueries({ queryKey: ['follow-up-sequences'] }) })
}

export function useSetFollowUpSequenceStatus() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: ({ id, status }: { id: string; status: FollowUpSequenceStatus }) => setFollowUpSequenceStatus(id, status), onSuccess: () => qc.invalidateQueries({ queryKey: ['follow-up-sequences'] }) })
}

export function useGenerateFollowUpDraft() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: ({ sequenceId, step }: { sequenceId: string; step: number }) => generateFollowUpDraft(sequenceId, step), onSuccess: () => qc.invalidateQueries({ queryKey: ['follow-up-sequences'] }) })
}

export function useUpdateFollowUpStep() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: ({ sequenceId, step, update }: { sequenceId: string; step: number; update: { status?: FollowUpStep['status']; subject?: string; body?: string } }) => updateFollowUpStep(sequenceId, step, update), onSuccess: () => qc.invalidateQueries({ queryKey: ['follow-up-sequences'] }) })
}

// ── AI ──────────────────────────────────────────────────────────────────────

export function useDraftEmail() {
  return useMutation({
    mutationFn: (prospect: Record<string, unknown>) => draftEmail(prospect),
  })
}

export function useParseICP() {
  return useMutation({
    mutationFn: (query: string) => parseICP(query),
  })
}

export function useExtractMoM() {
  return useMutation({
    mutationFn: (transcript: string) => extractMoM(transcript),
  })
}
