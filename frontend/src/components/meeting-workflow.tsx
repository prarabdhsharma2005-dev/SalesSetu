'use client'

import { useMemo, useState } from 'react'
import type { DealProposal, MeetingTask, MeetingWorkflow, MomActionItem, MeetingOutcome } from '@/lib/api'
import {
  useApplyMeetingOutcome, useCreateMeetingTask, useGenerateMeetingMom, useLinkMeetingDeal,
  useMeetingWorkflow, useReviewMeetingMom, useReviewMeetingOutcome, useSaveMeetingMom,
  useSaveMeetingOutcome, useUpdateMeetingTask,
  useLinkMeetingSequence, useApplyMeetingSequenceOutcome,
} from '@/lib/use-backend'
import { meetingButton, meetingCard } from './meeting-form'

const input = { width: '100%', padding: '9px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-1)', font: 'inherit' }
const section = { ...meetingCard, display: 'flex', flexDirection: 'column' as const, gap: '12px' }
const splitLines = (value: string) => value.split('\n').map(item => item.trim()).filter(Boolean)
const joinLines = (value: string[]) => value.join('\n')
const errorText = (cause: unknown) => cause instanceof Error ? cause.message : 'Operation failed.'

function TaskRow({ task, meetingId }: { task: MeetingTask; meetingId: string }) {
  const update = useUpdateMeetingTask()
  const [description, setDescription] = useState(task.description)
  const [owner, setOwner] = useState(task.owner || '')
  const [dueDate, setDueDate] = useState(task.dueDate || '')
  const [error, setError] = useState('')
  async function save(status = task.status) {
    setError('')
    try { await update.mutateAsync({ meetingId, taskId: task.id, description, owner: owner || null, dueDate: dueDate || null, status, expectedUpdatedAt: task.updatedAt }) }
    catch (cause) { setError(errorText(cause)) }
  }
  return <div style={{ padding: '12px', border: '1px solid var(--border)', borderRadius: '10px' }}>
    <input aria-label="Task description" style={input} value={description} onChange={event => setDescription(event.target.value)} />
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '8px' }}>
      <input aria-label="Task owner" style={input} placeholder="Owner unspecified" value={owner} onChange={event => setOwner(event.target.value)} />
      <input aria-label="Task due date" style={input} placeholder="Due date unspecified" value={dueDate} onChange={event => setDueDate(event.target.value)} />
    </div>
    <div style={{ display: 'flex', gap: '8px', marginTop: '8px', alignItems: 'center' }}>
      <button type="button" style={meetingButton} disabled={update.isPending} onClick={() => save()}>{update.isPending ? 'Saving…' : 'Save task'}</button>
      <button type="button" style={{ ...meetingButton, background: task.status === 'COMPLETED' ? 'var(--bg-elevated)' : '#10B981' }} disabled={update.isPending} onClick={() => save(task.status === 'COMPLETED' ? 'OPEN' : 'COMPLETED')}>{task.status === 'COMPLETED' ? 'Reopen' : 'Complete'}</button>
      <span>{task.status}</span>
    </div>
    {error && <p role="alert" style={{ color: '#FB7185' }}>{error}</p>}
  </div>
}

export function MeetingWorkflowPanel({ meetingId, onClose }: { meetingId: string; onClose: () => void }) {
  const query = useMeetingWorkflow(meetingId)
  if (query.isPending) return <div style={section}>Loading meeting workflow…</div>
  if (query.isError) return <div role="alert" style={section}>Could not load meeting workflow: {query.error.message}<button type="button" style={meetingButton} onClick={() => query.refetch()}>Retry</button></div>
  if (!query.data) return null
  const workflow = query.data
  const editorKey = [meetingId, workflow.mom?.revision || 0, workflow.outcome?.revision || 0, workflow.meeting.dealId || '', workflow.meeting.sequenceId || '', workflow.sequence?.updatedAt || '', ...workflow.tasks.map(task => `${task.id}:${task.updatedAt}`)].join(':')
  return <MeetingWorkflowEditor key={editorKey} workflow={workflow} onClose={onClose} />
}

function MeetingWorkflowEditor({ workflow, onClose }: { workflow: MeetingWorkflow; onClose: () => void }) {
  const meetingId = workflow.meeting.id
  const mom = workflow.mom
  const outcome = workflow.outcome
  const linkSequence = useLinkMeetingSequence(); const applySequence = useApplyMeetingSequenceOutcome()
  const [sequenceId, setSequenceId] = useState(workflow.meeting.sequenceId || '')
  const [sequenceStatus, setSequenceStatus] = useState<MeetingOutcome['sequenceStatus']>(outcome?.sequenceStatus || null)
  const [sequenceConfirmed, setSequenceConfirmed] = useState(false)
  const generate = useGenerateMeetingMom(); const saveMom = useSaveMeetingMom(); const reviewMom = useReviewMeetingMom(); const createTask = useCreateMeetingTask()
  const saveOutcome = useSaveMeetingOutcome(); const linkDeal = useLinkMeetingDeal(); const reviewOutcome = useReviewMeetingOutcome(); const applyOutcome = useApplyMeetingOutcome()
  const [notes, setNotes] = useState(mom?.notes || workflow.meeting.notes || ''); const [summary, setSummary] = useState(mom?.summary || ''); const [discussion, setDiscussion] = useState(joinLines(mom?.discussionPoints || [])); const [decisions, setDecisions] = useState(joinLines(mom?.decisions || []))
  const [actions, setActions] = useState<Array<Partial<MomActionItem> & { description: string }>>(mom?.actionItems || [])
  const [outcomeNotes, setOutcomeNotes] = useState(outcome?.notes || ''); const [stage, setStage] = useState(outcome?.proposedChanges.stage || ''); const [nextAction, setNextAction] = useState(outcome?.proposedChanges.nextAction || ''); const [value, setValue] = useState(outcome?.proposedChanges.value?.toString() || ''); const [probability, setProbability] = useState(outcome?.proposedChanges.probability?.toString() || '')
  const [dealId, setDealId] = useState(workflow.meeting.dealId || ''); const [confirmedFields, setConfirmedFields] = useState<Array<keyof DealProposal>>([])
  const [momError, setMomError] = useState(''); const [outcomeError, setOutcomeError] = useState(''); const [notice, setNotice] = useState('')

  const momDraft = useMemo(() => ({ notes, summary, discussionPoints: splitLines(discussion), decisions: splitLines(decisions), actionItems: actions.map(item => ({ ...(item.id ? { id: item.id } : {}), description: item.description, owner: item.owner || null, dueDate: item.dueDate || null })) }), [notes, summary, discussion, decisions, actions])
  const proposal = useMemo<DealProposal>(() => ({ ...(stage ? { stage } : {}), ...(nextAction.trim() ? { nextAction: nextAction.trim() } : {}), ...(value !== '' ? { value: Number(value) } : {}), ...(probability !== '' ? { probability: Number(probability) } : {}) }), [stage, nextAction, value, probability])
  const momDirty = Boolean(workflow && JSON.stringify(momDraft) !== JSON.stringify(mom ? { notes: mom.notes, summary: mom.summary, discussionPoints: mom.discussionPoints, decisions: mom.decisions, actionItems: mom.actionItems } : { notes: workflow.meeting.notes || '', summary: '', discussionPoints: [], decisions: [], actionItems: [] }))
  const outcomeDirty = Boolean(workflow && (sequenceStatus !== (outcome?.sequenceStatus || null) || outcomeNotes !== (outcome?.notes || '') || JSON.stringify(proposal) !== JSON.stringify(outcome?.proposedChanges || {})))

  async function generateDraft() {
    setMomError(''); setNotice('')
    if (!notes.trim()) { setMomError('Enter meeting notes before generating a draft.'); return }
    const replaceExisting = Boolean(mom)
    if (replaceExisting && !window.confirm('Replace the current MoM content with a new AI draft? Existing tasks will be preserved.')) return
    const replaceReviewed = mom?.status === 'REVIEWED'
    if (replaceReviewed && !window.confirm('This MoM is reviewed. Replace it with a new draft that requires review again?')) return
    try { await generate.mutateAsync({ meetingId, notes, expectedRevision: mom?.revision || 0, replaceExisting, replaceReviewed }); setNotice('AI MoM draft saved. Review it before creating tasks.') }
    catch (cause) { setMomError(errorText(cause)) }
  }
  async function saveMomDraft() {
    setMomError(''); setNotice('')
    try { await saveMom.mutateAsync({ meetingId, ...momDraft, expectedRevision: mom?.revision || 0 }); setNotice(mom?.status === 'REVIEWED' ? 'Changes saved as a draft; review is required again.' : 'MoM draft saved.') }
    catch (cause) { setMomError(errorText(cause)) }
  }
  async function markMomReviewed() {
    setMomError(''); try { await reviewMom.mutateAsync({ meetingId, expectedRevision: mom!.revision }); setNotice('MoM marked as reviewed.') } catch (cause) { setMomError(errorText(cause)) }
  }
  async function addTask(actionItemId: string) {
    setMomError(''); try { const result = await createTask.mutateAsync({ meetingId, actionItemId }); setNotice(result.created ? 'Task created.' : 'Task already exists; no duplicate was created.') } catch (cause) { setMomError(errorText(cause)) }
  }
  async function linkSelectedDeal() {
    setOutcomeError(''); if (!dealId) return
    try { await linkDeal.mutateAsync({ meetingId, dealId }); setNotice('Deal linked by explicit selection.') } catch (cause) { setOutcomeError(errorText(cause)) }
  }
  async function saveOutcomeDraft() {
    setOutcomeError(''); setNotice('')
    try { await saveOutcome.mutateAsync({ meetingId, notes: outcomeNotes, proposedChanges: proposal, sequenceStatus, expectedRevision: outcome?.revision || 0 }); setNotice(outcome?.status === 'REVIEWED' ? 'Outcome changes saved as a draft; review is required again.' : 'Outcome draft saved.') } catch (cause) { setOutcomeError(errorText(cause)) }
  }
  async function markOutcomeReviewed() {
    setOutcomeError(''); try { await reviewOutcome.mutateAsync({ meetingId, expectedRevision: outcome!.revision }); setNotice('Outcome reviewed. Confirm individual deal fields before applying.') } catch (cause) { setOutcomeError(errorText(cause)) }
  }
  async function applyProposal() {
    setOutcomeError(''); try { const result = await applyOutcome.mutateAsync({ meetingId, expectedRevision: outcome!.revision, confirmedFields }); setNotice(result.repeated ? 'This reviewed update was already applied.' : 'Confirmed deal fields applied and audited.') } catch (cause) { setOutcomeError(errorText(cause)) }
  }

  const busyMom = generate.isPending || saveMom.isPending || reviewMom.isPending || createTask.isPending
  const busyOutcome = saveOutcome.isPending || linkDeal.isPending || reviewOutcome.isPending || applyOutcome.isPending

  return <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}><div><h2 style={{ fontSize: '20px' }}>{workflow.meeting.title}</h2><p>{workflow.meeting.company} · {workflow.meeting.poc?.name || 'POC unlinked'}</p></div><button type="button" style={{ ...meetingButton, background: 'var(--bg-elevated)' }} onClick={onClose}>Close workflow</button></div>
    {notice && <p role="status" style={{ color: '#34D399' }}>{notice}</p>}

    <section style={section} aria-label="Minutes of Meeting">
      <div><h3>Minutes of Meeting</h3><p>Status: {mom?.status || 'NOT STARTED'} · Revision: {mom?.revision || 0}{momDirty ? ' · Unsaved changes' : ''}</p></div>
      <label>Meeting notes / transcript<textarea style={input} rows={7} value={notes} onChange={event => setNotes(event.target.value)} placeholder="Enter factual notes supplied by the meeting participant." /></label>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}><button type="button" style={meetingButton} disabled={busyMom} onClick={generateDraft}>{generate.isPending ? 'Generating…' : mom ? 'Regenerate draft' : 'Generate AI draft'}</button><button type="button" style={meetingButton} disabled={busyMom || !momDirty} onClick={saveMomDraft}>{saveMom.isPending ? 'Saving…' : 'Save draft'}</button>{mom && mom.status !== 'REVIEWED' && <button type="button" style={{ ...meetingButton, background: '#10B981' }} disabled={busyMom || momDirty} onClick={markMomReviewed}>{reviewMom.isPending ? 'Reviewing…' : 'Mark reviewed'}</button>}</div>
      <label>Summary<textarea style={input} rows={4} value={summary} onChange={event => setSummary(event.target.value)} /></label>
      <label>Discussion points — one per line<textarea style={input} rows={4} value={discussion} onChange={event => setDiscussion(event.target.value)} /></label>
      <label>Decisions — one per line<textarea style={input} rows={3} value={decisions} onChange={event => setDecisions(event.target.value)} /></label>
      <div><strong>Action items</strong>{actions.map((action, index) => <div key={action.id || index} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: '8px', marginTop: '8px' }}><input aria-label="Action description" style={input} value={action.description} onChange={event => setActions(items => items.map((item, i) => i === index ? { ...item, description: event.target.value } : item))} /><input aria-label="Action owner" style={input} placeholder="Owner unspecified" value={action.owner || ''} onChange={event => setActions(items => items.map((item, i) => i === index ? { ...item, owner: event.target.value || null } : item))} /><input aria-label="Action due date" style={input} placeholder="Due unspecified" value={action.dueDate || ''} onChange={event => setActions(items => items.map((item, i) => i === index ? { ...item, dueDate: event.target.value || null } : item))} /><button type="button" onClick={() => setActions(items => items.filter((_, i) => i !== index))}>Remove</button></div>)}<button type="button" style={{ ...meetingButton, marginTop: '8px' }} onClick={() => setActions(items => [...items, { description: '', owner: null, dueDate: null }])}>Add action item</button></div>
      {mom?.status === 'REVIEWED' && <div><h4>Reviewed action items</h4>{mom.actionItems.map(action => <div key={action.id} style={{ marginTop: '8px' }}><span>{action.description} · {action.owner || 'Owner unspecified'} · {action.dueDate || 'Due date unspecified'}</span><button type="button" style={{ ...meetingButton, marginLeft: '8px' }} disabled={busyMom} onClick={() => addTask(action.id)}>Create task</button></div>)}</div>}
      {momError && <p role="alert" style={{ color: '#FB7185' }}>{momError}</p>}
    </section>

    <section style={section} aria-label="Meeting tasks"><h3>Meeting tasks</h3>{workflow.tasks.length ? workflow.tasks.map(task => <TaskRow key={`${task.id}:${task.updatedAt}`} task={task} meetingId={meetingId} />) : <p>No tasks created. Review the MoM and explicitly create tasks from action items.</p>}</section>

    <section style={section} aria-label="Meeting outcome">
      <div><h3>Linked follow-up sequence</h3><p>Choose by the meeting’s saved outreach, lead and POC IDs. No sequence is selected automatically.</p>
        <select aria-label="Compatible follow-up sequence" style={input} value={sequenceId} onChange={event => setSequenceId(event.target.value)}><option value="">Select a sequence explicitly</option>{(workflow.compatibleSequences || []).map(item => <option key={item.id} value={item.id}>{item.id} · {item.status}</option>)}</select>
        <button type="button" style={meetingButton} disabled={!sequenceId || linkSequence.isPending || sequenceId === workflow.meeting.sequenceId} onClick={async () => { setOutcomeError(''); try { await linkSequence.mutateAsync({ meetingId, sequenceId, expectedUpdatedAt: workflow.meeting.updatedAt || null }) } catch (cause) { setOutcomeError(errorText(cause)) } }}>Confirm and link sequence</button>
        {!workflow.compatibleSequences?.length && <p>No compatible sequence. The meeting must reference the same stored outreach record.</p>}
        <label>Proposed sequence state<select style={input} value={sequenceStatus || ''} onChange={event => setSequenceStatus((event.target.value || null) as MeetingOutcome['sequenceStatus'])}><option value="">No change</option><option value="PAUSED">PAUSED</option><option value="STOPPED">STOPPED</option><option value="MEETING_BOOKED">MEETING_BOOKED (scheduled meeting only)</option></select></label>
        <p>This proposal is saved with the outcome and requires review. Completing a meeting never reactivates a sequence. No message is sent.</p>
        {outcome && ['REVIEWED', 'APPLIED'].includes(outcome.status) && outcome.sequenceStatus && <div>
          <p>Preview: {workflow.sequence?.status || 'Unavailable'} → {outcome.sequenceStatus} · Sequence: {outcome.reviewedSequence?.id || 'Unavailable'}</p>
          <label><input type="checkbox" checked={sequenceConfirmed} onChange={event => setSequenceConfirmed(event.target.checked)} /> Confirm this reviewed sequence change</label>
          <button type="button" style={meetingButton} disabled={!sequenceConfirmed || outcomeDirty || applySequence.isPending || workflow.sequenceApplications?.some(item => item.outcomeId === outcome.id && item.outcomeRevision === outcome.revision)} onClick={async () => { setOutcomeError(''); try { const result = await applySequence.mutateAsync({ meetingId, expectedRevision: outcome.revision }); setNotice(result.repeated ? 'Sequence change was already applied.' : 'Sequence change applied and audited; no message sent.') } catch (cause) { setOutcomeError(errorText(cause)) } }}>Apply confirmed sequence change</button>
          <p>Sequence application records: {workflow.sequenceApplications?.length || 0}</p>
        </div>}
      </div>
      <div><h3>Meeting outcome and proposed deal update</h3><p>Status: {outcome?.status || 'NOT STARTED'} · Revision: {outcome?.revision || 0}{outcomeDirty ? ' · Unsaved changes' : ''}</p></div>
      {!workflow.meeting.dealId ? <div><label>Compatible real deal<select style={input} value={dealId} onChange={event => setDealId(event.target.value)}><option value="">Select a deal explicitly</option>{workflow.compatibleDeals.map(deal => <option key={deal.id} value={deal.id}>{deal.title} · {deal.company}</option>)}</select></label><button type="button" style={{ ...meetingButton, marginTop: '8px' }} disabled={!dealId || busyOutcome} onClick={linkSelectedDeal}>Confirm and link deal</button></div> : <p>Linked deal: {workflow.deal?.title || workflow.meeting.dealId} · Link source: {workflow.meeting.dealLinkSource || 'Meeting creation association'}</p>}
      <label>Factual outcome notes<textarea style={input} rows={5} value={outcomeNotes} onChange={event => setOutcomeNotes(event.target.value)} /></label>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px' }}>
        <label>Proposed stage<select style={input} value={stage} onChange={event => setStage(event.target.value)}><option value="">No change</option>{['DISCOVERY','CONTACTED','ENGAGED','QUALIFIED','MEETING_COMPLETED','PROPOSAL','NEGOTIATION','WON','LOST','NURTURE'].map(item => <option key={item}>{item}</option>)}</select></label>
        <label>Proposed next action<input style={input} value={nextAction} onChange={event => setNextAction(event.target.value)} placeholder="No change" /></label>
        <label>Proposed value<input style={input} type="number" min="0" value={value} onChange={event => setValue(event.target.value)} placeholder="No change" /></label>
        <label>Proposed probability<input style={input} type="number" min="0" max="100" value={probability} onChange={event => setProbability(event.target.value)} placeholder="No change" /></label>
      </div>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}><button type="button" style={meetingButton} disabled={busyOutcome || !outcomeDirty} onClick={saveOutcomeDraft}>{saveOutcome.isPending ? 'Saving…' : 'Save outcome draft'}</button>{outcome && outcome.status === 'DRAFT' && <button type="button" style={{ ...meetingButton, background: '#10B981' }} disabled={busyOutcome || outcomeDirty} onClick={markOutcomeReviewed}>Review outcome</button>}</div>
      {outcome?.status === 'REVIEWED' && workflow.deal && <div style={{ border: '1px solid var(--border)', borderRadius: '10px', padding: '12px' }}><h4>Confirm fields to apply</h4>{(Object.keys(outcome.proposedChanges) as Array<keyof DealProposal>).map(field => <label key={field} style={{ display: 'block', marginTop: '8px' }}><input type="checkbox" checked={confirmedFields.includes(field)} onChange={event => setConfirmedFields(fields => event.target.checked ? [...new Set([...fields, field])] : fields.filter(item => item !== field))} /> {field}: {String(workflow.deal?.[field])} → {String(outcome.proposedChanges[field])}</label>)}<button type="button" style={{ ...meetingButton, marginTop: '12px', background: '#10B981' }} disabled={busyOutcome || confirmedFields.length === 0} onClick={applyProposal}>{applyOutcome.isPending ? 'Applying…' : 'Apply confirmed fields'}</button></div>}
      {outcome?.status === 'APPLIED' && <p>Applied at {outcome.appliedAt ? new Date(outcome.appliedAt).toLocaleString() : 'unknown time'}. Audit records: {workflow.applications.length}.</p>}
      {outcomeError && <p role="alert" style={{ color: '#FB7185' }}>{outcomeError}</p>}
    </section>
  </div>
}
