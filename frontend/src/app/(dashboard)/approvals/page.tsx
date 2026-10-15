'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useQueryClient } from '@tanstack/react-query'
import { useCreateFollowUpSequence, useEditOutreach, useFollowUpSequences, useGmailConnection, useOutreach, usePOCLeads, useSendOutreachGmail, useUpdateOutreachStatus } from '@/lib/use-backend'
import { companyWebsiteErrorMessage, confirmDraftCompanyWebsite, findDraftPocWorkEmail, workEmailLookupErrorMessage, type OutreachItem, type WorkEmailLookupResult } from '@/lib/api'
import { outreachPreview } from '@/lib/outreach-preview'

const box: React.CSSProperties = { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: 20, minWidth: 0, overflowWrap: 'anywhere' }
const btn: React.CSSProperties = { padding: '9px 14px', borderRadius: 8, background: 'var(--blue)', color: 'white', border: 0, fontWeight: 700, cursor: 'pointer', marginRight: 8, marginTop: 8 }
const field: React.CSSProperties = { width: '100%', boxSizing: 'border-box', marginTop: 5, padding: 9, background: 'var(--bg-elevated)', color: 'var(--text-2)', border: '1px solid var(--border)', borderRadius: 7 }
type Edit = { subject: string; body: string; email: string }

export default function ApprovalsPage() {
  const queryClient = useQueryClient()
  const followUps = useFollowUpSequences()
  const { data: outreach = [], isLoading, isError } = useOutreach()
  const gmail = useGmailConnection()
  const leads = usePOCLeads()
  const statusMutation = useUpdateOutreachStatus()
  const editMutation = useEditOutreach()
  const sendMutation = useSendOutreachGmail()
  const sequenceMutation = useCreateFollowUpSequence()
  const [edits, setEdits] = useState<Record<string, Edit>>({})
  const [emailConfirm, setEmailConfirm] = useState<Record<string, boolean>>({})
  const [reviewConfirm, setReviewConfirm] = useState<Record<string, boolean>>({})
  const [sendPreviewId, setSendPreviewId] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  const [emailProviders, setEmailProviders] = useState<Record<string, 'hunter' | 'apollo'>>({})
  const [includeInferred, setIncludeInferred] = useState<Record<string, boolean>>({})
  const [findingEmailId, setFindingEmailId] = useState<string | null>(null)
  const [emailLookup, setEmailLookup] = useState<Record<string, { kind: 'success' | 'error'; message: string; result?: WorkEmailLookupResult }>>({})
  const [companyWebsites, setCompanyWebsites] = useState<Record<string, string>>({})
  const [websiteConfirmed, setWebsiteConfirmed] = useState<Record<string, boolean>>({})
  const [savingWebsiteId, setSavingWebsiteId] = useState<string | null>(null)
  const [websiteNotices, setWebsiteNotices] = useState<Record<string, string>>({})
  const actionable = outreach.filter(item => ['DRAFT', 'PENDING', 'PENDING_APPROVAL', 'APPROVED', 'DELIVERY_READY', 'SENDING', 'DELIVERY_UNKNOWN', 'SENT', 'REJECTED'].includes(item.status))

  function value(item: OutreachItem): Edit { return edits[item.id] || { subject: item.subject, body: item.body, email: item.email || '' } }
  function dirty(item: OutreachItem) { const current = value(item); return current.subject !== item.subject || current.body !== item.body || current.email !== (item.email || '') }
  function change(item: OutreachItem, patch: Partial<Edit>) { setEdits(current => ({ ...current, [item.id]: { ...value(item), ...patch } })) }

  async function findEmail(item: OutreachItem) {
    if (!item.poc || !item.leadId || findingEmailId) return
    setFindingEmailId(item.id)
    setEmailLookup(previous => { const next = { ...previous }; delete next[item.id]; return next })
    try {
      const found = await findDraftPocWorkEmail(item.id, emailProviders[item.id] || 'hunter', includeInferred[item.id] ? 'include_inferred' : 'found_only')
      change(item, { email: found.email })
      setEmailConfirm(previous => ({ ...previous, [item.id]: false }))
      setEmailLookup(previous => ({ ...previous, [item.id]: { kind: 'success', message: `${found.cached ? 'Cached' : found.provider === 'hunter' ? 'Hunter' : 'Apollo'} work email returned (${found.sourceType}). ${found.sourceType === 'inferred' ? 'Hunter inferred this address; ownership is not confirmed. ' : ''}Save edits and explicitly confirm this recipient; lookup did not change or approve the draft.`, result: found } }))
    } catch (error) {
      setEmailLookup(previous => ({ ...previous, [item.id]: { kind: 'error', message: error instanceof Error ? workEmailLookupErrorMessage(error) : 'Work-email lookup failed. Enter a recipient manually.' } }))
    } finally { setFindingEmailId(null) }
  }

  async function saveCompanyWebsite(item: OutreachItem, expectedWebsite: string) {
    if (savingWebsiteId || !websiteConfirmed[item.id]) return
    setSavingWebsiteId(item.id)
    setWebsiteNotices(previous => ({ ...previous, [item.id]: '' }))
    try {
      await confirmDraftCompanyWebsite(item.id, companyWebsites[item.id] || '', expectedWebsite)
      setCompanyWebsites(previous => { const next = { ...previous }; delete next[item.id]; return next })
      setWebsiteConfirmed(previous => ({ ...previous, [item.id]: false }))
      setEmailLookup(previous => { const next = { ...previous }; delete next[item.id]; return next })
      await Promise.all([queryClient.invalidateQueries({ queryKey: ['poc-discovery-leads'] }), queryClient.invalidateQueries({ queryKey: ['outreach'] })])
      setWebsiteNotices(previous => ({ ...previous, [item.id]: 'Company website saved as user-provided. Review it, then run a new lookup if needed.' }))
    } catch (error) {
      setWebsiteNotices(previous => ({ ...previous, [item.id]: error instanceof Error ? companyWebsiteErrorMessage(error) : 'Company website could not be saved.' }))
    } finally { setSavingWebsiteId(null) }
  }

  async function saveEdit(item: OutreachItem) {
    setNotice('')
    const current = value(item)
    if (current.email && (current.email !== (item.email || '') || !item.recipientConfirmedAt) && !emailConfirm[item.id]) { setNotice('Confirm that this address belongs to the selected POC before saving. Provider status does not guarantee delivery.'); return }
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
      const needsRecipientConfirmation = item.channel === 'email' && Boolean(current.email) && !item.recipientConfirmedAt
      const hasSequence = followUps.data?.some(sequence => sequence.outreachId === item.id)
      const preview = outreachPreview(item, gmail.data, leads.data?.find(lead => lead.id === item.leadId))
      const currentLead = leads.data?.find(lead => lead.id === item.leadId)
      const maySend = preview.canSend && !dirty(item) && !leads.isLoading && !leads.isError
      return <article key={item.id} style={box}>
        <h2 style={{ color: 'var(--text-1)', fontSize: 18 }}>{item.company}</h2>
        <p style={{ color: 'var(--text-4)' }}>{item.prospectName} · {item.channel || 'Channel unknown'} · <b>{item.status.replace('_', ' ')}</b>{item.draftOrigin && ` · ${item.draftOrigin === 'MANUAL' ? 'Manually written' : 'AI assisted'}`}</p>
        {item.poc && <p style={{ color: 'var(--text-3)' }}>POC: {item.poc.name} · {item.poc.role || 'Role unknown'} · <a href={item.poc.sourceUrl} target="_blank" rel="noreferrer">Evidence source</a></p>}
        {item.reviewRequired && <p style={{ color: '#FBBF24' }}>Qualification NEEDS REVIEW. {item.reviewAcknowledged ? 'Acknowledgement recorded.' : 'Review the reasons before proceeding; qualification is advisory.'}</p>}
        {currentLead && <details><summary>Current qualification guidance: {currentLead.qualificationStatus?.replaceAll('_', ' ').toUpperCase() || 'NOT YET QUALIFIED'}{currentLead.qualificationScore != null ? ` · ${currentLead.qualificationScore}/100` : ''}{currentLead.qualificationIcpStale || currentLead.qualificationResearchStale ? ' · STALE' : ''}</summary>{currentLead.qualificationReasons?.length ? <ul>{currentLead.qualificationReasons.map((reason, index) => <li key={index}>{reason}</li>)}</ul> : <p>No assessment reasons saved.</p>}{currentLead.qualificationEvidence?.length ? <ul>{currentLead.qualificationEvidence.map((evidence, index) => <li key={index}>{evidence.field}: {evidence.value} ({evidence.origin.replaceAll('_', ' ')}){evidence.sourceUrl && <> · <a href={evidence.sourceUrl} target="_blank" rel="noopener noreferrer">Source</a></>}</li>)}</ul> : null}<p>Qualification is advisory and does not change this draft’s approval.</p></details>}
        {editable && <>
          <label style={{ display: 'block', marginTop: 10 }}>Subject<input style={field} value={current.subject} onChange={event => change(item, { subject: event.target.value })} /></label>
          <label style={{ display: 'block', marginTop: 10 }}>Message<textarea style={{ ...field, minHeight: 150 }} value={current.body} onChange={event => change(item, { body: event.target.value })} /></label>
          {item.channel === 'email' && item.poc && item.leadId && <div style={{ ...box, marginTop: 12 }}>
            <strong>Company website for email lookup</strong>
            <p style={{ color: item.lookupCompanyDomain ? 'var(--text-3)' : '#FBBF24' }}>{item.lookupCompanyDomain ? `Lookup domain: ${item.lookupCompanyDomain}${currentLead?.websiteSource === 'user_provided' ? ' · user-provided' : currentLead?.websiteSource === 'research_source' || !currentLead?.website ? ' · saved research evidence' : ' · saved lead'}` : 'No supported company domain is saved. Confirm the official website below before using email lookup; drafting and approval do not require it.'}</p>
            <label style={{ display: 'block' }}>Company website<input type="text" style={field} placeholder="https://company.example.com" value={companyWebsites[item.id] ?? currentLead?.website ?? ''} onChange={event => { setCompanyWebsites(previous => ({ ...previous, [item.id]: event.target.value })); setWebsiteConfirmed(previous => ({ ...previous, [item.id]: false })) }} /></label>
            <label style={{ display: 'block', marginTop: 8 }}><input type="checkbox" checked={Boolean(websiteConfirmed[item.id])} onChange={event => setWebsiteConfirmed(previous => ({ ...previous, [item.id]: event.target.checked }))} /> I confirm this is the selected company’s official website. It will be saved as user-provided, not independently verified.</label>
            <button type="button" style={btn} disabled={!websiteConfirmed[item.id] || Boolean(savingWebsiteId) || !currentLead} onClick={() => saveCompanyWebsite(item, currentLead?.website || '')}>{savingWebsiteId === item.id ? 'Saving website…' : 'Confirm and save website'}</button>
            {websiteNotices[item.id] && <p role="status">{websiteNotices[item.id]}</p>}
          </div>}
          {item.channel === 'email' && <><label style={{ display: 'block', marginTop: 10 }}>Recipient email (enter or look up here; confirm before sending)<input type="email" style={field} value={current.email} onChange={event => change(item, { email: event.target.value })} placeholder="Enter the selected POC address" /></label>{item.poc && item.leadId && <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 8 }}><label>Work-email provider <select value={emailProviders[item.id] || 'hunter'} onChange={event => { setEmailProviders(previous => ({ ...previous, [item.id]: event.target.value as 'hunter' | 'apollo' })); setEmailLookup(previous => { const next = { ...previous }; delete next[item.id]; return next }) }} disabled={Boolean(findingEmailId)}><option value="hunter">Hunter</option><option value="apollo">Apollo</option></select></label><button type="button" style={btn} onClick={() => findEmail(item)} disabled={Boolean(findingEmailId)}>{findingEmailId === item.id ? 'Finding work email…' : 'Find work email'}</button></div>}{emailLookup[item.id] && <div role={emailLookup[item.id]!.kind === 'error' ? 'alert' : 'status'} style={{ marginTop: 8, color: emailLookup[item.id]!.kind === 'error' ? '#FB7185' : 'var(--text-3)' }}><p>{emailLookup[item.id]!.message}</p>{emailLookup[item.id]!.result && <p>Provider: {emailLookup[item.id]!.result!.provider === 'hunter' ? 'Hunter' : 'Apollo'} · Status: {emailLookup[item.id]!.result!.providerStatus} · Confidence: {emailLookup[item.id]!.result!.confidence != null ? `${emailLookup[item.id]!.result!.confidence}/100` : 'unavailable'} · Looked up: {new Date(emailLookup[item.id]!.result!.lookedUpAt).toLocaleString()}{emailLookup[item.id]!.result!.sourceUrls.length ? <> · Sources: {emailLookup[item.id]!.result!.sourceUrls.map((url, index) => <span key={url}>{index > 0 ? ', ' : ' '}<a href={url} target="_blank" rel="noopener noreferrer">{index + 1}</a></span>)}</> : null}</p>}</div>}{(current.email !== (item.email || '') || needsRecipientConfirmation) && current.email && <label><input type="checkbox" checked={Boolean(emailConfirm[item.id])} onChange={event => setEmailConfirm(previous => ({ ...previous, [item.id]: event.target.checked }))} /> I confirmed this address belongs to the selected POC; provider status alone does not guarantee delivery.</label>}</>}
          {item.channel === 'email' && item.poc && item.leadId && (emailProviders[item.id] || 'hunter') === 'hunter' && <label style={{ display: 'block', marginTop: 8 }}><input type="checkbox" checked={Boolean(includeInferred[item.id])} disabled={Boolean(findingEmailId)} onChange={event => { setIncludeInferred(previous => ({ ...previous, [item.id]: event.target.checked })); setEmailLookup(previous => { const next = { ...previous }; delete next[item.id]; return next }) }} /> Include inferred addresses (optional; standard Hunter Email Finder may return an address without public-source proof)</label>}
          {emailLookup[item.id]?.result && <p>Address origin: {emailLookup[item.id]!.result!.sourceType || 'unknown'} · Provider verification: {emailLookup[item.id]!.result!.providerStatus || 'unknown'}. These are separate signals; neither confirms recipient ownership.</p>}
          {!emailLookup[item.id]?.result && current.email === item.email && item.emailEnrichment && <p>Saved lookup: {item.emailEnrichment.provider === 'hunter' ? 'Hunter' : 'Apollo'} · Address origin: {item.emailEnrichment.sourceType} · Provider verification: {item.emailEnrichment.providerStatus} · Confidence: {item.emailEnrichment.confidence != null ? `${item.emailEnrichment.confidence}/100` : 'unavailable'} · Looked up: {new Date(item.emailEnrichment.lookedUpAt).toLocaleString()}{item.emailEnrichment.sourceUrls.length ? <> · Sources: {item.emailEnrichment.sourceUrls.map((url, index) => <span key={url}>{index > 0 ? ', ' : ' '}<a href={url} target="_blank" rel="noopener noreferrer">{index + 1}</a></span>)}</> : null}. Inferred is not confirmed ownership.</p>}
          {dirty(item) && <p style={{ color: '#FBBF24' }}>Save these changes before approval. Saving changes invalidates any prior approval.</p>}
          <button type="button" style={btn} onClick={() => saveEdit(item)} disabled={(!dirty(item) && !(needsRecipientConfirmation && emailConfirm[item.id])) || editMutation.isPending}>{needsRecipientConfirmation && !dirty(item) ? 'Confirm recipient' : 'Save edits'}</button>
        </>}
        {item.status === 'DRAFT' && <>{item.reviewRequired && !item.reviewAcknowledged && <label style={{ display: 'block' }}><input type="checkbox" checked={Boolean(reviewConfirm[item.id])} onChange={event => setReviewConfirm(previous => ({ ...previous, [item.id]: event.target.checked }))} /> I reviewed the qualification reasons.</label>}<button type="button" style={btn} disabled={dirty(item) || statusMutation.isPending} onClick={() => transition(item, 'PENDING_APPROVAL')}>Submit for approval</button></>}
        {['PENDING', 'PENDING_APPROVAL'].includes(item.status) && <><button type="button" style={btn} disabled={dirty(item) || statusMutation.isPending} onClick={() => transition(item, 'APPROVED')}>Approve saved revision</button><button type="button" style={{ ...btn, background: '#7f1d1d' }} disabled={statusMutation.isPending} onClick={() => transition(item, 'REJECTED')}>Reject</button></>}
        {item.status === 'REJECTED' && <button type="button" style={btn} onClick={() => transition(item, 'DRAFT')}>Reopen as draft</button>}
        {item.status === 'APPROVED' && <>
          <p>Approved revision: {item.approvedRevision ?? 'Legacy; review again'} · Recipient: {item.email || 'Unknown'}</p>
          {item.channel === 'email' && !maySend && <p style={{ color: '#FBBF24' }}>Preview shows what remains before sending.</p>}
          {item.channel !== 'email' && <p>Non-email delivery is not connected. Approval does not mean sent.</p>}
          {item.approvedRevision !== (item.contentRevision || 1) && <button type="button" style={btn} onClick={() => transition(item, 'PENDING_APPROVAL')}>Review current revision</button>}
        </>}
        {item.channel === 'email' && <button type="button" style={btn} onClick={() => setSendPreviewId(item.id)}>Preview saved draft</button>}
        {sendPreviewId === item.id && item.channel === 'email' && <div style={{ ...box, marginTop: 12, overflowWrap: 'anywhere' }}><strong>Saved draft preview — no email sent</strong><p>Status: {preview.status} · Revision: {preview.revision}<br />From: {preview.sender}<br />To: {preview.recipient}<br />Subject: {preview.subject}</p><pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', color: 'var(--text-2)' }}>{preview.body}</pre>{dirty(item) && <p style={{ color: '#FBBF24' }}>Unsaved edits are not shown. Save them to update this preview; approval will be invalidated.</p>}{preview.blocking.length > 0 && <ul style={{ color: '#FBBF24' }}>{preview.blocking.map(reason => <li key={reason}>{reason}</li>)}</ul>}<button type="button" style={btn} disabled={!maySend || sendMutation.isPending} onClick={() => send(item)}>{sendMutation.isPending ? 'Sending…' : 'Confirm and send through Gmail'}</button><button type="button" style={btn} onClick={() => setSendPreviewId(null)}>Close preview</button></div>}
        {item.status === 'DELIVERY_READY' && <p>Legacy delivery-ready record. This does not prove it was sent.</p>}
        {item.status === 'SENDING' && <p>Gmail request started. Confirm the mailbox outcome before any retry.</p>}
        {item.status === 'DELIVERY_UNKNOWN' && <p style={{ color: '#FBBF24' }}>Gmail outcome is unknown. Check the mailbox; automatic retry is blocked.</p>}
        {item.status === 'SENT' && <p>Gmail confirmed sent at {item.sentAt ? new Date(item.sentAt).toLocaleString() : 'unknown time'} · Message ID: {item.gmailMessageId || 'missing confirmation'}</p>}
        {((item.channel === 'email' && item.status === 'SENT') || (item.channel !== 'email' && item.status === 'DELIVERY_READY')) && !hasSequence && <button type="button" style={btn} disabled={sequenceMutation.isPending} onClick={() => createSequence(item)}>Create follow-up sequence</button>}
      </article>
    })}
  </div>
}
