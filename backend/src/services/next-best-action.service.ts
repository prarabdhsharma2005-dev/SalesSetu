import type { SheetLead, SheetOutreach, SheetFollowUpSequence, SheetMeeting, SheetMeetingMom, SheetMeetingOutcome, SheetMeetingTask, SheetDeal, SheetSequenceApplication } from './sheets.service'
import { calculateFollowUpDueAt } from './follow-up-automation.service'

export interface RecommendationData {
  leads: SheetLead[]; outreach: SheetOutreach[]; sequences: SheetFollowUpSequence[]; meetings: SheetMeeting[]
  moms: SheetMeetingMom[]; outcomes: SheetMeetingOutcome[]; tasks: SheetMeetingTask[]; deals: SheetDeal[]
  sequenceApplications: SheetSequenceApplication[]
}
export interface NextBestAction {
  id: string; priority: number; title: string; reason: string; href: string
  kind: 'SUGGESTION'; recordIds: Record<string, string>
}

/** Priority: qualification, overdue tasks, approvals, meetings, outcomes, due cadence, deal review.
 * Recommendations explain persisted facts; they never execute an action or imply delivery.
 */
export function recommendNextActions(data: RecommendationData, now = new Date()): NextBestAction[] {
  const result: NextBestAction[] = []
  const add = (priority: number, id: string, title: string, reason: string, href: string, recordIds: Record<string, string>) => result.push({ id, priority, title, reason, href, recordIds, kind: 'SUGGESTION' })
  const eligible = (id?: string) => data.leads.some(lead => lead.id === id && ['qualified', 'needs_review'].includes(lead.qualificationStatus || ''))
  const review = (id?: string) => data.leads.find(lead => lead.id === id)?.qualificationStatus === 'needs_review' ? ' Qualification NEEDS REVIEW; acknowledgement is required before approval.' : ''
  for (const lead of data.leads) {
    if (!lead.qualificationStatus || lead.qualificationStatus === 'not_qualified') add(10, `qualification:${lead.id}`, `Review qualification: ${lead.company}`, lead.qualificationStatus === 'not_qualified' ? 'Stored qualification blocks outreach.' : 'No qualification result is stored.', `/companies/${encodeURIComponent(lead.id)}`, { leadId: lead.id })
  }
  for (const task of data.tasks) {
    // Date-only deadlines are interpreted as UTC calendar dates; ambiguous free text is unknown.
    const due = task.dueDate && (/^\d{4}-\d{2}-\d{2}$/.test(task.dueDate) || /T.*(?:Z|[+-]\d{2}:\d{2})$/.test(task.dueDate)) ? Date.parse(task.dueDate) : NaN
    if (task.status === 'OPEN' && Number.isFinite(due) && due < now.getTime() && data.meetings.some(meeting => meeting.id === task.meetingId)) add(20, `task:${task.id}`, 'Complete overdue meeting task', `An open task has the saved deadline ${task.dueDate}.`, `/meetings?meetingId=${encodeURIComponent(task.meetingId)}`, { taskId: task.id, meetingId: task.meetingId })
  }
  for (const outreach of data.outreach) {
    if (!eligible(outreach.leadId)) continue
    if (['DRAFT', 'PENDING_APPROVAL', 'PENDING'].includes(outreach.status)) add(30, `outreach:${outreach.id}`, 'Review outreach draft', `Stored outreach is ${outreach.status}; human review is required.${review(outreach.leadId)}`, '/approvals', { outreachId: outreach.id, leadId: outreach.leadId! })
  }
  for (const meeting of data.meetings) {
    const href = `/meetings?meetingId=${encodeURIComponent(meeting.id)}`
    if (meeting.status === 'SCHEDULED' && meeting.scheduledAt && Date.parse(meeting.scheduledAt) >= now.getTime() && Date.parse(meeting.scheduledAt) <= now.getTime() + 7 * 86400000) add(40, `meeting:${meeting.id}`, 'Prepare for scheduled meeting', `A stored meeting is scheduled for ${meeting.scheduledAt}.`, href, { meetingId: meeting.id })
    if (meeting.status === 'CANCELLED') continue
    const mom = data.moms.find(item => item.meetingId === meeting.id)
    const outcome = data.outcomes.find(item => item.meetingId === meeting.id)
    if (meeting.status === 'COMPLETED' && (!mom || mom.status === 'DRAFT')) add(50, `mom:${meeting.id}`, 'Review meeting notes and MoM', mom ? 'The saved MoM is a draft.' : 'The completed meeting has no saved MoM.', href, { meetingId: meeting.id })
    if (meeting.status === 'COMPLETED' && (!outcome || outcome.status === 'DRAFT')) add(51, `outcome:${meeting.id}`, 'Review meeting outcome', 'The completed meeting has no reviewed outcome.', href, { meetingId: meeting.id })
    if (outcome?.status === 'REVIEWED' && Object.keys(outcome.proposedChanges).length) add(52, `deal-outcome:${outcome.id}`, 'Review proposed deal update', 'A reviewed outcome has deal changes awaiting explicit field confirmation.', href, { meetingId: meeting.id, outcomeId: outcome.id })
    if (outcome && ['REVIEWED', 'APPLIED'].includes(outcome.status) && outcome.sequenceStatus && !data.sequenceApplications.some(item => item.outcomeId === outcome.id && item.outcomeRevision === outcome.revision)) add(52, `sequence-outcome:${outcome.id}`, 'Review proposed sequence change', 'A reviewed outcome proposes a sequence change; explicit confirmation is still required.', href, { meetingId: meeting.id, outcomeId: outcome.id })
  }
  for (const sequence of data.sequences) {
    if (sequence.status !== 'ACTIVE' || !eligible(sequence.leadId)) continue
    for (const step of sequence.steps.filter(item => item.step > 1)) {
      if (step.body.trim() && ['DRAFT', 'PENDING_APPROVAL'].includes(step.status)) add(31, `step:${step.id}`, 'Review follow-up draft', `Follow-up step ${step.step} is ${step.status}.${review(sequence.leadId)}`, `/follow-ups#${encodeURIComponent(sequence.id)}`, { sequenceId: sequence.id, stepId: step.id, leadId: sequence.leadId })
      const due = calculateFollowUpDueAt(sequence.cadenceAnchorAt, step.dayOffset)
      if (step.status === 'DRAFT' && !step.body.trim() && due && Date.parse(due) <= now.getTime() && sequence.steps.some(previous => previous.step === step.step - 1 && previous.status === 'DELIVERY_READY')) add(60, `due:${step.id}`, 'Review due follow-up', `Step ${step.step} is due under the manual delivery-ready cadence policy; no delivery is implied.${review(sequence.leadId)}`, `/follow-ups#${encodeURIComponent(sequence.id)}`, { sequenceId: sequence.id, stepId: step.id, leadId: sequence.leadId })
    }
  }
  for (const deal of data.deals) {
    if (deal.leadId && !eligible(deal.leadId)) continue
    if (!['WON', 'LOST'].includes(deal.stage) && deal.nextAction?.trim()) add(70, `deal:${deal.id}`, 'Review recorded deal next action', `The deal has a user-stored next action: ${deal.nextAction}`, '/pipeline', { dealId: deal.id })
  }
  return result.sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id))
}
