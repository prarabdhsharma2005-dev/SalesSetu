import assert from 'node:assert/strict'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import DashboardPage from '../src/app/(dashboard)/dashboard/page'

test('dashboard server render uses stable placeholders for client-local dates and times', () => {
  const html = renderToStaticMarkup(createElement(DashboardPage))
  assert.match(html, /AI Daily Brief —/)
  assert.match(html, /— · 60 min/)
  assert.doesNotMatch(html, /\d{1,2}:\d{2}\s*(am|pm)/i)
})
