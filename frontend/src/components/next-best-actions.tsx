'use client'
import Link from 'next/link'
import { useNextBestActions } from '@/lib/use-backend'
import { meetingCard } from './meeting-form'

export function NextBestActions() {
  const query = useNextBestActions()
  return <section style={meetingCard} aria-label="Next Best Actions">
    <h2>Next Best Actions</h2>
    <p>Suggestions based on saved records. Actions require your review and confirmation.</p>
    {query.isPending ? <p>Loading recommendations…</p> : query.isError ? <p role="alert">Recommendations unavailable. <button onClick={() => query.refetch()}>Retry</button></p> : !query.data?.length ? <p>No next action is supported by the current saved records.</p> : <ul>{query.data.slice(0, 5).map(item => <li key={item.id} style={{ marginTop: 12 }}><Link href={item.href}>{item.title}</Link><p>{item.reason}</p></li>)}</ul>}
  </section>
}
