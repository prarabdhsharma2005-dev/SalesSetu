import assert from 'node:assert/strict'
import test from 'node:test'
import { outreachDraftErrorMessage } from '../src/lib/outreach-draft-error'

test('workspace and Gemini quotas remain distinct', () => {
  assert.match(outreachDraftErrorMessage(new Error('API 429: {"code":"WORKSPACE_QUOTA_EXCEEDED","error":"Daily ai limit reached. Try again after the UTC day resets."}')), /Workspace|Daily ai limit/)
  assert.doesNotMatch(outreachDraftErrorMessage(new Error('API 429: {"code":"WORKSPACE_QUOTA_EXCEEDED","error":"Daily ai limit reached."}')), /Gemini/)
  assert.match(outreachDraftErrorMessage(new Error('API 429: {"code":"WORKSPACE_QUOTA_EXCEEDED","error":"Daily ai limit reached.","retrySeconds":90}')), /Retry in approximately 2 minute/)
  assert.match(outreachDraftErrorMessage(new Error('API 429: {"code":"AI_QUOTA","retrySeconds":90,"quotaMetric":"example.com/requests","quotaKind":"per_minute"}')), /Retry after approximately 2 minute/)
  assert.match(outreachDraftErrorMessage(new Error('API 429: {"code":"AI_QUOTA","quotaKind":"daily"}')), /daily quota resets/)
})
