import type { Meeting } from '@/lib/api'
import { meetingTimeLabel } from '@/lib/meeting-utils'
import { meetingButton, meetingCard } from './meeting-form'

export function MeetingList({ meetings, loading, error, onRetry, onEdit, onOpen }: {
  meetings: Meeting[]; loading: boolean; error: Error | null; onRetry: () => void; onEdit: (meeting: Meeting) => void; onOpen?: (meeting: Meeting) => void
}) {
  if (loading) return <p role="status">Loading meetings…</p>
  if (error) return <div role="alert" style={meetingCard}>Could not load meetings: {error.message} <button type="button" style={meetingButton} onClick={onRetry}>Retry</button></div>
  if (!meetings.length) return <p style={meetingCard}>No meetings saved yet. Use Schedule Meeting to create one.</p>
  return <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>{meetings.map(meeting => <article key={meeting.id} style={meetingCard}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: '12px' }}>
      <div><h2 style={{ fontSize: '17px', fontWeight: 700 }}>{meeting.title || 'Untitled legacy meeting'}</h2><p style={{ color: 'var(--text-3)', marginTop: '6px' }}>{meeting.company || 'Company unknown'} · {meeting.poc?.name || 'POC unlinked'}</p></div>
      <div style={{ display: 'flex', gap: '8px' }}>{onOpen && <button type="button" style={meetingButton} onClick={() => onOpen(meeting)}>MoM & outcome</button>}<button type="button" style={meetingButton} onClick={() => onEdit(meeting)}>Edit meeting</button></div>
    </div>
    <p style={{ marginTop: '12px' }}>{meetingTimeLabel(meeting)} · {meeting.duration ? `${meeting.duration} minutes` : 'Duration unknown'}</p>
    <p style={{ color: 'var(--text-4)', marginTop: '6px' }}>{meeting.meetingType?.replaceAll('_', ' ') || 'Type unknown'} · {meeting.status || 'Status unknown'} · Source: {meeting.source || 'Unknown'}</p>
    <p style={{ color: 'var(--text-4)', marginTop: '6px' }}>Lead: {meeting.leadId || 'Unlinked (legacy record)'} · Outreach: {meeting.outreachId || 'Unlinked'} · Deal: {meeting.dealId || 'Unlinked'}</p>
    {meeting.poc && <p style={{ color: 'var(--text-4)', marginTop: '6px' }}>{meeting.poc.role || 'Role unknown'} · {meeting.poc.department || 'Department unknown'} · POC ID: {meeting.pocId || 'Unlinked'}<br />Stored source: {meeting.poc.sourceUrl || 'Unknown'}</p>}
    <p style={{ marginTop: '10px' }}>Attendees: {meeting.attendees || 'Not recorded'}</p>
    <p style={{ marginTop: '10px', whiteSpace: 'pre-wrap' }}>Notes: {meeting.notes || 'Not recorded'}</p>
    {meeting.summary && <p style={{ marginTop: '10px', whiteSpace: 'pre-wrap' }}>Existing summary: {meeting.summary}</p>}
    {meeting.actionItems && <p style={{ marginTop: '10px', whiteSpace: 'pre-wrap' }}>Existing action items: {meeting.actionItems}</p>}
  </article>)}</div>
}
