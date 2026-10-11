import assert from 'node:assert/strict'
import test from 'node:test'
import { companyResearchResponseError } from '../src/lib/research-error'

test('workspace quota names the local limit and reset, without claiming a provider failure', async () => {
  const response = new Response(JSON.stringify({ code: 'WORKSPACE_QUOTA_EXCEEDED', error: 'Daily discovery limit reached. Try again after the UTC day resets.' }), {
    status: 429, headers: { 'Retry-After': '3600' },
  })
  const message = await companyResearchResponseError(response)
  assert.match(message, /Daily discovery limit reached/)
  assert.match(message, /Resets at .* UTC/)
  assert.match(message, /Company Research was not run/)
})

test('provider quota is displayed separately from workspace quota', async () => {
  const response = new Response(JSON.stringify({ code: 'PROVIDER_QUOTA', error: 'Company research provider quota or rate limit was reached. Retry later.' }), { status: 429 })
  assert.match(await companyResearchResponseError(response), /provider quota/)
})
