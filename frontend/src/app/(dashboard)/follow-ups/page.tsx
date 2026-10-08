'use client'

import { useState } from 'react'
import { useFollowUpSequences, useFollowUpSchedulerStatus, useGenerateFollowUpDraft, useSetFollowUpSequenceStatus, useUpdateFollowUpStep, usePOCLeads, useOutreach, useGmailConnection, useSendFollowUpGmail } from '@/lib/use-backend'
import { NextBestActions } from '@/components/next-best-actions'
import type { FollowUpSequence, FollowUpSequenceStatus, FollowUpStep } from '@/lib/api'

const card: React.CSSProperties = { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: 20 }
const btn: React.CSSProperties = { padding: '8px 12px', borderRadius: 8, border: 0, background: 'var(--blue)', color: 'white', fontWeight: 700, cursor: 'pointer', margin: '7px 7px 0 0' }
const field: React.CSSProperties = { display: 'block', width: '100%', marginTop: 5, padding: 8, background: 'var(--bg-card)', color: 'var(--text-2)', border: '1px solid var(--border)', borderRadius: 7 }
const states: FollowUpSequenceStatus[] = ['ACTIVE', 'PAUSED', 'REPLIED', 'MEETING_BOOKED', 'COMPLETED', 'STOPPED']

function waitingReason(sequence: FollowUpSequence, step: FollowUpStep, schedulerEnabled: boolean) {
  if (step.body) return step.status === 'DRAFT' ? 'Draft requires human review.' : step.status === 'APPROVED' ? 'Approved; explicit sending is required.' : ''
  if (sequence.status !== 'ACTIVE') return 'Sequence is paused or stopped.'
  if (!sequence.cadenceAnchorAt) return sequence.anchorPolicy === 'GMAIL_SENT' ? 'Waiting for confirmed initial Gmail sending.' : 'Legacy delivery-ready anchor unavailable.'
  const due = Date.parse(sequence.cadenceAnchorAt) + step.dayOffset * 86_400_000
  if (!Number.isFinite(due)) return 'Cadence due time is invalid.'
  if (Date.now() < due) return `Waiting until ${new Date(due).toLocaleString()}.`
  const previous = sequence.steps.find(item => item.step === step.step - 1)
  if (previous?.status !== (sequence.anchorPolicy === 'GMAIL_SENT' ? 'SENT' : 'DELIVERY_READY')) return sequence.anchorPolicy === 'GMAIL_SENT' ? 'Previous message has not been confirmed SENT.' : 'Previous legacy step is not delivery-ready.'
  return schedulerEnabled ? 'Due and eligible for draft generation.' : 'Due; scheduler is disabled. Generate the draft manually.'
}

export default function FollowUpsPage() {
  const { data: sequences = [], isLoading, isError } = useFollowUpSequences()
  const scheduler = useFollowUpSchedulerStatus()
  const generate = useGenerateFollowUpDraft()
  const leads = usePOCLeads()
  const outreach = useOutreach()
  const gmail = useGmailConnection()
  const sendMutation = useSendFollowUpGmail()
  const changeSequence = useSetFollowUpSequenceStatus()
  const changeStep = useUpdateFollowUpStep()
  const [edits, setEdits] = useState<Record<string, { subject: string; body: string }>>({})
  const [preview, setPreview] = useState<string | null>(null)
  const [notice, setNotice] = useState('')

  async function run(action: () => Promise<unknown>, success: string) {
    setNotice('')
    try { await action(); setNotice(success) }
    catch (error) { setNotice(error instanceof Error ? error.message : 'Follow-up action failed.') }
  }
  async function save(sequence: FollowUpSequence, step: FollowUpStep, subject: string, body: string) {
    const result = await changeStep.mutateAsync({ sequenceId: sequence.id, step: step.step, update: { subject, body, expectedUpdatedAt: sequence.updatedAt } })
    setEdits(current => { const next = { ...current }; delete next[step.id]; return next })
    return result.sequence
  }
  async function transition(sequence: FollowUpSequence, step: FollowUpStep, status: FollowUpStep['status']) {
    await changeStep.mutateAsync({ sequenceId: sequence.id, step: step.step, update: { status, expectedUpdatedAt: sequence.updatedAt } })
  }

  return <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
    <header><h1 style={{ fontSize: 28, fontWeight: 900, color: 'var(--text-1)' }}>Follow-Up Sequences</h1><p style={{ color: 'var(--text-4)', marginTop: 6 }}>Due processing creates drafts only. Approval and explicit Gmail sending remain separate.</p></header>
    <div style={card}><strong>Scheduler: {scheduler.data?.enabled ? 'Enabled' : 'Disabled'}</strong><p>Gmail: {gmail.data?.connected ? `Connected as ${gmail.data.senderEmail}` : 'Not connected'} · Reply detection is manual.</p></div>
    {notice && <p role="status" style={card}>{notice}</p>}{isError && <p role="alert" style={{ color: '#FB7185' }}>Could not load saved follow-up sequences.</p>}{isLoading && <p>Loading saved sequences…</p>}
    {!isLoading && !sequences.length && <div style={card}>No follow-up sequences yet. Create one after an initial Gmail send in the Approval Inbox.</div>}
    <NextBestActions />
    {sequences.map(sequence => {
      const initial = outreach.data?.find(item => item.id === sequence.outreachId)
      return <section id={sequence.id} key={sequence.id} style={card}>
        <h2 style={{ color: 'var(--text-1)', fontSize: 18 }}>{sequence.company}</h2>
        <p>{sequence.prospectName} · {sequence.status} · Qualification: {leads.data?.find(lead => lead.id === sequence.leadId)?.qualificationStatus?.replace('_', ' ').toUpperCase() || 'UNKNOWN'}</p>
        <p>{sequence.anchorPolicy === 'GMAIL_SENT' ? 'Gmail cadence: confirmed initial send' : 'Legacy cadence: DELIVERY_READY was an old scheduling marker, not proof of sending'} · Anchor: {sequence.cadenceAnchorAt ? new Date(sequence.cadenceAnchorAt).toLocaleString() : 'Waiting'}</p>
        <label>Manual sequence state<select value={sequence.status} onChange={event => run(() => changeSequence.mutateAsync({ id: sequence.id, status: event.target.value as FollowUpSequenceStatus, expectedUpdatedAt: sequence.updatedAt }), `Sequence marked ${event.target.value}.`)} style={{ ...field, maxWidth: 220 }} disabled={['REPLIED', 'MEETING_BOOKED', 'STOPPED', 'COMPLETED'].includes(sequence.status)}>{states.map(status => <option key={status}>{status}</option>)}</select></label>
        {['REPLIED', 'MEETING_BOOKED', 'STOPPED', 'COMPLETED'].includes(sequence.status) && <p style={{ color: '#FBBF24' }}>This sequence is stopped. No further draft or send will proceed.</p>}
        {sequence.steps.map(step => {
          const value = edits[step.id] || { subject: step.subject, body: step.body }
          const dirty = value.subject !== step.subject || value.body !== step.body
          const key = `${sequence.id}:${step.step}`
          const reason = step.step > 1 ? waitingReason(sequence, step, Boolean(scheduler.data?.enabled)) : ''
          const canSend = sequence.anchorPolicy === 'GMAIL_SENT' && step.status === 'APPROVED' && step.approvedRevision === (step.contentRevision || 1) && gmail.data?.connected && initial?.recipientConfirmedAt && initial.recipientSource === 'MANUALLY_CONFIRMED' && initial.email
          const dueAt = sequence.cadenceAnchorAt ? Date.parse(sequence.cadenceAnchorAt) + step.dayOffset * 86_400_000 : NaN
          const predecessor = sequence.steps.find(item => item.step === step.step - 1)
          const mayGenerate = sequence.status === 'ACTIVE' && Number.isFinite(dueAt) && Date.now() >= dueAt && predecessor?.status === (sequence.anchorPolicy === 'GMAIL_SENT' ? 'SENT' : 'DELIVERY_READY')
          return <article key={step.id} style={{ marginTop: 14, padding: 16, borderRadius: 10, background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
            <strong>{step.label}</strong> · Day {step.dayOffset} · {step.status.replace('_', ' ')}
            {sequence.cadenceAnchorAt && <p>Due: {new Date(Date.parse(sequence.cadenceAnchorAt) + step.dayOffset * 86_400_000).toLocaleString()}</p>}
            {reason && <p style={{ color: 'var(--text-4)' }}>{reason}</p>}
            {step.step === 1 && <p>Initial outreach is preserved in its parent record. {step.sentAt ? `Gmail sent: ${new Date(step.sentAt).toLocaleString()}` : ''}</p>}
            {step.step > 1 && step.status === 'REJECTED' && <button type="button" style={btn} onClick={() => run(() => transition(sequence, step, 'DRAFT'), 'Follow-up reopened as a draft.')}>Reopen rejected draft</button>}
            {step.step > 1 && ['DRAFT', 'PENDING_APPROVAL', 'APPROVED'].includes(step.status) && step.body && <>
              <label style={{ display: 'block' }}>Subject<input style={field} value={value.subject} onChange={event => setEdits(current => ({ ...current, [step.id]: { ...value, subject: event.target.value } }))} /></label>
              <label style={{ display: 'block' }}>Message<textarea style={{ ...field, minHeight: 110 }} value={value.body} onChange={event => setEdits(current => ({ ...current, [step.id]: { ...value, body: event.target.value } }))} /></label>
              {dirty && <p style={{ color: '#FBBF24' }}>Save edits first; changes invalidate approval.</p>}
              <button type="button" style={btn} disabled={!dirty || changeStep.isPending} onClick={() => run(() => save(sequence, step, value.subject, value.body), 'Edits saved; review is required.')}>Save edits</button>
            </>}
            {step.step > 1 && sequence.status === 'ACTIVE' && !step.body && step.status === 'DRAFT' && <button type="button" style={btn} disabled={generate.isPending || !mayGenerate} onClick={() => run(() => generate.mutateAsync({ sequenceId: sequence.id, step: step.step }), 'Due follow-up draft generated and saved.')}>Generate due draft</button>}
            {step.step > 1 && sequence.status === 'ACTIVE' && step.body && step.status === 'DRAFT' && <button type="button" style={btn} disabled={dirty || changeStep.isPending} onClick={() => run(() => transition(sequence, step, 'PENDING_APPROVAL'), 'Submitted for human approval.')}>Submit for approval</button>}
            {step.step > 1 && sequence.status === 'ACTIVE' && step.status === 'PENDING_APPROVAL' && <><button type="button" style={btn} disabled={dirty || changeStep.isPending} onClick={() => run(() => transition(sequence, step, 'APPROVED'), 'Exact follow-up revision approved; not sent.')}>Approve saved revision</button><button type="button" style={{ ...btn, background: '#7f1d1d' }} disabled={changeStep.isPending} onClick={() => run(() => transition(sequence, step, 'REJECTED'), 'Follow-up rejected.')}>Reject</button></>}
            {step.step > 1 && sequence.status === 'ACTIVE' && step.status === 'APPROVED' && sequence.anchorPolicy !== 'GMAIL_SENT' && <button type="button" style={btn} onClick={() => run(() => transition(sequence, step, 'DELIVERY_READY'), 'Legacy step marked delivery-ready; not sent.')}>Mark legacy delivery-ready</button>}
            {step.step > 1 && sequence.status === 'ACTIVE' && step.status === 'APPROVED' && sequence.anchorPolicy === 'GMAIL_SENT' && <button type="button" style={btn} disabled={!canSend || dirty || sendMutation.isPending} onClick={() => setPreview(key)}>Preview Gmail send</button>}
            {preview === key && canSend && <div style={{ ...card, marginTop: 10 }}><strong>Final Gmail preview</strong><p>From: {gmail.data?.senderEmail}<br />To: {initial?.email}<br />Subject: {step.subject}</p><pre style={{ whiteSpace: 'pre-wrap' }}>{step.body}</pre><button type="button" style={btn} disabled={sendMutation.isPending} onClick={() => run(async () => { await sendMutation.mutateAsync({ sequenceId: sequence.id, step: step.step, expectedUpdatedAt: sequence.updatedAt }); setPreview(null) }, 'Gmail confirmed follow-up sending.')}>{sendMutation.isPending ? 'Sending…' : 'Confirm and send through Gmail'}</button><button type="button" style={btn} onClick={() => setPreview(null)}>Cancel</button></div>}
            {step.status === 'DELIVERY_UNKNOWN' && <p style={{ color: '#FBBF24' }}>Gmail outcome unknown. Check the mailbox; retry is blocked.</p>}
            {step.status === 'SENT' && <p>Gmail confirmed sent at {step.sentAt ? new Date(step.sentAt).toLocaleString() : 'unknown time'}.</p>}
          </article>
        })}
      </section>
    })}
  </div>
}
