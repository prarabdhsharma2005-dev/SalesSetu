const test = require('node:test')
const assert = require('node:assert/strict')
const { recommendNextActions } = require('../dist/services/next-best-action.service')
const empty = () => ({ leads:[], outreach:[], sequences:[], meetings:[], moms:[], outcomes:[], tasks:[], deals:[], sequenceApplications:[] })
const now = new Date('2026-10-07T12:00:00Z')
test('missing data gives an honest empty state and rules have stable priority and destination links', () => {
  assert.deepEqual(recommendNextActions(empty(),now),[])
  const data=empty()
  data.leads=[{id:'missing',company:'Missing'},{id:'l1',qualificationStatus:'needs_review'}]
  data.meetings=[{id:'m1',status:'SCHEDULED',scheduledAt:'2026-10-08T12:00:00Z'}]
  data.tasks=[{id:'t1',meetingId:'m1',status:'OPEN',dueDate:'2026-10-06'},{id:'unknown',meetingId:'m1',status:'OPEN',dueDate:'next Tuesday'}]
  data.outreach=[{id:'o1',leadId:'l1',status:'PENDING_APPROVAL'}]
  const result=recommendNextActions(data,now)
  assert.deepEqual(result.map(item=>item.priority),[10,20,30,40])
  assert.match(result[2].reason,/NEEDS REVIEW/)
  assert.equal(result[1].href,'/meetings?meetingId=m1')
  for(const item of result) assert.equal(item.kind,'SUGGESTION')
  assert.deepEqual(recommendNextActions(data,now),result)
})
test('blocked qualification and terminal cadence never recommend draft generation; only due eligible step is suggested',()=>{
  const data=empty(); data.leads=[{id:'l1',qualificationStatus:'qualified'}]
  data.sequences=[{id:'s1',leadId:'l1',status:'ACTIVE',cadenceAnchorAt:'2026-10-01T12:00:00Z',steps:[{id:'a',step:1,status:'DELIVERY_READY',body:'First'},{id:'b',step:2,status:'DRAFT',body:'',dayOffset:3},{id:'c',step:3,status:'DRAFT',body:'',dayOffset:7}]}]
  assert.equal(recommendNextActions(data,now)[0].id,'due:b')
  for(const status of ['PAUSED','STOPPED','REPLIED','MEETING_BOOKED','COMPLETED']) {data.sequences[0].status=status; assert.equal(recommendNextActions(data,now).length,0)}
  data.sequences[0].status='ACTIVE'; data.leads[0].qualificationStatus='not_qualified'
  assert.equal(recommendNextActions(data,now).some(item=>item.id.startsWith('due:')),false)
})
