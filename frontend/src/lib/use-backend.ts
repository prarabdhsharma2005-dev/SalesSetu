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
  getMeetings, appendMeeting, updateMeeting,
  getMeetingWorkflow, generateMeetingMom, saveMeetingMom, reviewMeetingMom, createMeetingTask, updateMeetingTask,
  saveMeetingOutcome, linkMeetingDeal, reviewMeetingOutcome, applyMeetingOutcome,
  linkMeetingSequence, applyMeetingSequenceOutcome, getNextBestActions, type MeetingOutcome,
  getOutreach, appendOutreach, updateOutreachStatus, getGmailConnection, sendOutreachGmail, sendFollowUpGmail,
  editOutreach, getFollowUpSequences, getFollowUpSchedulerStatus, createFollowUpSequence, setFollowUpSequenceStatus, generateFollowUpDraft, updateFollowUpStep,
  getBackendHealth,
  parseICP, draftEmail, searchLeads, discoverPOCs, qualifyLead,
  type Lead, type LeadSearchFilters, type Deal, type NewMeeting, type MeetingDetails, type OutreachItem, type POCDiscoveryResponse, type QualificationResponse,
  type FollowUpSequenceStatus, type FollowUpStep, type DealProposal, type MeetingTask,
} from './api'
import {
  DEMO_COMPANIES, DEMO_DEALS,
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
        if (process.env.NODE_ENV === 'production') return leads
        return leads && leads.length > 0
          ? leads
          : DEMO_COMPANIES.map(demoCompanyToLead)
      } catch (error) {
        if (process.env.NODE_ENV === 'production') throw error
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
        if (process.env.NODE_ENV === 'production') return deals
        return deals && deals.length > 0
          ? deals
          : DEMO_DEALS.map(demoDealToDeal)
      } catch (error) {
        if (process.env.NODE_ENV === 'production') throw error
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

export function useMeetings() {
  return useQuery({
    queryKey: ['meetings'],
    queryFn: async () => (await getMeetings()).meetings,
    staleTime: 30_000,
  })
}

export function useMeetingDeals() {
  return useQuery({ queryKey: ['meeting-deals'], queryFn: async () => (await getDeals()).deals })
}

export function useAppendMeeting() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (meeting: NewMeeting) => appendMeeting(meeting),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['meetings'] }),
  })
}

export function useUpdateMeeting() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<MeetingDetails> }) => updateMeeting(id, updates),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['meetings'] }),
  })
}

export function useMeetingWorkflow(id: string | null) {
  return useQuery({ queryKey: ['meeting-workflow', id], queryFn: () => getMeetingWorkflow(id!), enabled: Boolean(id), staleTime: 0 })
}

function invalidateMeetingWorkflow(qc: ReturnType<typeof useQueryClient>, meetingId: string) {
  qc.invalidateQueries({ queryKey: ['meeting-workflow', meetingId] })
}

export function useGenerateMeetingMom() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: ({ meetingId, ...input }: { meetingId: string; notes: string; expectedRevision: number; replaceExisting?: boolean; replaceReviewed?: boolean }) => generateMeetingMom(meetingId, input), onSuccess: (_data, variables) => invalidateMeetingWorkflow(qc, variables.meetingId) })
}
export function useSaveMeetingMom() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: ({ meetingId, ...input }: { meetingId: string; notes: string; summary: string; discussionPoints: string[]; decisions: string[]; actionItems: Array<{ id?: string; description: string; owner?: string | null; dueDate?: string | null }>; expectedRevision: number }) => saveMeetingMom(meetingId, input), onSuccess: (_data, variables) => invalidateMeetingWorkflow(qc, variables.meetingId) })
}
export function useReviewMeetingMom() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: ({ meetingId, expectedRevision }: { meetingId: string; expectedRevision: number }) => reviewMeetingMom(meetingId, expectedRevision), onSuccess: (_data, variables) => invalidateMeetingWorkflow(qc, variables.meetingId) })
}
export function useCreateMeetingTask() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: ({ meetingId, actionItemId }: { meetingId: string; actionItemId: string }) => createMeetingTask(meetingId, actionItemId), onSuccess: (_data, variables) => invalidateMeetingWorkflow(qc, variables.meetingId) })
}
export function useUpdateMeetingTask() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (variables: { meetingId: string; taskId: string; description?: string; owner?: string | null; dueDate?: string | null; status?: MeetingTask['status']; expectedUpdatedAt: string }) => updateMeetingTask(variables.taskId, { description: variables.description, owner: variables.owner, dueDate: variables.dueDate, status: variables.status, expectedUpdatedAt: variables.expectedUpdatedAt }), onSuccess: (_data, variables) => invalidateMeetingWorkflow(qc, variables.meetingId) })
}
export function useSaveMeetingOutcome() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: ({ meetingId, ...input }: { meetingId: string; notes: string; proposedChanges: DealProposal; expectedRevision: number; sequenceStatus?: MeetingOutcome['sequenceStatus'] }) => saveMeetingOutcome(meetingId, input), onSuccess: (_data, variables) => invalidateMeetingWorkflow(qc, variables.meetingId) })
}
export function useLinkMeetingSequence() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: ({ meetingId, sequenceId, expectedUpdatedAt }: { meetingId: string; sequenceId: string; expectedUpdatedAt: string | null }) => linkMeetingSequence(meetingId, sequenceId, expectedUpdatedAt), onSuccess: (_data, variables) => { invalidateMeetingWorkflow(qc, variables.meetingId); qc.invalidateQueries({ queryKey: ['meetings'] }) } })
}
export function useApplyMeetingSequenceOutcome() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: ({ meetingId, expectedRevision }: { meetingId: string; expectedRevision: number }) => applyMeetingSequenceOutcome(meetingId, expectedRevision), onSuccess: (_data, variables) => { invalidateMeetingWorkflow(qc, variables.meetingId); qc.invalidateQueries({ queryKey: ['follow-up-sequences'] }); qc.invalidateQueries({ queryKey: ['next-best-actions'] }) } })
}
export function useNextBestActions() {
  return useQuery({ queryKey: ['next-best-actions'], queryFn: async () => (await getNextBestActions()).recommendations, staleTime: 0, refetchInterval: 30_000 })
}
export function useLinkMeetingDeal() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: ({ meetingId, dealId }: { meetingId: string; dealId: string }) => linkMeetingDeal(meetingId, dealId), onSuccess: (_data, variables) => { invalidateMeetingWorkflow(qc, variables.meetingId); qc.invalidateQueries({ queryKey: ['meetings'] }) } })
}
export function useReviewMeetingOutcome() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: ({ meetingId, expectedRevision }: { meetingId: string; expectedRevision: number }) => reviewMeetingOutcome(meetingId, expectedRevision), onSuccess: (_data, variables) => invalidateMeetingWorkflow(qc, variables.meetingId) })
}
export function useApplyMeetingOutcome() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: ({ meetingId, expectedRevision, confirmedFields }: { meetingId: string; expectedRevision: number; confirmedFields: Array<keyof DealProposal> }) => applyMeetingOutcome(meetingId, expectedRevision, confirmedFields), onSuccess: (_data, variables) => { invalidateMeetingWorkflow(qc, variables.meetingId); qc.invalidateQueries({ queryKey: ['deals'] }); qc.invalidateQueries({ queryKey: ['meeting-deals'] }) } })
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
    mutationFn: ({ id, status, expectedUpdatedAt, reviewAcknowledged }: { id: string; status: OutreachItem['status']; expectedUpdatedAt: string; reviewAcknowledged?: boolean }) =>
      updateOutreachStatus(id, status, expectedUpdatedAt, reviewAcknowledged),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['outreach'] })
    },
  })
}

export function useEditOutreach() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: ({ id, ...updates }: { id: string; subject?: string; body?: string; email?: string | null; recipientConfirmed?: boolean; expectedUpdatedAt: string }) => editOutreach(id, updates), onSuccess: () => qc.invalidateQueries({ queryKey: ['outreach'] }) })
}

export function useGmailConnection() { return useQuery({ queryKey: ['gmail-connection'], queryFn: getGmailConnection, staleTime: 15_000 }) }
export function useSendOutreachGmail() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: ({ id, expectedUpdatedAt }: { id: string; expectedUpdatedAt: string }) => sendOutreachGmail(id, expectedUpdatedAt), onSettled: () => { void qc.invalidateQueries({ queryKey: ['outreach'] }); void qc.invalidateQueries({ queryKey: ['follow-up-sequences'] }) } })
}
export function useSendFollowUpGmail() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: ({ sequenceId, step, expectedUpdatedAt }: { sequenceId: string; step: number; expectedUpdatedAt: string }) => sendFollowUpGmail(sequenceId, step, expectedUpdatedAt), onSettled: () => qc.invalidateQueries({ queryKey: ['follow-up-sequences'] }) })
}

export function useFollowUpSequences() {
  return useQuery({ queryKey: ['follow-up-sequences'], queryFn: async () => (await getFollowUpSequences()).sequences, staleTime: 10_000 })
}
export function useFollowUpSchedulerStatus() { return useQuery({ queryKey: ['follow-up-scheduler-status'], queryFn: getFollowUpSchedulerStatus, staleTime: 30_000 }) }

export function useCreateFollowUpSequence() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: createFollowUpSequence, onSuccess: () => qc.invalidateQueries({ queryKey: ['follow-up-sequences'] }) })
}

export function useSetFollowUpSequenceStatus() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: ({ id, status, expectedUpdatedAt }: { id: string; status: FollowUpSequenceStatus; expectedUpdatedAt: string }) => setFollowUpSequenceStatus(id, status, expectedUpdatedAt), onSuccess: () => qc.invalidateQueries({ queryKey: ['follow-up-sequences'] }) })
}

export function useGenerateFollowUpDraft() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: ({ sequenceId, step }: { sequenceId: string; step: number }) => generateFollowUpDraft(sequenceId, step), onSuccess: () => qc.invalidateQueries({ queryKey: ['follow-up-sequences'] }) })
}

export function useUpdateFollowUpStep() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: ({ sequenceId, step, update }: { sequenceId: string; step: number; update: { status?: FollowUpStep['status']; subject?: string; body?: string; expectedUpdatedAt: string } }) => updateFollowUpStep(sequenceId, step, update), onSuccess: () => qc.invalidateQueries({ queryKey: ['follow-up-sequences'] }) })
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
