const test = require('node:test')
const assert = require('node:assert/strict')
const { runInWorkspace, currentWorkspace } = require('../dist/services/workspace-context.service.js')
const { GoogleSheetsService } = require('../dist/services/sheets.service.js')
const { pipelineRouter } = require('../dist/routes/pipeline.routes.js')

test('pipeline summary reads only the authenticated workspace deals in workspace mode', async () => {
  const priorMode = process.env.GOOGLE_WORKSPACES_ENABLED
  const priorGetDeals = GoogleSheetsService.getDeals
  const a = '123456789012345678901'
  const b = '999999999999999999999'
  process.env.GOOGLE_WORKSPACES_ENABLED = 'true'
  GoogleSheetsService.getDeals = async () => currentWorkspace() === a
    ? [{ id: 'private-a', company: 'A', value: 250, stage: 'DISCOVERY' }]
    : [{ id: 'private-b', company: 'B', value: 500, stage: 'PROPOSAL' }]
  const handler = pipelineRouter.stack.find(item => item.route?.path === '/deals').route.stack[0].handle
  const read = workspace => runInWorkspace(workspace, async () => {
    let response
    await handler({}, { json(value) { response = value; return this } })
    return response
  })
  try {
    assert.deepEqual((await read(a)).deals.map(deal => deal.id), ['private-a'])
    assert.equal((await read(a)).totalPipelineValue, 250)
    assert.deepEqual((await read(b)).deals.map(deal => deal.id), ['private-b'])
    assert.equal((await read(b)).totalPipelineValue, 500)
  } finally {
    GoogleSheetsService.getDeals = priorGetDeals
    if (priorMode === undefined) delete process.env.GOOGLE_WORKSPACES_ENABLED
    else process.env.GOOGLE_WORKSPACES_ENABLED = priorMode
  }
})
