'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAppendOutreach, useDiscoverPOCs, useDraftEmail, useEditOutreach, usePOCLeads, useUpdateOutreachStatus } from '@/lib/use-backend'
import type { DiscoveredPOC, Lead } from '@/lib/api'

const CHANNELS = [{ id: 'email', label: 'Email' }, { id: 'linkedin', label: 'LinkedIn InMail' }, { id: 'whatsapp', label: 'WhatsApp Business' }] as const
const TONES = ['consultative', 'roi', 'exec'] as const
const card: React.CSSProperties = { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: 20 }
const field: React.CSSProperties = { width: '100%', padding: 10, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-2)', font: 'inherit' }
const button: React.CSSProperties = { padding: '10px 14px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--blue)', color: 'white', fontWeight: 700, cursor: 'pointer' }

export default function OutreachPage() {
  const { data: leads = [], isLoading: loadingLeads, isError: leadsError } = usePOCLeads()
  const [leadId, setLeadId] = useState('')
  const [pocIndex, setPocIndex] = useState('')
  const [pocs, setPocs] = useState<DiscoveredPOC[]>([])
  const [channel, setChannel] = useState<(typeof CHANNELS)[number]['id']>('email')
  const [tone, setTone] = useState<(typeof TONES)[number]>('consultative')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [savedId, setSavedId] = useState('')
  const [reviewConfirmed, setReviewConfirmed] = useState(false)
  const [message, setMessage] = useState('')
  const discovery = useDiscoverPOCs()
  const draft = useDraftEmail()
  const saveDraft = useAppendOutreach()
  const editDraft = useEditOutreach()
  const changeStatus = useUpdateOutreachStatus()
  const lead = leads.find(item => item.id === leadId)
  const selectedPoc = pocIndex === '' ? undefined : pocs[Number(pocIndex)]
  const blocked = !lead || (lead.qualificationStatus !== 'qualified' && lead.qualificationStatus !== 'needs_review')
  const reviewRequired = lead?.qualificationStatus === 'needs_review'
  const quality = useMemo(() => [
    { status: lead ? 'PASS' : 'BLOCKED', label: 'Stored lead associated' },
    { status: selectedPoc?.sourceUrl ? 'PASS' : 'BLOCKED', label: 'Discovered POC with source selected' },
    { status: lead?.qualificationStatus === 'qualified' ? 'PASS' : reviewRequired ? 'WARNING' : 'BLOCKED', label: reviewRequired ? 'Qualification needs review' : 'Qualification state' },
    { status: channel === 'email' ? 'WARNING' : channel === 'linkedin' && selectedPoc?.profileUrl ? 'PASS' : 'WARNING', label: channel === 'email' ? 'Email recipient unknown' : channel === 'linkedin' ? 'LinkedIn profile availability' : 'WhatsApp phone unavailable' },
    { status: body.trim() && !/\[insert|\{\{|prospect@company\.com/i.test(body) ? 'PASS' : 'WARNING', label: 'Message content and placeholders' },
    ...(channel === 'email' ? [{ status: subject.trim() ? 'PASS' : 'BLOCKED', label: 'Email subject present' }] : []),
  ], [lead, selectedPoc, reviewRequired, channel, body, subject])

  useEffect(() => {
    setPocs([]); setPocIndex(''); setSubject(''); setBody(''); setSavedId(''); setReviewConfirmed(false); setMessage('')
    if (!leadId) return
    discovery.mutate(leadId, {
      onSuccess: result => setPocs(result.pocs),
      onError: error => setMessage(error.message || 'POC discovery is unavailable.'),
    })
    // The selection changes are the only trigger; mutation is kept in the query hook.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId])

  async function generate() {
    if (!lead || !selectedPoc) return
    setMessage('')
    try {
      const result = await draft.mutateAsync({ leadId: lead.id, company: lead.company, poc: selectedPoc, channel, tone })
      setSubject(result.subject || '')
      setBody(result.body)
      const record = await saveDraft.mutateAsync({
        prospectName: selectedPoc.name, email: null, company: lead.company, subject: result.subject || '', body: result.body,
        status: 'DRAFT', leadId: lead.id, poc: selectedPoc, pocId: `${selectedPoc.name.toLowerCase()}|${selectedPoc.sourceUrl}`,
        channel, qualificationStatus: lead.qualificationStatus, qualificationScore: lead.qualificationScore ?? null,
        reviewRequired: lead.qualificationStatus === 'needs_review', qualityChecks: [],
      })
      setSavedId(record.id)
      setMessage('Evidence-based draft saved. Review and edit it before submitting for approval.')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Draft generation failed; no message was saved.') }
  }

  async function submitForApproval() {
    if (!savedId || !lead || !selectedPoc) return
    if (reviewRequired && !reviewConfirmed) { setMessage('Confirm that you reviewed the qualification reasons before submitting.'); return }
    if (quality.some(item => item.status === 'BLOCKED')) { setMessage('Resolve the blocked quality checks before submitting.'); return }
    try {
      await editDraft.mutateAsync({ id: savedId, subject, body })
      await changeStatus.mutateAsync({ id: savedId, status: 'PENDING_APPROVAL' })
      setMessage('Submitted to the Human Approval Inbox. No message has been sent.')
      setSavedId('')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not submit for approval.') }
  }

  return <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
    <header><h1 style={{ fontSize: 28, fontWeight: 900, color: 'var(--text-1)' }}>AI Outreach Studio</h1><p style={{ color: 'var(--text-4)', marginTop: 6 }}>Draft from stored SalesSetu evidence. Approval is required; external delivery is not connected.</p></header>
    <div style={{ ...card, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 16 }}>
      <label style={{ color: 'var(--text-4)', fontSize: 12 }}>Stored lead<select style={{ ...field, display: 'block', marginTop: 7 }} value={leadId} onChange={event => setLeadId(event.target.value)}><option value="">Select a stored lead</option>{leads.map(item => <option key={item.id} value={item.id}>{item.company}</option>)}</select></label>
      <label style={{ color: 'var(--text-4)', fontSize: 12 }}>Discovered POC<select style={{ ...field, display: 'block', marginTop: 7 }} value={pocIndex} onChange={event => setPocIndex(event.target.value)} disabled={!pocs.length}><option value="">{discovery.isPending ? 'Discovering sourced contacts…' : pocs.length ? 'Select a discovered POC' : 'No sourced POCs available'}</option>{pocs.map((person, index) => <option key={`${person.name}-${person.sourceUrl}`} value={index}>{person.name}{person.role ? ` — ${person.role}` : ''}</option>)}</select></label>
      <label style={{ color: 'var(--text-4)', fontSize: 12 }}>Channel<select style={{ ...field, display: 'block', marginTop: 7 }} value={channel} onChange={event => setChannel(event.target.value as typeof channel)}>{CHANNELS.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
      <label style={{ color: 'var(--text-4)', fontSize: 12 }}>Tone<select style={{ ...field, display: 'block', marginTop: 7 }} value={tone} onChange={event => setTone(event.target.value as typeof tone)}>{TONES.map(item => <option key={item} value={item}>{item}</option>)}</select></label>
    </div>
    {leadsError && <p role="alert" style={{ color: '#FB7185' }}>Could not load stored leads. Demo prospects are not used for live outreach.</p>}
    {lead && <div style={{ ...card, lineHeight: 1.7, color: 'var(--text-3)' }}>
      <strong style={{ color: 'var(--text-1)' }}>{lead.company}</strong> · {lead.industry || 'Industry unknown'} · {[lead.city, lead.country].filter(Boolean).join(', ') || 'Location unknown'} · Employees: {lead.employees || 'Unknown'}<br />
      Qualification: <strong>{lead.qualificationStatus?.replace('_', ' ').toUpperCase() || 'NOT YET QUALIFIED'}</strong>{lead.qualificationScore != null ? ` (${lead.qualificationScore}/100)` : ''}{lead.qualificationReasons?.length ? <ul>{lead.qualificationReasons.map((reason, index) => <li key={index}>{reason}</li>)}</ul> : null}
      {reviewRequired && <label style={{ display: 'block', color: '#FBBF24' }}><input type="checkbox" checked={reviewConfirmed} onChange={event => setReviewConfirmed(event.target.checked)} /> I reviewed the qualification reasons; keep this review warning with the draft.</label>}
    </div>}
    {selectedPoc && <div style={card}><strong>{selectedPoc.name}</strong> · {selectedPoc.role || 'Role unknown'} · {selectedPoc.department || 'Department unknown'}<br />Email: Unknown · Profile: {selectedPoc.profileUrl ? <a href={selectedPoc.profileUrl} target="_blank" rel="noreferrer">Sourced profile</a> : 'Unknown'} · <a href={selectedPoc.sourceUrl} target="_blank" rel="noreferrer">Source</a> · {Math.round(selectedPoc.confidence * 100)}% evidence confidence<br />{selectedPoc.relevanceReason || 'Relevance not established by available evidence.'}</div>}
    <div style={{ ...card }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}><strong>Deterministic quality checks</strong><button style={button} onClick={generate} disabled={blocked || !selectedPoc || draft.isPending || saveDraft.isPending}>{draft.isPending || saveDraft.isPending ? 'Generating…' : 'Generate AI draft'}</button></div><ul style={{ color: 'var(--text-3)', lineHeight: 1.8 }}>{quality.map(item => <li key={item.label}><b style={{ color: item.status === 'PASS' ? '#34D399' : item.status === 'WARNING' ? '#FBBF24' : '#FB7185' }}>{item.status}</b> — {item.label}</li>)}</ul>{lead?.qualificationStatus === 'not_qualified' && <p style={{ color: '#FB7185' }}>Outreach is blocked because this lead is not qualified.</p>}{lead && !lead.qualificationStatus && <p style={{ color: '#FB7185' }}>Qualify this lead before generating outreach.</p>}</div>
    {savedId && <div style={card}><label style={{ display: 'block', color: 'var(--text-4)' }}>Subject<input style={{ ...field, marginTop: 6 }} value={subject} onChange={event => setSubject(event.target.value)} /></label><label style={{ display: 'block', color: 'var(--text-4)', marginTop: 12 }}>Message<textarea style={{ ...field, marginTop: 6, minHeight: 220 }} value={body} onChange={event => setBody(event.target.value)} /></label><p style={{ color: '#FBBF24', margin: '12px 0' }}>Delivery provider not connected — approval saves this message as delivery-ready only when a supported recipient address is available. No external message is sent.</p><button style={button} onClick={submitForApproval} disabled={editDraft.isPending || changeStatus.isPending}>Submit for human approval</button></div>}
    {message && <p role="status" style={{ ...card, color: 'var(--text-2)' }}>{message}</p>}
  </div>
}
