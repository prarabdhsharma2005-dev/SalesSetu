const test = require('node:test')
const assert = require('node:assert/strict')
const {
  allowedOutreachTransition,
  checkOutreachQuality,
  deliveryTargetAvailable,
  reviewAcknowledgementAllowed,
} = require('../dist/services/outreach-workflow.service.js')
const { checkOutreachQualification } = require('../dist/services/qualification-guard.service.js')
const { GoogleSheetsService } = require('../dist/services/sheets.service.js')

const base = {
  id: 'outreach-test', prospectName: 'A Contact', email: null, company: 'Example Co', subject: 'Hello',
  body: 'A sourced, editable draft.', status: 'DRAFT', leadId: 'lead-1', pocId: 'contact|https://example.com/contact',
  poc: { name: 'A Contact', role: 'Director', department: 'Sales', profileUrl: 'https://example.com/contact', sourceUrl: 'https://example.com/source', confidence: 0.8 },
  channel: 'email',
}

test('quality checks require a real lead, sourced POC, supported channel, body, and email subject', () => {
  const checks = Object.fromEntries(checkOutreachQuality(base).map(check => [check.key, check]))
  assert.equal(checks.lead.status, 'PASS')
  assert.equal(checks.poc.status, 'PASS')
  assert.equal(checks.channel.status, 'PASS')
  assert.equal(checks.message.status, 'PASS')
  assert.equal(checks.subject.status, 'PASS')
  assert.equal(checks.recipient.status, 'WARNING')
  assert.equal(checks['factual-claims'].status, 'WARNING')
  assert.equal(checks['factual-claims'].message.includes('not automatically verified'), true)
})

test('placeholders and missing required fields block submission', () => {
  const checks = Object.fromEntries(checkOutreachQuality({ ...base, leadId: '', subject: '', body: '[Insert message]' }).map(check => [check.key, check]))
  assert.equal(checks.lead.status, 'BLOCKED')
  assert.equal(checks.poc.status, 'PASS')
  assert.equal(checks.channel.status, 'PASS')
  assert.equal(checks.message.status, 'PASS')
  assert.equal(checks.subject.status, 'BLOCKED')
  assert.equal(checks.placeholders.status, 'BLOCKED')
  const noChannel = Object.fromEntries(checkOutreachQuality({ ...base, channel: undefined }).map(check => [check.key, check]))
  assert.equal(noChannel.channel.status, 'BLOCKED')
})

test('Needs Review requires and preserves explicit acknowledgement', () => {
  assert.equal(reviewAcknowledgementAllowed(false, true, false), false)
  assert.equal(reviewAcknowledgementAllowed(false, true, true), true)
  assert.equal(reviewAcknowledgementAllowed(true, true, false), true)
  assert.equal(reviewAcknowledgementAllowed(false, false, false), true)
})

test('delivery readiness requires a usable recipient and never supports WhatsApp without a phone field', () => {
  assert.equal(deliveryTargetAvailable({ ...base, channel: 'email', email: null }), false)
  assert.equal(deliveryTargetAvailable({ ...base, channel: 'email', email: 'person@example.com' }), true)
  assert.equal(deliveryTargetAvailable({ ...base, channel: 'linkedin', email: null }), true)
  assert.equal(deliveryTargetAvailable({ ...base, channel: 'linkedin', poc: { ...base.poc, profileUrl: 'javascript:alert(1)' } }), false)
  assert.equal(deliveryTargetAvailable({ ...base, channel: 'whatsapp' }), false)
})

test('state machine allows approval and delivery-ready but never SENT', () => {
  assert.equal(allowedOutreachTransition('DRAFT', 'PENDING_APPROVAL'), true)
  assert.equal(allowedOutreachTransition('PENDING_APPROVAL', 'APPROVED'), true)
  assert.equal(allowedOutreachTransition('APPROVED', 'DELIVERY_READY'), true)
  assert.equal(allowedOutreachTransition('APPROVED', 'SENT'), false)
  assert.equal(allowedOutreachTransition('DELIVERY_READY', 'SENT'), false)
})

test('backend qualification gate allows qualified/review leads and blocks other states', async () => {
  const getLeads = GoogleSheetsService.getLeads
  try {
    for (const [qualificationStatus, expectedReview] of [['qualified', false], ['needs_review', true]]) {
      GoogleSheetsService.getLeads = async () => [{ id: 'lead-1', company: 'Example Co', qualificationStatus }]
      const result = await checkOutreachQualification('lead-1', 'Example Co')
      assert.equal(result.lead.id, 'lead-1')
      assert.equal(result.reviewRequired, expectedReview)
    }
    for (const qualificationStatus of ['not_qualified', undefined]) {
      GoogleSheetsService.getLeads = async () => [{ id: 'lead-1', company: 'Example Co', qualificationStatus }]
      const result = await checkOutreachQualification('lead-1', 'Example Co')
      assert.equal(result.status, 409)
      assert.equal(result.error.includes('not qualified') || result.error.includes('not been qualified'), true)
    }
  } finally {
    GoogleSheetsService.getLeads = getLeads
  }
})
