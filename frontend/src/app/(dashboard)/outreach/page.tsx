'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useAppendOutreach, useDiscoverPOCs, useEditOutreach, usePOCLeads, useUpdateOutreachStatus } from '@/lib/use-backend'
import { draftEmail, getSalesContext, saveSalesContext, type SalesContext, type DiscoveredPOC, type POCDiscoveryResponse, type OutreachItem } from '@/lib/api'
import { outreachDraftErrorMessage } from '@/lib/outreach-draft-error'

const CHANNELS = [{ id: 'email', label: 'Email' }, { id: 'linkedin', label: 'LinkedIn InMail' }, { id: 'whatsapp', label: 'WhatsApp Business' }] as const
const TONES = ['consultative', 'roi', 'exec'] as const
const card: React.CSSProperties = { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: 20, minWidth: 0, overflowWrap: 'anywhere' }
const field: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: 10, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-2)', font: 'inherit' }
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
  const [draftOrigin, setDraftOrigin] = useState<'AI' | 'MANUAL' | null>(null)
  const [generating, setGenerating] = useState(false)
  const [pendingSave, setPendingSave] = useState<Omit<OutreachItem, 'id'> | null>(null)
  const generation = useRef(0)
  const inFlight = useRef(false)
  const abort = useRef<AbortController | null>(null)
  const [reviewConfirmed, setReviewConfirmed] = useState(false)
  const [message, setMessage] = useState('')
  const [salesContext, setSalesContext] = useState<SalesContext>({ sellerName: '', sellerCompany: '', productName: '', productDescription: '' })
  const [contextState, setContextState] = useState<'loading' | 'saved' | 'missing' | 'legacy' | 'error'>('loading')
  const [savingContext, setSavingContext] = useState(false)
  const discovery = useDiscoverPOCs()
  const saveDraft = useAppendOutreach()
  const editDraft = useEditOutreach()
  const changeStatus = useUpdateOutreachStatus()
  const requestedLead = companyQuery ? leads.find(item => item.id === companyQuery || item.company.toLowerCase() === companyQuery.toLowerCase()) : undefined
  const selectedLeadId = leadId === null ? requestedLead?.id || '' : leadId
  const lead = leads.find(item => item.id === selectedLeadId)
  const selectedPoc = pocIndex === '' ? undefined : pocs[Number(pocIndex)]
  const reviewRequired = lead?.qualificationStatus === 'needs_review'
  useEffect(() => {
    let active = true
    getSalesContext().then(({ context }) => {
      if (!active) return
      if (context) setSalesContext(context)
      setContextState(context ? 'saved' : 'missing')
    }).catch(error => {
      if (!active) return
      setContextState(error instanceof Error && error.message.includes('API 404') ? 'legacy' : 'error')
    })
    return () => { active = false }
  }, [])

  async function persistSalesContext() {
    setSavingContext(true); setMessage('')
    try {
      const saved = await saveSalesContext(salesContext)
      setSalesContext(saved.context); setContextState('saved')
      setMessage('Seller and product context saved to this workspace.')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not save seller context.') }
    finally { setSavingContext(false) }
  }
  const quality = useMemo(() => [
    { status: lead ? 'PASS' : 'BLOCKED', label: 'Stored lead associated' },
    { status: selectedPoc?.sourceUrl ? 'PASS' : 'BLOCKED', label: 'Discovered POC with source selected' },
    { status: lead?.qualificationStatus === 'qualified' && !lead.qualificationIcpStale && !lead.qualificationResearchStale ? 'PASS' : 'WARNING', label: lead?.qualificationResearchStale ? 'Research changed; requalification is recommended' : lead?.qualificationIcpStale ? 'ICP changed; requalification is recommended' : reviewRequired ? 'Qualification needs review; outreach remains available' : lead?.qualificationStatus === 'not_qualified' ? 'Not qualified; review the reasons before outreach' : 'Qualification is advisory; outreach remains available' },
    { status: channel === 'email' ? 'WARNING' : channel === 'linkedin' && selectedPoc?.profileUrl ? 'PASS' : 'WARNING', label: channel === 'email' ? 'Email recipient unknown' : channel === 'linkedin' ? 'LinkedIn profile availability' : 'WhatsApp phone unavailable' },
    { status: ['email', 'linkedin', 'whatsapp'].includes(channel) ? 'PASS' : 'BLOCKED', label: 'Supported draft channel selected' },
    { status: body.trim() && !/\[insert|\{\{|prospect@company\.com/i.test(body) ? 'PASS' : 'WARNING', label: 'Message content and placeholders' },
    { status: 'WARNING', label: 'Factual claims require review against the supplied evidence' },
    ...(channel === 'email' ? [{ status: subject.trim() ? 'PASS' : 'WARNING', label: 'Email subject required before submission' }] : []),
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
    setPendingSave(null); setSavedRevision(''); setDraftOrigin(null)
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
        reviewRequired: lead.qualificationStatus === 'needs_review', qualityChecks: [], clientDraftId: crypto.randomUUID(), draftOrigin: 'AI',
      }
      setPendingSave(recordInput)
      const record = await saveDraft.mutateAsync(recordInput)
      if (current !== generation.current) return
      setSavedId(record.id)
      setDraftOrigin('AI')
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
        } else if (detail.includes('COMPANY_RESEARCH_REQUIRED')) {
          setMessage('Research this saved lead and review its sources before drafting.')
        } else if (detail.includes('SELLER_CONTEXT_REQUIRED')) {
          setMessage('Save your seller and product context in this workspace before drafting.')
        } else setMessage(outreachDraftErrorMessage(error))
      }
    }
    finally { inFlight.current = false; if (current === generation.current) setGenerating(false) }
  }

  async function saveManualDraft() {
    if (!lead || !selectedPoc || generating || saveDraft.isPending || savedId || pendingSave) return
    if (!body.trim() || (channel === 'email' && !subject.trim())) {
      setMessage('Write a message and email subject before saving a manual draft.')
      return
    }
    const recordInput: Omit<OutreachItem, 'id'> = {
      prospectName: selectedPoc.name, email: null, company: lead.company, subject, body,
      status: 'DRAFT', leadId: lead.id, poc: selectedPoc, pocId: `${selectedPoc.name.toLowerCase()}|${selectedPoc.sourceUrl}`,
      channel, qualificationStatus: lead.qualificationStatus, qualificationScore: lead.qualificationScore ?? null,
      reviewAcknowledged: false, reviewRequired: lead.qualificationStatus === 'needs_review', qualityChecks: [],
      clientDraftId: crypto.randomUUID(), draftOrigin: 'MANUAL',
    }
    setPendingSave(recordInput)
    setMessage('')
    try {
      const record = await saveDraft.mutateAsync(recordInput)
      setSavedId(record.id); setSavedRevision(record.updatedAt || ''); setPendingSave(null); setDraftOrigin('MANUAL')
      setMessage('Manual draft saved. Review and edit it before submitting for approval. No AI was used.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Manual draft save was not confirmed. Retry the same save.')
    }
  }

  async function retrySave() {
    if (!pendingSave || saveDraft.isPending) return
    try {
      const record = await saveDraft.mutateAsync(pendingSave)
      setSavedId(record.id); setSavedRevision(record.updatedAt || ''); setPendingSave(null); setDraftOrigin(record.draftOrigin || null)
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
    if (!body.trim() || (channel === 'email' && !subject.trim())) { setMessage('Add a message body and email subject before submitting for approval.'); return }
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
    {contextState !== 'legacy' && <section style={card}><strong>Seller and product context</strong><p style={{ color: 'var(--text-4)' }}>Save your own details for this workspace. Drafting uses only these details and saved company evidence.</p>
      {contextState === 'loading' && <p role="status">Loading saved context…</p>}
      {contextState === 'error' && <p role="alert">Could not load seller context. Reload this page before drafting.</p>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,220px),1fr))', gap: 12 }}>
        {([['sellerName', 'Your name'], ['sellerCompany', 'Your company'], ['productName', 'Product name']] as const).map(([key, label]) => <label key={key}>{label}<input style={field} value={salesContext[key]} maxLength={120} onChange={event => { setSalesContext(previous => ({ ...previous, [key]: event.target.value })); setContextState('missing') }} /></label>)}
      </div>
      <label style={{ display: 'block', marginTop: 12 }}>What your product does<textarea style={{ ...field, minHeight: 85 }} value={salesContext.productDescription} maxLength={1000} onChange={event => { setSalesContext(previous => ({ ...previous, productDescription: event.target.value })); setContextState('missing') }} /></label>
      <button type="button" style={button} onClick={persistSalesContext} disabled={savingContext || contextState === 'loading'}>{savingContext ? 'Saving…' : 'Save seller context'}</button>
      {contextState === 'saved' && <span role="status" style={{ marginLeft: 10 }}>Saved for this workspace</span>}
    </section>}
    <div style={{ ...card, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,230px),1fr))', gap: 16 }}>
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
      {lead.qualificationEvidence?.length ? <details><summary>Qualification evidence ({lead.qualificationEvidence.length})</summary><ul>{lead.qualificationEvidence.map((item, index) => <li key={index}>{item.field}: {item.value} ({item.origin.replaceAll('_', ' ')}){item.sourceUrl && <> · <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">Source</a></>}</li>)}</ul></details> : null}
      {reviewRequired && <label style={{ display: 'block', color: '#FBBF24' }}><input type="checkbox" checked={reviewConfirmed} onChange={event => setReviewConfirmed(event.target.checked)} /> I reviewed the qualification reasons; keep this review warning with the draft.</label>}
      {(lead.qualificationStatus !== 'qualified' || lead.qualificationIcpStale || lead.qualificationResearchStale || !lead.companyResearch?.summary) && <p><Link href={`/companies/${encodeURIComponent(lead.id)}`}>{!lead.companyResearch?.summary ? 'Research this saved lead before drafting' : 'Review or update qualification (optional)'}</Link></p>}
    </div>}
    {selectedPoc && <div style={card}><strong>{selectedPoc.name}</strong> · {selectedPoc.role || 'Role unknown'} · {selectedPoc.department || 'Department unknown'}<br />Email: Unknown · Profile: {selectedPoc.profileUrl ? <a href={selectedPoc.profileUrl} target="_blank" rel="noreferrer">Sourced profile</a> : 'Unknown'} · <a href={selectedPoc.sourceUrl} target="_blank" rel="noreferrer">Source</a> · {Math.round(selectedPoc.confidence * 100)}% evidence confidence<br />{selectedPoc.relevanceReason || 'Relevance not established by available evidence.'}</div>}
    <div style={{ ...card }}><div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}><strong>Deterministic quality checks</strong><button type="button" style={button} onClick={generate} disabled={!lead || (contextState !== 'saved' && contextState !== 'legacy') || (contextState !== 'legacy' && !lead?.companyResearch?.summary) || !selectedPoc || generating || saveDraft.isPending || Boolean(savedId) || Boolean(pendingSave)}>{generating || saveDraft.isPending ? 'Generating…' : 'Generate AI draft'}</button></div><ul style={{ color: 'var(--text-3)', lineHeight: 1.8 }}>{quality.map(item => <li key={item.label}><b style={{ color: item.status === 'PASS' ? '#34D399' : item.status === 'WARNING' ? '#FBBF24' : '#FB7185' }}>{item.status}</b> — {item.label}</li>)}</ul>{lead?.qualificationStatus === 'not_qualified' && <p style={{ color: '#FBBF24' }}>Qualification suggests this lead is not a fit. Review the reasons; outreach remains your decision.</p>}{lead && !lead.qualificationStatus && <p style={{ color: '#FBBF24' }}>No qualification assessment yet. You may draft outreach, or qualify this lead for guidance.</p>}{(lead?.qualificationIcpStale || lead?.qualificationResearchStale) && <p style={{ color: '#FBBF24' }}>The saved assessment is stale. Requalify for current guidance; outreach remains available.</p>}</div>
    {pendingSave && !generating && <div style={card}><p>{pendingSave.draftOrigin === 'MANUAL' ? 'Manual draft save was not confirmed.' : 'AI draft generated, but saving was not confirmed.'} Retry the same save without creating another draft.</p><button type="button" style={button} disabled={saveDraft.isPending} onClick={retrySave}>Retry draft save</button></div>}
    {((lead && selectedPoc && !pendingSave) || savedId) && <div style={card}><strong>{savedId ? draftOrigin === 'MANUAL' ? 'Manual draft' : 'Saved draft' : 'Write a manual draft (no AI request)'}</strong><label style={{ display: 'block', color: 'var(--text-4)', marginTop: 12 }}>Subject<input style={{ ...field, marginTop: 6 }} value={subject} onChange={event => setSubject(event.target.value)} /></label><label style={{ display: 'block', color: 'var(--text-4)', marginTop: 12 }}>Message<textarea style={{ ...field, marginTop: 6, minHeight: 220 }} value={body} onChange={event => setBody(event.target.value)} /></label><p style={{ color: '#FBBF24', margin: '12px 0' }}>Recipient confirmation and explicit Gmail sending happen in the Approval Inbox; nothing is sent here.</p>{savedId ? <button type="button" style={button} onClick={submitForApproval} disabled={editDraft.isPending || changeStatus.isPending}>Submit for human approval</button> : <button type="button" style={button} onClick={saveManualDraft} disabled={generating || saveDraft.isPending || !body.trim() || (channel === 'email' && !subject.trim())}>{saveDraft.isPending ? 'Saving…' : 'Save manual draft'}</button>}</div>}
    {message && <p role="status" style={{ ...card, color: 'var(--text-2)' }}>{message}</p>}
  </div>
}
