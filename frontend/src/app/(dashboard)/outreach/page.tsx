'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useAppendOutreach, useDiscoverPOCs, useEditOutreach, usePOCLeads, useUpdateOutreachStatus } from '@/lib/use-backend'
import { draftEmail, type DiscoveredPOC, type POCDiscoveryResponse, type OutreachItem } from '@/lib/api'

const CHANNELS = [{ id: 'email', label: 'Email' }, { id: 'linkedin', label: 'LinkedIn InMail' }, { id: 'whatsapp', label: 'WhatsApp Business' }] as const
const TONES = ['consultative', 'roi', 'exec'] as const
const card: React.CSSProperties = { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: 20 }
const field: React.CSSProperties = { width: '100%', padding: 10, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-2)', font: 'inherit' }
const button: React.CSSProperties = { padding: '10px 14px', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--blue)', color: 'white', fontWeight: 700, cursor: 'pointer' }

export default function OutreachPage() {
  const { data: leads = [], isLoading: loadingLeads, isError: leadsError } = usePOCLeads()
  const [leadId, setLeadId] = useState<string | null>(null)
  const [companyQuery] = useState(() => typeof window === 'undefined' ? '' : new URLSearchParams(window.location.search).get('company')?.trim() || '')
  const [pocIndex, setPocIndex] = useState('')
  const [pocs, setPocs] = useState<DiscoveredPOC[]>([])
  const [pocDiscoveryStatus, setPocDiscoveryStatus] = useState<POCDiscoveryResponse['status'] | ''>('')
  const [channel, setChannel] = useState<(typeof CHANNELS)[number]['id']>('email')
  const [tone, setTone] = useState<(typeof TONES)[number]>('consultative')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [savedId, setSavedId] = useState('')
  const [savedRevision, setSavedRevision] = useState('')
  const [generating, setGenerating] = useState(false)
  const [pendingSave, setPendingSave] = useState<Omit<OutreachItem, 'id'> | null>(null)
  const generation = useRef(0)
  const inFlight = useRef(false)
  const abort = useRef<AbortController | null>(null)
  const [reviewConfirmed, setReviewConfirmed] = useState(false)
  const [message, setMessage] = useState('')
  const discovery = useDiscoverPOCs()
  const saveDraft = useAppendOutreach()
  const editDraft = useEditOutreach()
  const changeStatus = useUpdateOutreachStatus()
  const requestedLead = companyQuery ? leads.find(item => item.id === companyQuery || item.company.toLowerCase() === companyQuery.toLowerCase()) : undefined
  const selectedLeadId = leadId === null ? requestedLead?.id || '' : leadId
  const lead = leads.find(item => item.id === selectedLeadId)
  const selectedPoc = pocIndex === '' ? undefined : pocs[Number(pocIndex)]
  const blocked = !lead || (lead.qualificationStatus !== 'qualified' && lead.qualificationStatus !== 'needs_review')
  const reviewRequired = lead?.qualificationStatus === 'needs_review'
  const quality = useMemo(() => [
    { status: lead ? 'PASS' : 'BLOCKED', label: 'Stored lead associated' },
    { status: selectedPoc?.sourceUrl ? 'PASS' : 'BLOCKED', label: 'Discovered POC with source selected' },
    { status: lead?.qualificationStatus === 'qualified' ? 'PASS' : reviewRequired ? 'WARNING' : 'BLOCKED', label: reviewRequired ? 'Qualification needs review' : 'Qualification state' },
    { status: channel === 'email' ? 'WARNING' : channel === 'linkedin' && selectedPoc?.profileUrl ? 'PASS' : 'WARNING', label: channel === 'email' ? 'Email recipient unknown' : channel === 'linkedin' ? 'LinkedIn profile availability' : 'WhatsApp phone unavailable' },
    { status: ['email', 'linkedin', 'whatsapp'].includes(channel) ? 'PASS' : 'BLOCKED', label: 'Supported draft channel selected' },
    { status: body.trim() && !/\[insert|\{\{|prospect@company\.com/i.test(body) ? 'PASS' : 'WARNING', label: 'Message content and placeholders' },
    { status: 'WARNING', label: 'Factual claims require review against the supplied evidence' },
    ...(channel === 'email' ? [{ status: subject.trim() ? 'PASS' : 'BLOCKED', label: 'Email subject present' }] : []),
  ], [lead, selectedPoc, reviewRequired, channel, body, subject])

  useEffect(() => {
    if (!selectedLeadId) return
    const selection = generation.current
    discovery.mutate(selectedLeadId, {
      onSuccess: result => { if (selection === generation.current) { setPocs(result.pocs); setPocDiscoveryStatus(result.status) } },
      onError: error => { if (selection === generation.current) setMessage(error.message || 'POC discovery is unavailable.') },
    })
    // The selection changes are the only trigger; mutation is kept in the query hook.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLeadId])

  useEffect(() => () => { generation.current += 1; abort.current?.abort() }, [])

  function selectLead(nextLeadId: string) {
    generation.current += 1; abort.current?.abort()
    setPocs([]); setPocIndex(''); setPocDiscoveryStatus(''); setSubject(''); setBody(''); setSavedId(''); setReviewConfirmed(false); setMessage('')
    setPendingSave(null); setSavedRevision('')
    setLeadId(nextLeadId)
  }

  function refreshPOCs() {
    if (!selectedLeadId || discovery.isPending || generating || savedId || pendingSave) return
    const selection = generation.current
    setPocIndex(''); setPocs([]); setPocDiscoveryStatus(''); setMessage('')
    discovery.mutate(selectedLeadId, {
      onSuccess: result => { if (selection === generation.current) { setPocs(result.pocs); setPocDiscoveryStatus(result.status) } },
      onError: error => { if (selection === generation.current) setMessage(error.message || 'POC discovery is unavailable.') },
    })
  }

  async function generate() {
    if (!lead || !selectedPoc || inFlight.current || savedId || pendingSave) return
    const current = ++generation.current
    const controller = new AbortController()
    abort.current = controller
    inFlight.current = true
    setGenerating(true)
    setMessage('')
    try {
      const result = await draftEmail({ leadId: lead.id, company: lead.company, poc: selectedPoc, channel, tone }, controller.signal)
      if (current !== generation.current) return
      setSubject(result.subject || '')
      setBody(result.body)
      const recordInput: Omit<OutreachItem, 'id'> = {
        prospectName: selectedPoc.name, email: null, company: lead.company, subject: result.subject || '', body: result.body,
        status: 'DRAFT', leadId: lead.id, poc: selectedPoc, pocId: `${selectedPoc.name.toLowerCase()}|${selectedPoc.sourceUrl}`,
        channel, qualificationStatus: lead.qualificationStatus, qualificationScore: lead.qualificationScore ?? null, reviewAcknowledged: false,
        reviewRequired: lead.qualificationStatus === 'needs_review', qualityChecks: [], clientDraftId: crypto.randomUUID(),
      }
      setPendingSave(recordInput)
      const record = await saveDraft.mutateAsync(recordInput)
      if (current !== generation.current) return
      setSavedId(record.id)
      setSavedRevision(record.updatedAt || '')
      setPendingSave(null)
      setMessage('Evidence-based draft saved. Review and edit it before submitting for approval.')
    } catch (error) {
      if (current === generation.current) {
        const detail = error instanceof Error ? error.message : ''
        if (detail.includes('POC_SELECTION_STALE')) {
          setPocIndex(''); setPendingSave(null); setSubject(''); setBody('')
          setMessage('Selected POC evidence expired or changed. Refresh discovered POCs and select the contact again.')
        } else if (detail.includes('POC_VERIFICATION_UNAVAILABLE')) {
          setMessage('POC verification provider is unavailable. No draft was saved; try again later.')
        } else setMessage(detail || 'Draft generation or save failed. No success was assumed.')
      }
    }
    finally { inFlight.current = false; if (current === generation.current) setGenerating(false) }
  }

  async function retrySave() {
    if (!pendingSave || saveDraft.isPending) return
    try {
      const record = await saveDraft.mutateAsync(pendingSave)
      setSavedId(record.id); setSavedRevision(record.updatedAt || ''); setPendingSave(null)
      setMessage('Draft saved. Review it before submitting for approval.')
    } catch (error) {
      const detail = error instanceof Error ? error.message : ''
      if (detail.includes('POC_SELECTION_STALE')) {
        setPocIndex(''); setPendingSave(null); setSubject(''); setBody('')
        setMessage('Selected POC evidence expired or changed. Refresh discovered POCs and select the contact again.')
      } else setMessage(detail || 'Draft save outcome is unknown. Retry uses the same draft ID.')
    }
  }

  async function submitForApproval() {
    if (!savedId || !lead || !selectedPoc) return
    if (reviewRequired && !reviewConfirmed) { setMessage('Confirm that you reviewed the qualification reasons before submitting.'); return }
    if (quality.some(item => item.status === 'BLOCKED')) { setMessage('Resolve the blocked quality checks before submitting.'); return }
    try {
      const edited = await editDraft.mutateAsync({ id: savedId, subject, body, expectedUpdatedAt: savedRevision })
      await changeStatus.mutateAsync({ id: savedId, status: 'PENDING_APPROVAL', expectedUpdatedAt: edited.updatedAt || savedRevision, reviewAcknowledged: reviewRequired ? reviewConfirmed : false })
      setMessage('Submitted to the Human Approval Inbox. No message has been sent.')
      setSavedId('')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not submit for approval.') }
  }

  return <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
    <header><h1 style={{ fontSize: 28, fontWeight: 900, color: 'var(--text-1)' }}>AI Outreach Studio</h1><p style={{ color: 'var(--text-4)', marginTop: 6 }}>Draft from stored SalesSetu evidence. Human approval and explicit Gmail sending are separate steps.</p></header>
    <div style={{ ...card, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 16 }}>
      <label style={{ color: 'var(--text-4)', fontSize: 12 }}>Stored lead<select style={{ ...field, display: 'block', marginTop: 7 }} value={selectedLeadId} onChange={event => selectLead(event.target.value)} disabled={Boolean(savedId) || generating || Boolean(pendingSave)}><option value="">Select a stored lead</option>{leads.map(item => <option key={item.id} value={item.id}>{item.company}</option>)}</select></label>
      <label style={{ color: 'var(--text-4)', fontSize: 12 }}>Discovered POC<select style={{ ...field, display: 'block', marginTop: 7 }} value={pocIndex} onChange={event => setPocIndex(event.target.value)} disabled={!pocs.length || Boolean(savedId) || generating || Boolean(pendingSave)}><option value="">{discovery.isPending ? 'Discovering sourced contacts…' : pocs.length ? 'Select a discovered POC' : 'No sourced POCs available'}</option>{pocs.map((person, index) => <option key={`${person.name}-${person.sourceUrl}`} value={index}>{person.name}{person.role ? ` — ${person.role}` : ''}</option>)}</select></label>
      <label style={{ color: 'var(--text-4)', fontSize: 12 }}>Channel<select style={{ ...field, display: 'block', marginTop: 7 }} value={channel} onChange={event => setChannel(event.target.value as typeof channel)} disabled={Boolean(savedId) || generating || Boolean(pendingSave)}>{CHANNELS.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
      <label style={{ color: 'var(--text-4)', fontSize: 12 }}>Tone<select style={{ ...field, display: 'block', marginTop: 7 }} value={tone} onChange={event => setTone(event.target.value as typeof tone)} disabled={Boolean(savedId) || generating || Boolean(pendingSave)}>{TONES.map(item => <option key={item} value={item}>{item}</option>)}</select></label>
    </div>
    {lead && !savedId && <button type="button" style={{ ...button, alignSelf: 'flex-start' }} onClick={refreshPOCs} disabled={discovery.isPending || generating || Boolean(pendingSave)}>Refresh discovered POCs</button>}
    {loadingLeads && <p role="status" style={{ color: 'var(--text-4)' }}>Loading stored leads…</p>}
    {leadsError && <p role="alert" style={{ color: '#FB7185' }}>Could not load stored leads. Demo prospects are not used for live outreach.</p>}
    {pocDiscoveryStatus === 'insufficient_evidence' && pocs.length === 0 && <p role="status" style={{ color: 'var(--text-4)' }}>No source-backed POCs were found for this company yet.</p>}
    {lead && <div style={{ ...card, lineHeight: 1.7, color: 'var(--text-3)' }}>
      <strong style={{ color: 'var(--text-1)' }}>{lead.company}</strong> · {lead.industry || 'Industry unknown'} · {[lead.city, lead.country].filter(Boolean).join(', ') || 'Location unknown'} · Employees: {lead.employees || 'Unknown'}<br />
      Qualification: <strong>{lead.qualificationStatus?.replace('_', ' ').toUpperCase() || 'NOT YET QUALIFIED'}</strong>{lead.qualificationScore != null ? ` (${lead.qualificationScore}/100)` : ''}{lead.qualificationReasons?.length ? <ul>{lead.qualificationReasons.map((reason, index) => <li key={index}>{reason}</li>)}</ul> : null}
      {reviewRequired && <label style={{ display: 'block', color: '#FBBF24' }}><input type="checkbox" checked={reviewConfirmed} onChange={event => setReviewConfirmed(event.target.checked)} /> I reviewed the qualification reasons; keep this review warning with the draft.</label>}
    </div>}
    {selectedPoc && <div style={card}><strong>{selectedPoc.name}</strong> · {selectedPoc.role || 'Role unknown'} · {selectedPoc.department || 'Department unknown'}<br />Email: Unknown · Profile: {selectedPoc.profileUrl ? <a href={selectedPoc.profileUrl} target="_blank" rel="noreferrer">Sourced profile</a> : 'Unknown'} · <a href={selectedPoc.sourceUrl} target="_blank" rel="noreferrer">Source</a> · {Math.round(selectedPoc.confidence * 100)}% evidence confidence<br />{selectedPoc.relevanceReason || 'Relevance not established by available evidence.'}</div>}
    <div style={{ ...card }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}><strong>Deterministic quality checks</strong><button type="button" style={button} onClick={generate} disabled={blocked || !selectedPoc || generating || saveDraft.isPending || Boolean(savedId) || Boolean(pendingSave)}>{generating || saveDraft.isPending ? 'Generating…' : 'Generate AI draft'}</button></div><ul style={{ color: 'var(--text-3)', lineHeight: 1.8 }}>{quality.map(item => <li key={item.label}><b style={{ color: item.status === 'PASS' ? '#34D399' : item.status === 'WARNING' ? '#FBBF24' : '#FB7185' }}>{item.status}</b> — {item.label}</li>)}</ul>{lead?.qualificationStatus === 'not_qualified' && <p style={{ color: '#FB7185' }}>Outreach is blocked because this lead is not qualified.</p>}{lead && !lead.qualificationStatus && <p style={{ color: '#FB7185' }}>Qualify this lead before generating outreach.</p>}</div>
    {pendingSave && !generating && <div style={card}><p>AI draft generated, but saving was not confirmed. Retry the same save without generating a second message.</p><button type="button" style={button} disabled={saveDraft.isPending} onClick={retrySave}>Retry draft save</button></div>}
    {savedId && <div style={card}><label style={{ display: 'block', color: 'var(--text-4)' }}>Subject<input style={{ ...field, marginTop: 6 }} value={subject} onChange={event => setSubject(event.target.value)} /></label><label style={{ display: 'block', color: 'var(--text-4)', marginTop: 12 }}>Message<textarea style={{ ...field, marginTop: 6, minHeight: 220 }} value={body} onChange={event => setBody(event.target.value)} /></label><p style={{ color: '#FBBF24', margin: '12px 0' }}>Submitting saves this draft for human approval. Recipient confirmation and explicit Gmail sending happen in the Approval Inbox; nothing is sent here.</p><button style={button} onClick={submitForApproval} disabled={editDraft.isPending || changeStatus.isPending}>Submit for human approval</button></div>}
    {message && <p role="status" style={{ ...card, color: 'var(--text-2)' }}>{message}</p>}
  </div>
}
