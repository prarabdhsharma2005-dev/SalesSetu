'use client'

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { discoverCompanies, loadMoreCompanies, saveDiscoveredCompanies, type CompanyDiscoverySession, type Lead } from '@/lib/api'

function readableError(error: unknown): string {
  const message = error instanceof Error ? error.message : ''
  if (message.includes('WORKSPACE_QUOTA_EXCEEDED')) return 'Daily workspace discovery quota reached. Try again after the UTC day resets.'
  if (message.includes('PROVIDER_QUOTA')) return 'The search or AI provider is rate limited. Try again later.'
  if (message.includes('PROVIDER_NOT_CONFIGURED')) return 'Company discovery needs Tavily and Gemini configuration.'
  if (message.includes('timed out')) return 'Discovery took too long. Retry this batch when ready.'
  return 'Company discovery is unavailable. Retry when ready.'
}

export function CompanyDiscoveryPanel() {
  const queryClient = useQueryClient()
  const [query, setQuery] = useState('')
  const [industry, setIndustry] = useState('')
  const [city, setCity] = useState('')
  const [intent, setIntent] = useState('')
  const [session, setSession] = useState<CompanyDiscoverySession | null>(null)
  const [selected, setSelected] = useState<string[]>([])
  const [saved, setSaved] = useState<Record<string, Lead>>({})
  const [pending, setPending] = useState<'discover' | 'more' | 'save' | null>(null)
  const [failedAction, setFailedAction] = useState<'discover' | 'more' | null>(null)
  const [error, setError] = useState('')

  async function run(action: 'discover' | 'more') {
    if (pending || (action === 'discover' && !query.trim()) || (action === 'more' && !session)) return
    setPending(action)
    setError('')
    try {
      const result = action === 'discover'
        ? await discoverCompanies({ query: query.trim(), industry: industry.trim(), city: city.trim(), intent })
        : await loadMoreCompanies(session!.id, session!.batch + 1)
      setSession(result)
      setSelected([])
      if (action === 'discover') setSaved({})
      setFailedAction(null)
    } catch (cause) {
      setError(readableError(cause))
      setFailedAction(action)
    } finally { setPending(null) }
  }

  async function save() {
    if (!session || !selected.length || pending) return
    setPending('save')
    setError('')
    try {
      const result = await saveDiscoveredCompanies(session.id, selected)
      const next = { ...saved }
      for (const candidate of session.companies.filter(item => selected.includes(item.id))) {
        const lead = [...result.saved, ...result.alreadySaved].find(item =>
          (candidate.domain && item.website?.toLowerCase() === candidate.domain) || item.company.toLowerCase() === candidate.name.toLowerCase())
        if (lead) next[candidate.id] = lead
      }
      setSaved(next)
      setSelected([])
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['leads'] }),
        queryClient.invalidateQueries({ queryKey: ['lead-search'] }),
        queryClient.invalidateQueries({ queryKey: ['poc-discovery-leads'] }),
      ])
    } catch (cause) { setError(readableError(cause)) }
    finally { setPending(null) }
  }

  return <section style={{ display: 'grid', gap: 18, minWidth: 0 }}>
    <header>
      <h1 style={{ color: 'var(--text-1)', fontSize: 28, fontWeight: 800 }}>Discover companies</h1>
      <p style={{ color: 'var(--text-4)', marginTop: 6 }}>Search public sources. Review evidence, then save selected companies to your private workspace.</p>
    </header>
    <form onSubmit={event => { event.preventDefault(); void run('discover') }} style={{ display: 'grid', gap: 12, padding: 18, border: '1px solid var(--border)', borderRadius: 14, background: 'var(--bg-card)' }}>
      <label style={{ display: 'grid', gap: 6, color: 'var(--text-2)' }}>Company search
        <input value={query} onChange={event => setQuery(event.target.value)} maxLength={240} required placeholder="e.g. SaaS companies in Bangalore" style={{ width: '100%', minWidth: 0, padding: 12, color: 'var(--text-1)', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8 }} />
      </label>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 170px), 1fr))', gap: 10 }}>
        <label style={{ display: 'grid', gap: 5, color: 'var(--text-3)' }}>Industry
          <input value={industry} onChange={event => setIndustry(event.target.value)} maxLength={80} placeholder="Optional" style={{ width: '100%', padding: 10, color: 'var(--text-1)', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8 }} />
        </label>
        <label style={{ display: 'grid', gap: 5, color: 'var(--text-3)' }}>City
          <input value={city} onChange={event => setCity(event.target.value)} maxLength={80} placeholder="Optional" style={{ width: '100%', padding: 10, color: 'var(--text-1)', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8 }} />
        </label>
        <label style={{ display: 'grid', gap: 5, color: 'var(--text-3)' }}>Intent search hint
          <select value={intent} onChange={event => setIntent(event.target.value)} style={{ width: '100%', padding: 10, color: 'var(--text-1)', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8 }}>
            <option value="">Any</option><option value="HOT">HOT</option><option value="WARM">WARM</option><option value="COLD">COLD</option>
          </select>
        </label>
      </div>
      <p style={{ color: 'var(--text-5)', fontSize: 12 }}>Filters guide the search. Industry, location, and intent remain unknown unless a source supports them. No intent score is assigned.</p>
      <button type="submit" disabled={!!pending || !query.trim()} style={{ justifySelf: 'start', padding: '10px 16px', borderRadius: 8, border: 0, background: 'var(--blue)', color: 'white', cursor: pending ? 'wait' : 'pointer' }}>{pending === 'discover' ? 'Discovering…' : 'Discover companies'}</button>
    </form>
    {error && <div role="alert" style={{ padding: 14, border: '1px solid var(--border)', borderRadius: 10, color: '#FCA5A5' }}>{error} {failedAction && <button type="button" onClick={() => void run(failedAction)} disabled={!!pending} style={{ marginLeft: 8 }}>Retry</button>}</div>}
    {pending === 'more' && <p role="status" style={{ color: 'var(--text-3)' }}>Searching another batch…</p>}
    {session && <>
      <p style={{ color: 'var(--text-3)' }}>{session.companies.length} distinct sourced {session.companies.length === 1 ? 'company' : 'companies'} · {session.batch + 1} {session.batch === 0 ? 'batch' : 'batches'} searched{session.status === 'partial' ? ' · partial results' : ''}</p>
      {session.companies.length === 0 && <p role="status" style={{ color: 'var(--text-4)' }}>No source-backed companies found in this batch. Refine your query or load another batch.</p>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: 12 }}>
        {session.companies.map(company => <article key={company.id} style={{ minWidth: 0, padding: 16, border: '1px solid var(--border)', borderRadius: 12, background: 'var(--bg-card)' }}>
          <label style={{ display: 'flex', alignItems: 'start', gap: 9, color: 'var(--text-1)', fontWeight: 700 }}>
            <input type="checkbox" aria-label={`Select ${company.name}`} checked={selected.includes(company.id)} disabled={!!saved[company.id] || !!pending} onChange={event => setSelected(current => event.target.checked ? [...current, company.id] : current.filter(id => id !== company.id))} />
            <span style={{ overflowWrap: 'anywhere' }}>{company.name}</span>
          </label>
          <p style={{ marginTop: 8, color: 'var(--text-3)', overflowWrap: 'anywhere' }}>Website: {company.domain || 'Unknown'} · Industry: {company.industry || 'Unknown'}</p>
          <p style={{ color: 'var(--text-3)' }}>Location: {[company.city, company.country].filter(Boolean).join(', ') || 'Unknown'} · Employees: {company.employees ?? 'Unknown'}</p>
          <p style={{ color: 'var(--text-5)', fontSize: 12 }}>Intent: Unknown · POCs: Unknown · Lead score: Not assessed</p>
          <div style={{ marginTop: 10, display: 'grid', gap: 5 }}><strong style={{ color: 'var(--text-2)', fontSize: 12 }}>Supporting sources</strong>
            {company.sources.map(source => <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--blue-light)', overflowWrap: 'anywhere', fontSize: 12 }}>{source.title}</a>)}
          </div>
          {saved[company.id] && <a href={`/companies/${encodeURIComponent(saved[company.id].id)}`} style={{ display: 'inline-block', marginTop: 12, color: 'var(--blue-light)' }}>Saved · Research company →</a>}
        </article>)}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        <button type="button" disabled={!selected.length || !!pending} onClick={() => void save()} style={{ padding: '10px 14px' }}>{pending === 'save' ? 'Saving…' : `Save selected (${selected.length})`}</button>
        {session.hasMore && <button type="button" disabled={!!pending} onClick={() => void run('more')} style={{ padding: '10px 14px' }}>Load more</button>}
      </div>
      {!session.hasMore && <p style={{ color: 'var(--text-5)' }}>No further batches are available for this search. Refine the query to continue.</p>}
    </>}
  </section>
}
