'use client'

import { useState } from 'react'
import { useFollowUpSequences, useGenerateFollowUpDraft, useSetFollowUpSequenceStatus, useUpdateFollowUpStep } from '@/lib/use-backend'
import type { FollowUpSequenceStatus } from '@/lib/api'

const card: React.CSSProperties = { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: 20 }
const btn: React.CSSProperties = { padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--blue)', color: 'white', fontWeight: 700, cursor: 'pointer', margin: '7px 7px 0 0' }
const states: FollowUpSequenceStatus[] = ['ACTIVE', 'PAUSED', 'REPLIED', 'MEETING_BOOKED', 'COMPLETED', 'STOPPED']

export default function FollowUpsPage() {
  const { data: sequences = [], isLoading, isError } = useFollowUpSequences()
  const generate = useGenerateFollowUpDraft()
  const changeSequence = useSetFollowUpSequenceStatus()
  const changeStep = useUpdateFollowUpStep()
  const [edits, setEdits] = useState<Record<string, { subject: string; body: string }>>({})
  const [notice, setNotice] = useState('')
  async function run(action: () => Promise<unknown>, success: string) {
    setNotice('')
    try { await action(); setNotice(success) }
    catch (error) { setNotice(error instanceof Error ? error.message : 'Follow-up action failed.') }
  }
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
    <header><h1 style={{ fontSize: 28, fontWeight: 900, color: 'var(--text-1)' }}>Follow-Up Sequences</h1><p style={{ color: 'var(--text-4)', marginTop: 6 }}>Manual, persisted follow-ups. No reply detection or automatic sending is connected.</p></header>
    <div style={card}><strong>Delivery provider not connected</strong><p style={{ color: 'var(--text-4)', marginTop: 6 }}>Approved follow-ups remain unsent. Follow-up 1 defaults to day 3; Follow-up 2 to day 8 (five days later).</p></div>
    {notice && <p role="status" style={card}>{notice}</p>}{isError && <p role="alert" style={{ color: '#FB7185' }}>Could not load saved follow-up sequences.</p>}{isLoading && <p>Loading saved sequences…</p>}
    {!isLoading && !sequences.length && <div style={card}>No follow-up sequences yet. Create one from an approved outreach record in the Approval Inbox.</div>}
    {sequences.map(sequence => <section key={sequence.id} style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}><div><h2 style={{ color: 'var(--text-1)', fontSize: 18 }}>{sequence.company}</h2><p style={{ color: 'var(--text-4)' }}>{sequence.prospectName} · {sequence.status} · Created {new Date(sequence.createdAt).toLocaleString()}</p></div><label style={{ color: 'var(--text-4)' }}>Manual state<select value={sequence.status} onChange={event => run(() => changeSequence.mutateAsync({ id: sequence.id, status: event.target.value as FollowUpSequenceStatus }), `Sequence marked ${event.target.value}.`)} style={{ display: 'block', marginTop: 5, padding: 8, background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-2)', borderRadius: 7 }} disabled={['REPLIED', 'MEETING_BOOKED', 'STOPPED', 'COMPLETED'].includes(sequence.status)}>{states.map(status => <option key={status}>{status}</option>)}</select></label></div>
      {['REPLIED', 'MEETING_BOOKED', 'STOPPED', 'COMPLETED'].includes(sequence.status) && <p style={{ color: '#FBBF24', marginTop: 12 }}>This sequence is stopped; future follow-ups cannot be generated or queued. State was marked manually.</p>}
      {sequence.steps.map(step => {
        const value = edits[step.id] || { subject: step.subject, body: step.body }
        return <article key={step.id} style={{ marginTop: 14, padding: 16, borderRadius: 10, background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}><strong>{step.label}</strong><span style={{ color: 'var(--text-4)' }}>Day {step.dayOffset} · {step.status.replace('_', ' ')}</span></div>
          {step.step > 1 && step.status !== 'REJECTED' && <>
            {step.body ? <><label style={{ display: 'block', marginTop: 10, color: 'var(--text-4)' }}>Subject<input value={value.subject} onChange={event => setEdits(current => ({ ...current, [step.id]: { ...value, subject: event.target.value } }))} style={{ display: 'block', width: '100%', marginTop: 5, padding: 8, background: 'var(--bg-card)', color: 'var(--text-2)', border: '1px solid var(--border)', borderRadius: 7 }} /></label><label style={{ display: 'block', marginTop: 10, color: 'var(--text-4)' }}>Message<textarea value={value.body} onChange={event => setEdits(current => ({ ...current, [step.id]: { ...value, body: event.target.value } }))} style={{ display: 'block', width: '100%', minHeight: 100, marginTop: 5, padding: 8, background: 'var(--bg-card)', color: 'var(--text-2)', border: '1px solid var(--border)', borderRadius: 7 }} /></label></> : <p style={{ color: 'var(--text-4)', marginTop: 9 }}>No draft generated yet.</p>}
            {sequence.status === 'ACTIVE' && !step.body && <button style={btn} disabled={generate.isPending} onClick={() => run(() => generate.mutateAsync({ sequenceId: sequence.id, step: step.step }), 'Follow-up draft generated and saved.')}>Generate follow-up draft</button>}
            {sequence.status === 'ACTIVE' && step.body && step.status === 'DRAFT' && <><button style={btn} onClick={() => run(() => changeStep.mutateAsync({ sequenceId: sequence.id, step: step.step, update: { subject: value.subject, body: value.body } }), 'Draft edits saved.')}>Save edits</button><button style={btn} onClick={() => run(() => changeStep.mutateAsync({ sequenceId: sequence.id, step: step.step, update: { subject: value.subject, body: value.body } }).then(() => changeStep.mutateAsync({ sequenceId: sequence.id, step: step.step, update: { status: 'PENDING_APPROVAL' } })), 'Submitted for human approval.')}>Submit for approval</button></>}
            {sequence.status === 'ACTIVE' && step.status === 'PENDING_APPROVAL' && <><button style={btn} onClick={() => run(() => changeStep.mutateAsync({ sequenceId: sequence.id, step: step.step, update: { status: 'APPROVED' } }), 'Follow-up approved; not sent.')}>Approve</button><button style={{ ...btn, background: '#7f1d1d' }} onClick={() => run(() => changeStep.mutateAsync({ sequenceId: sequence.id, step: step.step, update: { status: 'REJECTED' } }), 'Follow-up rejected.')}>Reject</button></>}
            {sequence.status === 'ACTIVE' && step.status === 'APPROVED' && <button style={btn} onClick={() => run(() => changeStep.mutateAsync({ sequenceId: sequence.id, step: step.step, update: { status: 'DELIVERY_READY' } }), 'Follow-up marked delivery-ready; not sent.')}>Mark delivery-ready</button>}
          </>}
          {step.step === 1 && <p style={{ color: 'var(--text-4)', marginTop: 8 }}>Initial outreach is preserved in the parent outreach record.</p>}
        </article>
      })}
    </section>)}
  </div>
}
