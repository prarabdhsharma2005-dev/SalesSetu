const test = require('node:test')
const assert = require('node:assert/strict')
const { GoogleSheetsService } = require('../dist/services/sheets.service.js')
const { sheetsRouter } = require('../dist/routes/sheets.routes.js')

const poc = { name: 'Test Contact', role: 'Director', department: 'Sales', profileUrl: null, sourceUrl: 'https://example.com/team', confidence: 0.9 }
const input = { leadId: 'lead-a', title: 'Discovery', scheduledAt: '2026-10-10T15:00:00+05:30', status: 'SCHEDULED', meetingType: 'DISCOVERY', duration: 30, notes: 'Discuss requirements', attendees: 'Test Contact' }
const seed = () => ({
  leads: [{ id: 'lead-a', company: 'Example A' }, { id: 'lead-b', company: 'Example B' }, { id: 'lead-c', company: 'Example A' }],
  outreach: [
    { id: 'outreach-a', leadId: 'lead-a', company: 'Example A', pocId: 'poc-a', poc },
    { id: 'outreach-b', leadId: 'lead-b', company: 'Example B', pocId: 'poc-b', poc: { ...poc, name: 'Other Contact' } },
    { id: 'outreach-c', leadId: 'lead-c', company: 'Example A', pocId: 'poc-c', poc },
    { id: 'outreach-other-poc', leadId: 'lead-a', company: 'Example A', pocId: 'poc-other', poc: { ...poc, name: 'Second Contact' } },
  ],
  deals: [{ id: 'deal-a', company: 'Example A' }, { id: 'deal-b', company: 'Example B' }, { id: 'deal-c', company: 'Example A', leadId: 'lead-c' }],
  meetings: [], followUpSequences: [{ id: 'keep-sequence', steps: [] }], extraCollection: [{ preserved: true }],
})

async function isolated(run, initial = seed()) {
  let disk = JSON.stringify(initial)
  const syncs = []
  const originals = { readData: GoogleSheetsService.readData, writeData: GoogleSheetsService.writeData, syncToGoogleSheet: GoogleSheetsService.syncToGoogleSheet }
  GoogleSheetsService.readData = () => JSON.parse(disk)
  GoogleSheetsService.writeData = data => { disk = JSON.stringify(data) }
  GoogleSheetsService.syncToGoogleSheet = async (...args) => { syncs.push(args); return { synced: false } }
  try { await run({ read: () => JSON.parse(disk), syncs }) } finally { Object.assign(GoogleSheetsService, originals) }
}

// Invoke only the existing meeting handlers; no real server, provider, or runtime store.
async function request(method, path, body, id) {
  const route = sheetsRouter.stack.find(layer => layer.route?.path === path && layer.route.methods[method]).route
  const result = { status: 200, body: null }
  const response = { status(value) { result.status = value; return this }, json(value) { result.body = value; return this } }
  await route.stack[0].handle({ body, params: { id } }, response)
  return result
}

test('meeting create, reload, and edit persist UTC and exact associations without altering other records', async () => isolated(async ({ read, syncs }) => {
  const before = read()
  const created = await request('post', '/meetings', { ...input, pocId: 'poc-a', outreachId: 'outreach-a', dealId: 'deal-a' })
  assert.equal(created.status, 201)
  const meeting = created.body
  assert.match(meeting.id, /^meeting_[0-9a-f-]{36}$/)
  assert.equal(meeting.scheduledAt, '2026-10-10T09:30:00.000Z')
  assert.equal(meeting.date, meeting.scheduledAt)
  assert.equal(meeting.company, 'Example A')
  assert.equal(meeting.source, 'MANUAL')
  assert.deepEqual(meeting.poc, poc)
  assert.ok(meeting.createdAt && meeting.updatedAt)
  const list = await request('get', '/meetings')
  assert.equal(list.status, 200)
  assert.deepEqual(list.body.meetings[0], meeting)
  await new Promise(resolve => setTimeout(resolve, 5))
  const updated = await request('patch', '/meetings/:id', { title: 'Updated', scheduledAt: '2026-10-11T10:00:00Z', duration: 45, meetingType: 'DEMO', status: 'COMPLETED', attendees: 'Updated attendees', notes: 'Updated notes' }, meeting.id)
  assert.equal(updated.status, 200)
  assert.equal(updated.body.title, 'Updated')
  assert.equal(updated.body.status, 'COMPLETED')
  assert.equal(updated.body.notes, 'Updated notes')
  assert.equal(updated.body.date, '2026-10-11T10:00:00.000Z')
  for (const field of ['id', 'leadId', 'pocId', 'outreachId', 'dealId', 'createdAt']) assert.equal(updated.body[field], meeting[field], field)
  assert.ok(updated.body.updatedAt > meeting.updatedAt)
  assert.deepEqual((await GoogleSheetsService.getMeetings())[0], updated.body)
  for (const key of Object.keys(before).filter(key => key !== 'meetings')) assert.deepEqual(read()[key], before[key], key)
  assert.deepEqual(syncs.map(args => args.slice(0, 2)), [['APPEND', 'Meetings'], ['UPDATE', 'Meetings']])
}))

test('optional associations remain explicitly unlinked; IDs are unique', async () => isolated(async () => {
  const first = await GoogleSheetsService.appendMeeting(input)
  const second = await GoogleSheetsService.appendMeeting(input)
  assert.notEqual(first.id, second.id)
  for (const field of ['pocId', 'poc', 'outreachId', 'dealId']) assert.equal(first[field], null)
}))

test('invalid input and unknown or inconsistent associations return 400 without writes or sync', async () => isolated(async ({ read, syncs }) => {
  const before = read()
  const invalid = [
    null, {}, { ...input, leadId: 'missing' }, { ...input, company: 'Wrong company' },
    { ...input, title: ' ' }, { ...input, scheduledAt: '2026-10-01T10:00' },
    { ...input, scheduledAt: '2026-02-30T10:00:00Z' }, { ...input, scheduledAt: '2026-10-10T10:00:00+99:99' }, { ...input, status: 'SENT' },
    { ...input, duration: -1 }, { ...input, meetingType: 'INVALID' },
    { ...input, pocId: 'unknown' }, { ...input, pocId: 'poc-b' }, { ...input, pocId: 'poc-c' },
    { ...input, outreachId: 'unknown' }, { ...input, outreachId: 'outreach-b' }, { ...input, outreachId: 'outreach-c' },
    { ...input, pocId: 'poc-other', outreachId: 'outreach-a' },
    { ...input, dealId: 'unknown' }, { ...input, dealId: 'deal-b' }, { ...input, dealId: 'deal-c' },
    { ...input, id: 'client-id' }, { ...input, createdAt: 'forged' }, { ...input, poc: { name: 'Invented' } },
  ]
  for (const value of invalid) {
    const result = await request('post', '/meetings', value)
    assert.equal(result.status, 400, JSON.stringify(value))
    assert.ok(result.body.error)
  }
  assert.deepEqual(read(), before)
  assert.equal(syncs.length, 0)
}))

test('unknown updates return 404; IDs, associations, and creation timestamps cannot be overwritten', async () => isolated(async ({ read, syncs }) => {
  assert.equal((await request('patch', '/meetings/:id', { title: 'X' }, 'unknown')).status, 404)
  const meeting = await GoogleSheetsService.appendMeeting(input)
  const before = read()
  for (const update of [{}, { id: 'new' }, { leadId: 'lead-b' }, { pocId: 'poc-b' }, { outreachId: 'outreach-b' }, { dealId: 'deal-b' }, { company: 'Other' }, { createdAt: 'new' }, { updatedAt: 'new' }, { source: 'VERIFIED' }, { status: 'BAD' }, { scheduledAt: 'invalid' }]) {
    assert.equal((await request('patch', '/meetings/:id', update, meeting.id)).status, 400)
  }
  assert.deepEqual(read(), before)
  assert.equal(syncs.length, 1)
}))

test('legacy records remain readable and editable with no demo/title-based association or timezone invention', async () => {
  const legacy = { id: 'legacy', title: 'Discovery & Demo Call', company: 'Historic Company', date: '2025-01-10', attendees: 'Historic attendee', summary: 'Retain summary', actionItems: 'Retain actions', sentiment: 'Neutral', extra: 'preserve' }
  await isolated(async ({ read }) => {
    const meeting = (await GoogleSheetsService.getMeetings())[0]
    for (const field of ['leadId', 'pocId', 'poc', 'outreachId', 'dealId', 'scheduledAt', 'status', 'meetingType', 'createdAt']) assert.equal(meeting[field], null, field)
    assert.equal(meeting.company, legacy.company)
    assert.deepEqual(read().meetings[0], legacy)
    const updated = await GoogleSheetsService.updateMeeting('legacy', { notes: 'Added notes' })
    assert.equal(updated.leadId, null)
    assert.equal(updated.summary, legacy.summary)
    assert.equal(read().meetings[0].extra, 'preserve')
  }, { ...seed(), meetings: [legacy] })
})

test('empty results stay empty and failed reads/writes return clear errors', async () => isolated(async () => {
  assert.deepEqual((await request('get', '/meetings')).body, { total: 0, meetings: [] })
  GoogleSheetsService.writeData = () => { throw new Error('test write failure') }
  assert.equal((await request('post', '/meetings', input)).status, 500)
  GoogleSheetsService.readData = () => { throw new Error('test read failure') }
  assert.deepEqual(await request('get', '/meetings'), { status: 500, body: { error: 'Could not load meetings.' } })
}))
