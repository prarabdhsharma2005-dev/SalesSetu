'use client'

import { useState } from 'react'
import type { Meeting } from '@/lib/api'
import { useMeetings } from '@/lib/use-backend'
import { MeetingForm, meetingButton, meetingCard } from '@/components/meeting-form'
import { MeetingList } from '@/components/meeting-list'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export default function CalendarPage() {
  const query = useMeetings()
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  const [editor, setEditor] = useState<Meeting | 'new' | null>(null)
  const [notice, setNotice] = useState('')
  const meetings = query.isError ? [] : query.data || []
  const today = new Date()
  const offset = (month.getDay() + 6) % 7
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  const cellCount = Math.ceil((offset + daysInMonth) / 7) * 7

  return <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
      <div>
        <h1 style={{ fontSize: '28px', fontWeight: 900, color: 'var(--text-1)' }}>Sales Calendar</h1>
        <p style={{ color: 'var(--text-4)', marginTop: '6px' }}>Stored meetings in your local timezone. External calendar booking is not connected.</p>
      </div>
      <button type="button" style={meetingButton} disabled={editor !== null} onClick={() => { setEditor('new'); setNotice('') }}>Schedule Meeting</button>
    </div>
    {notice && <p role="status">{notice}</p>}
    {editor && <MeetingForm key={editor === 'new' ? 'new' : editor.id} meeting={editor === 'new' ? undefined : editor} onClose={() => setEditor(null)} onSaved={() => { setEditor(null); setNotice('Meeting saved.') }} />}
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', alignItems: 'start' }}>
      <div style={meetingCard}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', gap: '8px' }}>
          <button type="button" aria-label="Previous month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>←</button>
          <h2>{month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h2>
          <button type="button" aria-label="Next month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>→</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
          {DAYS.map(day => <div key={day} style={{ textAlign: 'center', fontSize: '12px', padding: '8px 0', color: 'var(--text-4)' }}>{day}</div>)}
          {Array.from({ length: cellCount }, (_, index) => {
            const day = index - offset + 1
            const valid = day > 0 && day <= daysInMonth
            const isToday = valid && day === today.getDate() && month.getMonth() === today.getMonth() && month.getFullYear() === today.getFullYear()
            const dayMeetings = valid ? meetings.filter(meeting => {
              if (!meeting.scheduledAt || meeting.status === 'CANCELLED') return false
              const date = new Date(meeting.scheduledAt)
              return date.getDate() === day && date.getMonth() === month.getMonth() && date.getFullYear() === month.getFullYear()
            }) : []
            return <div key={index} title={dayMeetings.map(meeting => meeting.title).join('\n')} style={{ minHeight: '54px', padding: '8px 2px', textAlign: 'center', borderRadius: '9px', background: isToday ? 'var(--blue)' : dayMeetings.length ? 'rgba(59,130,246,0.12)' : 'transparent' }}>
              {valid && <>{day}{dayMeetings.length > 0 && <div style={{ fontSize: '10px', marginTop: '4px' }}>{dayMeetings.length} meeting{dayMeetings.length === 1 ? '' : 's'}</div>}</>}
            </div>
          })}
        </div>
      </div>
      <div>
        <h2 style={{ marginBottom: '16px', fontWeight: 700 }}>Saved meetings</h2>
        <MeetingList meetings={meetings} loading={query.isPending} error={query.error} onRetry={() => { void query.refetch() }} onEdit={meeting => { setEditor(meeting); setNotice('') }} />
      </div>
    </div>
  </div>
}
