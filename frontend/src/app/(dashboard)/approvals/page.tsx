'use client'

import { useState } from 'react'
import { useCreateFollowUpSequence, useEditOutreach, useOutreach, useUpdateOutreachStatus } from '@/lib/use-backend'
import type { OutreachItem } from '@/lib/api'

const box: React.CSSProperties = { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: 20 }
const btn: React.CSSProperties = { padding: '9px 14px', borderRadius: 8, background: 'var(--blue)', color: 'white', border: 0, fontWeight: 700, cursor: 'pointer', marginRight: 8 }
const isHttpUrl = (value: string | null | undefined) => {
  if (!value) return false
  try { const url = new URL(value); return url.protocol === 'http:' || url.protocol === 'https:' } catch { return false }
}
const canReady = (item: OutreachItem) => item.channel === 'email'
  ? Boolean(item.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item.email.trim()))
  : item.channel === 'linkedin' ? isHttpUrl(item.poc?.profileUrl) : false

export default function ApprovalsPage() {
  const { data: outreach = [], isLoading, isError } = useOutreach()
  const statusMutation = useUpdateOutreachStatus()
  const editMutation = useEditOutreach()
  const sequenceMutation = useCreateFollowUpSequence()
  const [edits, setEdits] = useState<Record<string, { subject: string; body: string }>>({})
  const [notice, setNotice] = useState('')
  const actionable = outreach.filter(item => ['PENDING', 'PENDING_APPROVAL', 'APPROVED', 'DELIVERY_READY', 'REJECTED'].includes(item.status))
  async function action(id: string, status: OutreachItem['status']) {
    setNotice('')
    try { await statusMutation.mutateAsync({ id, status }); setNotice(status === 'APPROVED' ? 'Human approval saved. No message was sent.' : status === 'REJECTED' ? 'Draft rejected.' : 'Delivery-ready state saved; no message was sent.') }
    catch (error) { setNotice(error instanceof Error ? error.message : 'Status update failed.') }
  }
  async function saveEdit(item: OutreachItem) {
    try {
      const updated = edits[item.id] || { subject: item.subject, body: item.body }
      await editMutation.mutateAsync({ id: item.id, ...updated })
      setNotice('Draft edits saved.')
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Could not save edits.') }
  }
  async function approve(item: OutreachItem) {
    setNotice('')
    try {
      const updated = edits[item.id]
      if (updated) await editMutation.mutateAsync({ id: item.id, ...updated })
      await statusMutation.mutateAsync({ id: item.id, status: 'APPROVED' })
      setNotice('Human approval saved. No message was sent.')
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Could not approve this outreach.') }
  }
  async function createSequence(item: OutreachItem) {
    try { await sequenceMutation.mutateAsync(item.id); setNotice(`Follow-up sequence created for ${item.company}.`) }
    catch (error) { setNotice(error instanceof Error ? error.message : 'Could not create follow-up sequence.') }
  }
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
    <header><h1 style={{ fontSize: 28, fontWeight: 900, color: 'var(--text-1)' }}>Human Approval Inbox</h1><p style={{ color: 'var(--text-4)', marginTop: 6 }}>Live persisted drafts only. Approval never dispatches an external message.</p></header>
    <div style={box}><strong>Delivery provider not connected</strong><p style={{ color: 'var(--text-4)', marginTop: 6 }}>Approved messages are not SENT. Delivery-ready is only available when the selected channel has a supported, sourced recipient.</p></div>
    {notice && <p role="status" style={box}>{notice}</p>}{isError && <p role="alert" style={{ color: '#FB7185' }}>Could not load persisted approval records.</p>}{isLoading && <p>Loading saved outreach…</p>}
    {!isLoading && !isError && actionable.length === 0 && <div style={box}>No real outreach records are waiting for review. Demo-only drafts are not actionable here.</div>}
    {actionable.map(item => <article key={item.id} style={box}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}><div><h2 style={{ color: 'var(--text-1)', fontSize: 18 }}>{item.company}</h2><p style={{ color: 'var(--text-4)' }}>{item.prospectName} · {item.channel || 'Channel unknown'} · Status: <b>{item.status.replace('_', ' ')}</b></p></div><span style={{ color: item.reviewRequired ? '#FBBF24' : '#34D399' }}>{item.reviewRequired ? 'Qualification Needs Review' : `Qualification: ${item.qualificationStatus || 'unknown'}`}</span></div>
      {item.poc && <p style={{ marginTop: 10, color: 'var(--text-3)' }}>POC: {item.poc.name} · {item.poc.role || 'Role unknown'} · <a href={item.poc.sourceUrl} target="_blank" rel="noreferrer">Evidence source</a>{item.channel === 'email' ? ' · Recipient email: Unknown' : ''}</p>}
      {item.reviewRequired && <p style={{ color: '#FBBF24', marginTop: 8 }}>This lead requires qualification review. {item.reviewAcknowledged ? 'Review acknowledgement is recorded.' : 'Review acknowledgement has not been recorded.'}</p>}
      {item.status === 'PENDING_APPROVAL' && <>
        <label style={{ display: 'block', marginTop: 12 }}>Subject<input style={{ width: '100%', marginTop: 5, padding: 9, background: 'var(--bg-elevated)', color: 'var(--text-2)', border: '1px solid var(--border)', borderRadius: 7 }} value={(edits[item.id] || { subject: item.subject, body: item.body }).subject} onChange={event => setEdits(current => ({ ...current, [item.id]: { ...(current[item.id] || { subject: item.subject, body: item.body }), subject: event.target.value } }))} /></label>
        <label style={{ display: 'block', marginTop: 10 }}>Message<textarea style={{ width: '100%', marginTop: 5, minHeight: 150, padding: 9, background: 'var(--bg-elevated)', color: 'var(--text-2)', border: '1px solid var(--border)', borderRadius: 7 }} value={(edits[item.id] || { subject: item.subject, body: item.body }).body} onChange={event => setEdits(current => ({ ...current, [item.id]: { ...(current[item.id] || { subject: item.subject, body: item.body }), body: event.target.value } }))} /></label>
        {item.qualityChecks?.map(check => <p key={check.key} style={{ color: check.status === 'PASS' ? '#34D399' : check.status === 'WARNING' ? '#FBBF24' : '#FB7185' }}>{check.status} — {check.message}</p>)}
        <div style={{ marginTop: 14 }}><button style={btn} onClick={() => saveEdit(item)} disabled={editMutation.isPending}>Save edits</button><button style={btn} disabled={statusMutation.isPending || editMutation.isPending} onClick={() => approve(item)}>Approve</button><button style={{ ...btn, background: '#7f1d1d' }} disabled={statusMutation.isPending} onClick={() => action(item.id, 'REJECTED')}>Reject</button></div>
      </>}
      {item.status === 'PENDING' && <div style={{ marginTop: 14 }}><p style={{ color: '#FBBF24' }}>Legacy pending record: editing is unavailable for this status.</p><button style={btn} disabled={statusMutation.isPending} onClick={() => approve(item)}>Approve</button><button style={{ ...btn, background: '#7f1d1d' }} disabled={statusMutation.isPending} onClick={() => action(item.id, 'REJECTED')}>Reject</button></div>}
      {item.status === 'APPROVED' && <div style={{ marginTop: 12 }}><p style={{ color: '#34D399' }}>Human-approved. No external message has been sent.</p>{canReady(item) ? <button style={btn} onClick={() => action(item.id, 'DELIVERY_READY')}>Mark delivery-ready</button> : <p style={{ color: '#FBBF24' }}>Recipient is Unknown for this channel; delivery-ready is blocked.</p>}<button style={btn} onClick={() => createSequence(item)} disabled={sequenceMutation.isPending}>Create follow-up sequence</button></div>}
      {item.status === 'DELIVERY_READY' && <div style={{ marginTop: 12 }}><p style={{ color: '#34D399' }}>Delivery-ready · Provider unavailable · Not sent</p><button style={btn} onClick={() => createSequence(item)}>Create follow-up sequence</button></div>}
      {item.status === 'REJECTED' && <p style={{ color: '#FB7185', marginTop: 10 }}>Rejected</p>}
    </article>)}
  </div>
}
