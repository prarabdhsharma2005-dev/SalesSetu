'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useCreateFollowUpSequence, useEditOutreach, useFollowUpSequences, useGmailConnection, useOutreach, useSendOutreachGmail, useUpdateOutreachStatus } from '@/lib/use-backend'
import type { OutreachItem } from '@/lib/api'

const box: React.CSSProperties = { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: 20 }
const btn: React.CSSProperties = { padding: '9px 14px', borderRadius: 8, background: 'var(--blue)', color: 'white', border: 0, fontWeight: 700, cursor: 'pointer', marginRight: 8, marginTop: 8 }
const field: React.CSSProperties = { width: '100%', marginTop: 5, padding: 9, background: 'var(--bg-elevated)', color: 'var(--text-2)', border: '1px solid var(--border)', borderRadius: 7 }
type Edit = { subject: string; body: string; email: string }

export default function ApprovalsPage() {
  const followUps = useFollowUpSequences()
  const { data: outreach = [], isLoading, isError } = useOutreach()
  const gmail = useGmailConnection()
  const statusMutation = useUpdateOutreachStatus()
  const editMutation = useEditOutreach()
  const sendMutation = useSendOutreachGmail()
  const sequenceMutation = useCreateFollowUpSequence()
  const [edits, setEdits] = useState<Record<string, Edit>>({})
  const [emailConfirm, setEmailConfirm] = useState<Record<string, boolean>>({})
  const [reviewConfirm, setReviewConfirm] = useState<Record<string, boolean>>({})
  const [sendPreviewId, setSendPreviewId] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  const actionable = outreach.filter(item => ['DRAFT', 'PENDING', 'PENDING_APPROVAL', 'APPROVED', 'DELIVERY_READY', 'SENDING', 'DELIVERY_UNKNOWN', 'SENT', 'REJECTED'].includes(item.status))

  function value(item: OutreachItem): Edit { return edits[item.id] || { subject: item.subject, body: item.body, email: item.email || '' } }
  function dirty(item: OutreachItem) { const current = value(item); return current.subject !== item.subject || current.body !== item.body || current.email !== (item.email || '') }
  function change(item: OutreachItem, patch: Partial<Edit>) { setEdits(current => ({ ...current, [item.id]: { ...value(item), ...patch } })) }

  async function saveEdit(item: OutreachItem) {
    setNotice('')
    const current = value(item)
    if (current.email !== (item.email || '') && current.email && !emailConfirm[item.id]) { setNotice('Confirm that you checked the manually entered recipient email. It is not a discovered or verified address.'); return }
    try {
      const updated = await editMutation.mutateAsync({ id: item.id, subject: current.subject, body: current.body, email: current.email || null, recipientConfirmed: Boolean(emailConfirm[item.id]), expectedUpdatedAt: item.updatedAt || '' })
      setEdits(previous => { const next = { ...previous }; delete next[item.id]; return next })
      setEmailConfirm(previous => ({ ...previous, [item.id]: false }))
      setReviewConfirm(previous => ({ ...previous, [item.id]: false }))
      setNotice(updated.status === 'DRAFT' ? 'Edits saved. Prior approval was invalidated; submit this revision for review.' : 'No content change was needed.')
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Could not save edits.') }
  }

  async function transition(item: OutreachItem, status: OutreachItem['status']) {
    setNotice('')
    if (dirty(item)) { setNotice('Save content and recipient edits before changing approval status.'); return }
    if (status === 'PENDING_APPROVAL' && item.reviewRequired && !reviewConfirm[item.id] && !item.reviewAcknowledged) { setNotice('Review and acknowledge the qualification reasons before submitting.'); return }
    try {
      await statusMutation.mutateAsync({ id: item.id, status, expectedUpdatedAt: item.updatedAt || '', ...(status === 'PENDING_APPROVAL' ? { reviewAcknowledged: Boolean(reviewConfirm[item.id] || item.reviewAcknowledged) } : {}) })
      setNotice(status === 'APPROVED' ? 'Exact saved revision approved. No message was sent.' : status === 'REJECTED' ? 'Draft rejected; it can be reopened and resubmitted.' : status === 'PENDING_APPROVAL' ? 'Submitted for human approval.' : 'Draft reopened for editing.')
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Status update failed.') }
  }

  async function send(item: OutreachItem) {
    setNotice('')
    try {
      await sendMutation.mutateAsync({ id: item.id, expectedUpdatedAt: item.updatedAt || '' })
      setSendPreviewId(null)
      setNotice('Gmail confirmed sending. Message and thread IDs were saved.')
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Send outcome is unavailable. Check the record before retrying.') }
  }

  async function createSequence(item: OutreachItem) {
    try { await sequenceMutation.mutateAsync(item.id); setNotice(`Follow-up sequence created for ${item.company}.`) }
    catch (error) { setNotice(error instanceof Error ? error.message : 'Could not create follow-up sequence.') }
  }

  return <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
    <div style={box}><Link href="/follow-ups">Review follow-up drafts and approvals</Link><p>{followUps.isError ? 'Follow-up approvals unavailable.' : `${(followUps.data || []).flatMap(sequence => sequence.steps).filter(step => step.status === 'PENDING_APPROVAL').length} follow-up steps awaiting approval.`}</p></div>
    <header><h1 style={{ fontSize: 28, fontWeight: 900, color: 'var(--text-1)' }}>Human Approval Inbox</h1><p style={{ color: 'var(--text-4)', marginTop: 6 }}>Saved outreach only. Approval and Gmail sending are separate actions.</p></header>
    <div style={box}><strong>Gmail: {gmail.data?.connected ? `Connected as ${gmail.data.senderEmail}` : 'Not connected'}</strong><p style={{ color: 'var(--text-4)', marginTop: 6 }}>A confirmed recipient, current approval, and explicit send confirmation are required. <Link href="/integrations">Manage Gmail connection</Link>.</p></div>
    {notice && <p role="status" style={box}>{notice}</p>}{isError && <p role="alert" style={{ color: '#FB7185' }}>Could not load persisted approval records.</p>}{isLoading && <p>Loading saved outreach…</p>}
    {!isLoading && !isError && actionable.length === 0 && <div style={box}>No stored outreach records. Demo drafts are not actionable.</div>}
    {actionable.map(item => {
      const current = value(item)
      const editable = ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED'].includes(item.status)
      const hasSequence = followUps.data?.some(sequence => sequence.outreachId === item.id)
      const maySend = item.status === 'APPROVED' && item.channel === 'email' && item.approvedRevision === (item.contentRevision || 1) && Boolean(item.email && item.recipientConfirmedAt && item.recipientSource === 'MANUALLY_CONFIRMED') && gmail.data?.connected
      return <article key={item.id} style={box}>
        <h2 style={{ color: 'var(--text-1)', fontSize: 18 }}>{item.company}</h2>
        <p style={{ color: 'var(--text-4)' }}>{item.prospectName} · {item.channel || 'Channel unknown'} · <b>{item.status.replace('_', ' ')}</b></p>
        {item.poc && <p style={{ color: 'var(--text-3)' }}>POC: {item.poc.name} · {item.poc.role || 'Role unknown'} · <a href={item.poc.sourceUrl} target="_blank" rel="noreferrer">Evidence source</a></p>}
        {item.reviewRequired && <p style={{ color: '#FBBF24' }}>Qualification NEEDS REVIEW. {item.reviewAcknowledged ? 'Acknowledgement recorded.' : 'Acknowledgement required before approval.'}</p>}
        {editable && <>
          <label style={{ display: 'block', marginTop: 10 }}>Subject<input style={field} value={current.subject} onChange={event => change(item, { subject: event.target.value })} /></label>
          <label style={{ display: 'block', marginTop: 10 }}>Message<textarea style={{ ...field, minHeight: 150 }} value={current.body} onChange={event => change(item, { body: event.target.value })} /></label>
          {item.channel === 'email' && <><label style={{ display: 'block', marginTop: 10 }}>Recipient email (manually supplied, not verified by discovery)<input type="email" style={field} value={current.email} onChange={event => change(item, { email: event.target.value })} placeholder="Enter the confirmed POC address" /></label>{current.email !== (item.email || '') && current.email && <label><input type="checkbox" checked={Boolean(emailConfirm[item.id])} onChange={event => setEmailConfirm(previous => ({ ...previous, [item.id]: event.target.checked }))} /> I confirmed this address belongs to the selected POC.</label>}</>}
          {dirty(item) && <p style={{ color: '#FBBF24' }}>Save these changes before approval. Saving changes invalidates any prior approval.</p>}
          <button type="button" style={btn} onClick={() => saveEdit(item)} disabled={!dirty(item) || editMutation.isPending}>Save edits</button>
        </>}
        {item.status === 'DRAFT' && <>{item.reviewRequired && !item.reviewAcknowledged && <label style={{ display: 'block' }}><input type="checkbox" checked={Boolean(reviewConfirm[item.id])} onChange={event => setReviewConfirm(previous => ({ ...previous, [item.id]: event.target.checked }))} /> I reviewed the qualification reasons.</label>}<button type="button" style={btn} disabled={dirty(item) || statusMutation.isPending} onClick={() => transition(item, 'PENDING_APPROVAL')}>Submit for approval</button></>}
        {['PENDING', 'PENDING_APPROVAL'].includes(item.status) && <><button type="button" style={btn} disabled={dirty(item) || statusMutation.isPending} onClick={() => transition(item, 'APPROVED')}>Approve saved revision</button><button type="button" style={{ ...btn, background: '#7f1d1d' }} disabled={statusMutation.isPending} onClick={() => transition(item, 'REJECTED')}>Reject</button></>}
        {item.status === 'REJECTED' && <button type="button" style={btn} onClick={() => transition(item, 'DRAFT')}>Reopen as draft</button>}
        {item.status === 'APPROVED' && <>
          <p>Approved revision: {item.approvedRevision ?? 'Legacy; review again'} · Recipient: {item.email || 'Unknown'}</p>
          {item.channel === 'email' && <button type="button" style={btn} disabled={!maySend || dirty(item) || sendMutation.isPending} onClick={() => setSendPreviewId(item.id)}>Preview Gmail send</button>}
          {item.channel === 'email' && !maySend && <p style={{ color: '#FBBF24' }}>Connect Gmail, confirm the recipient, and approve the current revision before sending.</p>}
          {item.channel !== 'email' && <p>Non-email delivery is not connected. Approval does not mean sent.</p>}
          {item.approvedRevision !== (item.contentRevision || 1) && <button type="button" style={btn} onClick={() => transition(item, 'PENDING_APPROVAL')}>Review current revision</button>}
        </>}
        {sendPreviewId === item.id && item.status === 'APPROVED' && <div style={{ ...box, marginTop: 12 }}><strong>Final Gmail preview</strong><p>From: {gmail.data?.senderEmail || 'Disconnected'}<br />To: {item.email}<br />Subject: {item.subject}</p><pre style={{ whiteSpace: 'pre-wrap', color: 'var(--text-2)' }}>{item.body}</pre><button type="button" style={btn} disabled={!maySend || sendMutation.isPending} onClick={() => send(item)}>{sendMutation.isPending ? 'Sending…' : 'Confirm and send through Gmail'}</button><button type="button" style={btn} onClick={() => setSendPreviewId(null)}>Cancel</button></div>}
        {item.status === 'DELIVERY_READY' && <p>Legacy delivery-ready record. This does not prove it was sent.</p>}
        {item.status === 'SENDING' && <p>Gmail request started. Confirm the mailbox outcome before any retry.</p>}
        {item.status === 'DELIVERY_UNKNOWN' && <p style={{ color: '#FBBF24' }}>Gmail outcome is unknown. Check the mailbox; automatic retry is blocked.</p>}
        {item.status === 'SENT' && <p>Gmail confirmed sent at {item.sentAt ? new Date(item.sentAt).toLocaleString() : 'unknown time'} · Message ID: {item.gmailMessageId || 'missing confirmation'}</p>}
        {((item.channel === 'email' && item.status === 'SENT') || (item.channel !== 'email' && item.status === 'DELIVERY_READY')) && !hasSequence && <button type="button" style={btn} disabled={sequenceMutation.isPending} onClick={() => createSequence(item)}>Create follow-up sequence</button>}
      </article>
    })}
  </div>
}
