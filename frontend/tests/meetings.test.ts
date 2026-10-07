import assert from 'node:assert/strict'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  appendMeeting, applyMeetingOutcome, createMeetingTask, generateMeetingMom, getMeetingWorkflow, getMeetings,
  linkMeetingDeal, reviewMeetingMom, reviewMeetingOutcome, saveMeetingMom, saveMeetingOutcome,
  updateMeeting, updateMeetingTask, type Lead, type Deal, type OutreachItem, type Meeting,
  type MeetingWorkflow, type NewMeeting,
} from '../src/lib/api'
import { meetingAssociations, toLocalDateTime, toUtcScheduledAt } from '../src/lib/meeting-utils'
import { MeetingList } from '../src/components/meeting-list'
import { MeetingWorkflowPanel } from '../src/components/meeting-workflow'
import MeetingsPage from '../src/app/(dashboard)/meetings/page'
import CalendarPage from '../src/app/(dashboard)/calendar/page'

test('meeting client creates, reads, edits, and rereads with stable IDs and UTC times', async () => {
  const originalFetch = globalThis.fetch
  const records: Meeting[] = []
  const calls: Array<{ url: string; method: string }> = []
  const input: NewMeeting = { title: 'A real meeting', leadId: 'lead-test', pocId: 'poc-test', outreachId: 'outreach-test', dealId: 'deal-test', scheduledAt: '2026-10-10T10:00:00.000Z', meetingType: 'DISCOVERY', status: 'SCHEDULED', notes: 'Initial notes' }
  globalThis.fetch = async (url, init) => {
    const method = init?.method || 'GET'
    calls.push({ url: String(url), method })
    if (method === 'POST') records.push({ ...JSON.parse(String(init?.body)), id: 'meeting-test', company: 'Stored company' })
    if (method === 'PATCH') Object.assign(records[0], JSON.parse(String(init?.body)))
    return new Response(JSON.stringify(method === 'GET' ? { total: records.length, meetings: records } : records[0]), { status: method === 'POST' ? 201 : 200 })
  }
  try {
    const created = await appendMeeting(input)
    assert.equal(created.pocId, 'poc-test')
    assert.equal((await getMeetings()).meetings[0].scheduledAt, input.scheduledAt)
    await updateMeeting(created.id, { notes: 'Updated notes', status: 'COMPLETED' })
    const reloaded = (await getMeetings()).meetings[0]
    assert.equal(reloaded.notes, 'Updated notes')
    assert.equal(reloaded.leadId, input.leadId)
    assert.equal(reloaded.outreachId, input.outreachId)
    assert.deepEqual(calls.map(call => call.method), ['POST', 'GET', 'PATCH', 'GET'])
    assert.equal(calls[2].url, '/api/backend/api/sheets/meetings/meeting-test')
  } finally { globalThis.fetch = originalFetch }
})

test('meeting API surfaces errors and preserves empty results', async () => {
  const originalFetch = globalThis.fetch
  try {
    globalThis.fetch = async () => new Response(JSON.stringify({ total: 0, meetings: [] }))
    assert.deepEqual((await getMeetings()).meetings, [])
    globalThis.fetch = async () => new Response(JSON.stringify({ error: 'Could not load meetings.' }), { status: 500 })
    await assert.rejects(getMeetings, /Could not load meetings/)
    await assert.rejects(() => updateMeeting('unknown', { title: 'Change' }), /API 500/)
  } finally { globalThis.fetch = originalFetch }
})

test('local meeting time converts to UTC and round-trips without changing the selected time', () => {
  const local = '2026-10-10T15:30'
  const utc = toUtcScheduledAt(local)
  assert.match(utc, /Z$/)
  assert.equal(toLocalDateTime(utc), local)
  assert.throws(() => toUtcScheduledAt('2026-02-30T10:00'))
  assert.throws(() => toUtcScheduledAt('invalid'))
  assert.equal(toLocalDateTime(null), '')
})

test('POC/outreach choices use exact stored lead IDs; deals require consistent stored company/lead', () => {
  const lead = { id: 'lead-a', company: 'Company A' } as Lead
  const contact = { name: 'Stored Contact', sourceUrl: 'https://example.com/team' }
  const outreach = [
    { id: 'outreach-a', leadId: 'lead-a', company: 'Company A', pocId: 'poc-a', poc: contact },
    { id: 'outreach-other', leadId: 'lead-other', company: 'Company A', pocId: 'poc-other', poc: contact },
    { id: 'outreach-duplicate', leadId: 'lead-a', company: 'Company A', pocId: 'poc-a', poc: contact },
    { id: 'outreach-unknown', leadId: 'lead-a', company: 'Company A', pocId: 'no-source', poc: { name: 'Unsupported' } },
  ] as OutreachItem[]
  const deals = [{ id: 'deal-a', company: 'Company A' }, { id: 'deal-b', company: 'Company B' }, { id: 'deal-c', company: 'Company A', leadId: 'lead-other' }] as Deal[]
  const choices = meetingAssociations(lead, outreach, deals)
  assert.deepEqual(choices.pocs.map(item => item.pocId), ['poc-a'])
  assert.equal(choices.outreach.some(item => item.id === 'outreach-other'), false)
  assert.deepEqual(choices.deals.map(item => item.id), ['deal-a'])
  assert.deepEqual(meetingAssociations(undefined, outreach, deals), { pocs: [], outreach: [], deals: [] })
})

test('meeting list renders empty, error/retry, loading, and unlinked legacy states truthfully', () => {
  const props = { meetings: [] as Meeting[], loading: false, error: null as Error | null, onRetry() {}, onEdit() {} }
  assert.match(renderToStaticMarkup(createElement(MeetingList, props)), /No meetings saved yet/)
  assert.match(renderToStaticMarkup(createElement(MeetingList, { ...props, loading: true })), /Loading meetings/)
  const error = renderToStaticMarkup(createElement(MeetingList, { ...props, error: new Error('Unavailable') }))
  assert.match(error, /Could not load meetings: Unavailable/)
  assert.match(error, /Retry/)
  const legacy = { id: 'legacy', title: 'Discovery & Demo Call', company: 'Historic Co', date: '2025-01-01', summary: 'Historical summary' } as Meeting
  const html = renderToStaticMarkup(createElement(MeetingList, { ...props, meetings: [legacy] }))
  assert.match(html, /POC unlinked/)
  assert.match(html, /timezone unknown/)
  assert.match(html, /Unlinked \(legacy record\)/)
  assert.match(html, /Historical summary/)
  assert.doesNotMatch(html, /BrowserStack|meet.google.com|Arjun/)
})

test('Meetings and Calendar render the same persisted query and do not substitute demos for empty data', () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  try {
    for (const Page of [MeetingsPage, CalendarPage]) {
      client.setQueryData(['meetings'], [])
      let html = renderToStaticMarkup(createElement(QueryClientProvider, { client }, createElement(Page)))
      assert.match(html, /No meetings saved yet/)
      assert.match(html, /Schedule Meeting/)
      assert.doesNotMatch(html, /BrowserStack|meet.google.com/)
      client.setQueryData(['meetings'], [{ id: 'meeting-1', title: 'Persisted meeting', company: 'Persisted company', leadId: 'lead-1', scheduledAt: '2026-10-10T10:00:00Z', status: 'SCHEDULED', notes: 'Persisted notes' }])
      html = renderToStaticMarkup(createElement(QueryClientProvider, { client }, createElement(Page)))
      assert.match(html, /Persisted meeting/)
      assert.match(html, /Persisted notes/)
      assert.match(html, /Persisted company/)
    }
  } finally { client.clear() }
})

test('meeting workflow client uses the persisted MoM, task, deal-link, review, and apply endpoints', async () => {
  const originalFetch = globalThis.fetch
  const calls: Array<{ url: string; method: string; body: unknown }> = []
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), method: init?.method || 'GET', body: init?.body ? JSON.parse(String(init.body)) : null })
    return new Response(JSON.stringify({ id: 'stored-record', created: true, task: { id: 'task-1' } }))
  }
  try {
    await getMeetingWorkflow('meeting/a')
    await generateMeetingMom('meeting/a', { notes: 'Supplied notes', expectedRevision: 0 })
    await saveMeetingMom('meeting/a', { notes: 'Notes', summary: 'Summary', discussionPoints: [], decisions: [], actionItems: [], expectedRevision: 0 })
    await reviewMeetingMom('meeting/a', 1)
    await createMeetingTask('meeting/a', 'action-1')
    await updateMeetingTask('task/a', { status: 'COMPLETED', expectedUpdatedAt: '2026-10-03T00:00:00.000Z' })
    await saveMeetingOutcome('meeting/a', { notes: 'Outcome', proposedChanges: { stage: 'PROPOSAL' }, expectedRevision: 0 })
    await linkMeetingDeal('meeting/a', 'deal-1')
    await reviewMeetingOutcome('meeting/a', 1)
    await applyMeetingOutcome('meeting/a', 2, ['stage'])
    assert.deepEqual(calls.map(call => [call.method, call.url]), [
      ['GET', '/api/backend/api/sheets/meetings/meeting%2Fa/workflow'],
      ['POST', '/api/backend/api/ai/meetings/meeting%2Fa/mom/generate'],
      ['PUT', '/api/backend/api/sheets/meetings/meeting%2Fa/mom'],
      ['POST', '/api/backend/api/sheets/meetings/meeting%2Fa/mom/review'],
      ['POST', '/api/backend/api/sheets/meetings/meeting%2Fa/mom/tasks'],
      ['PATCH', '/api/backend/api/sheets/meeting-tasks/task%2Fa'],
      ['PUT', '/api/backend/api/sheets/meetings/meeting%2Fa/outcome'],
      ['POST', '/api/backend/api/sheets/meetings/meeting%2Fa/link-deal'],
      ['POST', '/api/backend/api/sheets/meetings/meeting%2Fa/outcome/review'],
      ['POST', '/api/backend/api/sheets/meetings/meeting%2Fa/outcome/apply'],
    ])
    assert.deepEqual(calls[7].body, { dealId: 'deal-1', confirmed: true })
    assert.deepEqual(calls[9].body, { expectedRevision: 2, confirmedFields: ['stage'] })
  } finally { globalThis.fetch = originalFetch }
})

test('reviewed outcome preview requires explicit field selection and shows persisted reviewed tasks', () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const workflow = {
    meeting: { id: 'meeting-1', title: 'Stored meeting', company: 'Company A', leadId: 'lead-1', dealId: 'deal-1', scheduledAt: '2026-10-03T00:00:00.000Z', status: 'COMPLETED', notes: 'Notes', date: '2026-10-03', attendees: '', summary: '', actionItems: '', sentiment: '' },
    mom: { id: 'mom-1', meetingId: 'meeting-1', leadId: 'lead-1', company: 'Company A', pocId: null, outreachId: null, dealId: 'deal-1', notes: 'Notes', summary: 'Summary', discussionPoints: ['Point'], decisions: [], actionItems: [{ id: 'action-1', description: 'Prepare proposal', owner: null, dueDate: null }], status: 'REVIEWED', revision: 2, createdAt: '2026-10-03T00:00:00.000Z', updatedAt: '2026-10-03T00:00:00.000Z', reviewedAt: '2026-10-03T00:00:00.000Z' },
    tasks: [{ id: 'task-1', meetingId: 'meeting-1', momId: 'mom-1', actionItemId: 'action-1', description: 'Prepare proposal', owner: null, dueDate: null, status: 'OPEN', createdAt: '2026-10-03T00:00:00.000Z', updatedAt: '2026-10-03T00:00:00.000Z', completedAt: null }],
    outcome: { id: 'outcome-1', meetingId: 'meeting-1', leadId: 'lead-1', company: 'Company A', dealId: 'deal-1', notes: 'Positive outcome', proposedChanges: { stage: 'PROPOSAL' }, status: 'REVIEWED', revision: 2, createdAt: '2026-10-03T00:00:00.000Z', updatedAt: '2026-10-03T00:00:00.000Z', reviewedAt: '2026-10-03T00:00:00.000Z', appliedAt: null, reviewedDealSnapshot: { stage: 'DISCOVERY', nextAction: 'Follow up', value: 100, probability: 20 } },
    deal: { id: 'deal-1', title: 'Deal A', company: 'Company A', stage: 'DISCOVERY', value: 100, probability: 20, health: 'Good', nextAction: 'Follow up' },
    compatibleDeals: [], applications: [],
  } as MeetingWorkflow
  client.setQueryData(['meeting-workflow', 'meeting-1'], workflow)
  try {
    const html = renderToStaticMarkup(createElement(QueryClientProvider, { client }, createElement(MeetingWorkflowPanel, { meetingId: 'meeting-1', onClose() {} })))
    assert.match(html, /Summary/)
    assert.match(html, /Prepare proposal/)
    assert.match(html, /DISCOVERY.*PROPOSAL/)
    assert.match(html, /Apply confirmed fields/)
    assert.match(html, /disabled=""/)
    assert.doesNotMatch(html, /type="checkbox" checked/)
  } finally { client.clear() }
})
