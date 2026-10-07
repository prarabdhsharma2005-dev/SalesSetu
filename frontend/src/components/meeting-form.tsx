'use client'

import { useState, type FormEvent } from 'react'
import type { Meeting, MeetingDetails, MeetingStatus, MeetingType } from '@/lib/api'
import { useAppendMeeting, useUpdateMeeting, usePOCLeads, useOutreach, useMeetingDeals } from '@/lib/use-backend'
import { meetingAssociations, toLocalDateTime, toUtcScheduledAt } from '@/lib/meeting-utils'

const field = { width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-1)', font: 'inherit' }
const label = { display: 'flex', flexDirection: 'column' as const, gap: '6px', fontSize: '13px', color: 'var(--text-3)' }
export const meetingButton = { padding: '10px 16px', borderRadius: '9px', border: '1px solid var(--border)', background: 'var(--blue)', color: 'white', cursor: 'pointer', font: 'inherit' }
export const meetingCard = { padding: '20px', borderRadius: '14px', border: '1px solid var(--border)', background: 'var(--bg-card)' }

export function MeetingForm({ meeting, onClose, onSaved }: { meeting?: Meeting; onClose: () => void; onSaved: () => void }) {
  const leads = usePOCLeads()
  const outreach = useOutreach()
  const deals = useMeetingDeals()
  const create = useAppendMeeting()
  const update = useUpdateMeeting()
  const [leadId, setLeadId] = useState(meeting?.leadId || '')
  const [pocId, setPocId] = useState('')
  const [outreachId, setOutreachId] = useState('')
  const [dealId, setDealId] = useState('')
  const [title, setTitle] = useState(meeting?.title || '')
  const [localTime, setLocalTime] = useState(toLocalDateTime(meeting?.scheduledAt))
  const [duration, setDuration] = useState(meeting?.duration?.toString() || '')
  const [meetingType, setMeetingType] = useState<MeetingType | ''>(meeting ? meeting.meetingType || '' : 'DISCOVERY')
  const [status, setStatus] = useState<MeetingStatus | ''>(meeting ? meeting.status || '' : 'SCHEDULED')
  const [attendees, setAttendees] = useState(meeting?.attendees || '')
  const [notes, setNotes] = useState(meeting?.notes || '')
  const [error, setError] = useState('')
  const pending = create.isPending || update.isPending
  const lead = leads.data?.find(item => item.id === leadId)
  const choices = meetingAssociations(lead, outreach.data || [], deals.data || [])

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    setError('')
    try {
      if (!meetingType || !status) throw new Error('Select a meeting type and status.')
      const details: MeetingDetails = {
        title, scheduledAt: toUtcScheduledAt(localTime), duration: duration === '' ? null : Number(duration),
        meetingType, status, attendees, notes,
      }
      if (meeting) await update.mutateAsync({ id: meeting.id, updates: details })
      else await create.mutateAsync({ ...details, leadId, pocId: pocId || null, outreachId: outreachId || null, dealId: dealId || null })
      onSaved()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save the meeting.')
    }
  }

  return <form onSubmit={save} style={meetingCard} aria-label={meeting ? 'Edit meeting' : 'Create meeting'}>
    <h2 style={{ fontSize: '18px', marginBottom: '16px' }}>{meeting ? 'Edit meeting' : 'Create meeting'}</h2>
    <fieldset disabled={pending} style={{ border: 0, padding: 0, margin: 0 }}>
      {meeting ? <p style={{ marginBottom: '16px', color: 'var(--text-3)' }}>
        {meeting.company || 'Company unknown'} · Lead: {meeting.leadId || 'Unlinked'} · POC: {meeting.poc?.name || 'Unlinked'}
        <br />Existing lead, POC, outreach, and deal associations are retained.
      </p> : <>
        {leads.isPending && <p role="status">Loading stored leads…</p>}
        {leads.isError && <p role="alert">Could not load leads. <button type="button" onClick={() => leads.refetch()}>Retry</button></p>}
        {!leads.isPending && !leads.isError && !leads.data?.length && <p>No stored leads are available. Add a lead before creating a meeting.</p>}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '14px' }}>
          <label style={label}>Lead / Company<select style={field} required value={leadId} onChange={event => { setLeadId(event.target.value); setPocId(''); setOutreachId(''); setDealId('') }}>
            <option value="">Select a stored lead</option>{leads.data?.map(item => <option key={item.id} value={item.id}>{item.company} ({item.id})</option>)}
          </select></label>
          <label style={label}>POC (optional)<select style={field} value={pocId} disabled={!lead || outreach.isPending || outreach.isError} onChange={event => { setPocId(event.target.value); setOutreachId('') }}>
            <option value="">Unlinked — no POC selected</option>{choices.pocs.map(item => <option key={item.pocId} value={item.pocId}>{item.poc?.name} · {item.poc?.role || 'Role unknown'}</option>)}
          </select></label>
          <label style={label}>Outreach (optional)<select style={field} value={outreachId} disabled={!lead || outreach.isPending || outreach.isError} onChange={event => setOutreachId(event.target.value)}>
            <option value="">Unlinked</option>{choices.outreach.filter(item => !pocId || item.pocId === pocId).map(item => <option key={item.id} value={item.id}>{item.subject || item.id} · {item.prospectName}</option>)}
          </select></label>
          <label style={label}>Deal (optional)<select style={field} value={dealId} disabled={!lead || deals.isPending || deals.isError} onChange={event => setDealId(event.target.value)}>
            <option value="">Unlinked</option>{choices.deals.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
          </select></label>
        </div>
        <p style={{ fontSize: '12px', color: 'var(--text-4)', marginBottom: '14px' }}>POCs come from this lead’s saved sourced Outreach records. No new discovery is run. A meeting may be saved without a POC.</p>
        {outreach.isError && <p role="alert">Stored POCs/outreach could not be loaded. <button type="button" onClick={() => outreach.refetch()}>Retry</button></p>}
        {deals.isError && <p role="alert">Deals could not be loaded. <button type="button" onClick={() => deals.refetch()}>Retry</button></p>}
      </>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
        <label style={label}>Title<input style={field} required maxLength={300} value={title} onChange={event => setTitle(event.target.value)} /></label>
        <label style={label}>Date and time (your local timezone)<input style={field} required type="datetime-local" value={localTime} onChange={event => setLocalTime(event.target.value)} /></label>
        <label style={label}>Duration in minutes (optional)<input style={field} type="number" min={1} max={1440} step={1} value={duration} onChange={event => setDuration(event.target.value)} /></label>
        <label style={label}>Meeting type<select style={field} required value={meetingType} onChange={event => setMeetingType(event.target.value as MeetingType)}>
          <option value="">Unknown — choose a type</option>{(['DISCOVERY', 'DEMO', 'FOLLOW_UP', 'NEGOTIATION', 'OTHER'] as const).map(value => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}
        </select></label>
        <label style={label}>Status<select style={field} required value={status} onChange={event => setStatus(event.target.value as MeetingStatus)}>
          <option value="">Unknown — choose a status</option>{(['SCHEDULED', 'COMPLETED', 'CANCELLED'] as const).map(value => <option key={value} value={value}>{value}</option>)}
        </select></label>
        <label style={label}>Attendees (optional)<input style={field} maxLength={5000} value={attendees} onChange={event => setAttendees(event.target.value)} /></label>
      </div>
      <label style={{ ...label, marginTop: '14px' }}>Notes<textarea style={field} rows={4} maxLength={20000} value={notes} onChange={event => setNotes(event.target.value)} /></label>
      {error && <p role="alert" style={{ color: '#FB7185', marginTop: '12px' }}>{error}</p>}
      <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
        <button type="submit" style={meetingButton} disabled={pending || (!meeting && (!lead || leads.isError))}>{pending ? 'Saving…' : 'Save meeting'}</button>
        <button type="button" style={{ ...meetingButton, background: 'var(--bg-elevated)' }} onClick={onClose}>Cancel</button>
      </div>
    </fieldset>
  </form>
}
