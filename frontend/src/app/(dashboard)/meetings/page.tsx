'use client'

import { useState, useSyncExternalStore } from 'react'
import type { Meeting } from '@/lib/api'
import { useMeetings } from '@/lib/use-backend'
import { MeetingForm, meetingButton } from '@/components/meeting-form'
import { MeetingList } from '@/components/meeting-list'
import { MeetingWorkflowPanel } from '@/components/meeting-workflow'
import { NextBestActions } from '@/components/next-best-actions'

export default function MeetingsPage() {
  const meetings = useMeetings()
  const [editor, setEditor] = useState<Meeting | 'new' | null>(null)
  const [notice, setNotice] = useState('')
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null)
  const linkedMeetingId = useSyncExternalStore(
    (notify) => { window.addEventListener('popstate', notify); return () => window.removeEventListener('popstate', notify) },
    () => new URLSearchParams(window.location.search).get('meetingId'),
    () => null,
  )
  const workflowMeetingId = selectedMeetingId || linkedMeetingId
  const closeWorkflow = () => { window.history.replaceState(null, '', '/meetings'); setSelectedMeetingId(null) }

  return <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
      <div>
        <h1 style={{ fontSize: '28px', fontWeight: 900, color: 'var(--text-1)' }}>Meetings</h1>
        <p style={{ color: 'var(--text-4)', marginTop: '6px' }}>Stored meetings and notes. Times are shown in your local timezone.</p>
      </div>
      <button type="button" style={meetingButton} disabled={editor !== null} onClick={() => { setEditor('new'); setNotice('') }}>Schedule Meeting</button>
    </div>
    {notice && <p role="status">{notice}</p>}
    <NextBestActions />
    {workflowMeetingId && <MeetingWorkflowPanel key={workflowMeetingId} meetingId={workflowMeetingId} onClose={closeWorkflow} />}
    {editor && <MeetingForm key={editor === 'new' ? 'new' : editor.id} meeting={editor === 'new' ? undefined : editor} onClose={() => setEditor(null)} onSaved={() => { setEditor(null); setNotice('Meeting saved.') }} />}
    <MeetingList meetings={meetings.data || []} loading={meetings.isPending} error={meetings.error} onRetry={() => { void meetings.refetch() }} onOpen={meeting => { setSelectedMeetingId(meeting.id); setEditor(null); setNotice('') }} onEdit={meeting => { setEditor(meeting); setSelectedMeetingId(null); setNotice('') }} />
  </div>
}
