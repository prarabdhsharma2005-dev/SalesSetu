'use client'

import Link from 'next/link'
import { useDeals, useLeads, useMeetings, useOutreach } from '@/lib/use-backend'

export function WorkspaceOverview() {
  const leads = useLeads()
  const deals = useDeals()
  const meetings = useMeetings()
  const outreach = useOutreach()
  const error = leads.error || deals.error || meetings.error || outreach.error
  return <div style={{ display: 'grid', gap: 24 }}>
    <div><h1 style={{ color: 'var(--text-1)', fontSize: 30 }}>Your sales workspace</h1><p style={{ color: 'var(--text-3)', marginTop: 6 }}>Your stored records and next steps, private to this Google account.</p></div>
    {error && <p role="alert" style={{ color: 'var(--danger)' }}>Workspace data is unavailable. Please retry from the relevant page.</p>}
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 14 }}>
      {[
        ['Leads', leads.data?.length, '/leads'],
        ['Deals', deals.data?.length, '/pipeline'],
        ['Meetings', meetings.data?.length, '/meetings'],
        ['Outreach', outreach.data?.length, '/outreach'],
      ].map(([label, count, href]) => <Link key={String(label)} href={String(href)} style={{ padding: 22, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 13, textDecoration: 'none' }}><span style={{ display: 'block', color: 'var(--text-3)' }}>{label}</span><strong style={{ color: 'var(--text-1)', fontSize: 28 }}>{count === undefined ? '—' : count}</strong></Link>)}
    </div>
    {leads.isSuccess && leads.data.length === 0 && <div style={{ padding: 28, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14 }}><h2 style={{ color: 'var(--text-1)', fontSize: 20 }}>Start with your ICP</h2><p style={{ color: 'var(--text-3)', margin: '9px 0 17px' }}>This workspace is empty. Save your ICP rulebook, then add or discover leads.</p><Link href="/icp" style={{ color: 'var(--blue-light)' }}>Open ICP Rulebook →</Link></div>}
  </div>
}
