'use client'

import { useState } from 'react'
import { ExternalLink, Search, Sparkles } from 'lucide-react'
import type { DiscoveredPOC } from '@/lib/api'
import { useDiscoverPOCs, usePOCLeads } from '@/lib/use-backend'

const cardStyle = {
  background: 'var(--bg-card)',
  border: '1px solid var(--border)',
  borderRadius: '14px',
  padding: '20px',
} as const

export default function POCDiscoveryPanel({ leadId, companyName }: { leadId?: string; companyName?: string }) {
  const leadsQuery = usePOCLeads()
  const discover = useDiscoverPOCs()
  const [selectedLeadId, setSelectedLeadId] = useState('')
  const activeLead = leadId || selectedLeadId
  const selectedLead = leadsQuery.data?.find(lead => lead.id === activeLead)
  const name = companyName || selectedLead?.company || 'selected company'
  const result = discover.data
  const groupedPOCs = (result?.pocs || []).reduce<Record<string, DiscoveredPOC[]>>((groups, poc) => {
    const department = poc.department || 'Unknown department'
    groups[department] = [...(groups[department] || []), poc]
    return groups
  }, {})

  return (
    <section style={cardStyle} aria-label="POC discovery">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-1)', marginBottom: '5px' }}>POC Intelligence</h2>
          <p style={{ fontSize: '12px', color: 'var(--text-5)' }}>Live, source-backed discovery. Email verification is unavailable.</p>
        </div>
        {!leadId && (
          <select
            value={selectedLeadId}
            onChange={event => { setSelectedLeadId(event.target.value); discover.reset() }}
            aria-label="Select a stored company"
            style={{ minWidth: '210px', padding: '9px 12px', borderRadius: '8px', background: 'var(--bg-elevated)', color: 'var(--text-2)', border: '1px solid var(--border)', fontFamily: 'inherit' }}
          >
            <option value="">Select a stored company</option>
            {(leadsQuery.data || []).map(lead => <option key={lead.id} value={lead.id}>{lead.company}</option>)}
          </select>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '14px', flexWrap: 'wrap' }}>
        <button
          type="button"
          disabled={!activeLead || discover.isPending}
          onClick={() => discover.mutate(activeLead)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '9px 13px', borderRadius: '8px', border: '1px solid rgba(59,130,246,0.3)', background: !activeLead || discover.isPending ? 'var(--bg-elevated)' : 'rgba(59,130,246,0.12)', color: 'var(--blue-light)', fontWeight: 700, fontSize: '12px', cursor: !activeLead || discover.isPending ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}
        >
          {discover.isPending ? <Sparkles size={13} /> : <Search size={13} />}
          {discover.isPending ? 'Searching public sources…' : 'Discover POCs'}
        </button>
        {!leadId && leadsQuery.isLoading && <span style={{ fontSize: '12px', color: 'var(--text-5)' }}>Loading stored companies…</span>}
        {!leadId && !leadsQuery.isLoading && !leadsQuery.isError && (leadsQuery.data?.length || 0) === 0 && <span style={{ fontSize: '12px', color: 'var(--text-5)' }}>No stored companies available. Demo companies cannot be searched as live records.</span>}
        {leadsQuery.isError && !leadId && <span style={{ fontSize: '12px', color: '#FCA5A5' }}>Stored companies could not be loaded.</span>}
        {activeLead && <span style={{ fontSize: '11px', color: 'var(--text-5)' }}>Company: {name}</span>}
      </div>

      {discover.isError && <p role="alert" style={{ marginTop: '12px', fontSize: '12px', color: '#FCA5A5' }}>{discover.error.message || 'POC discovery is unavailable right now.'}</p>}

      {result && (
        <div style={{ marginTop: '16px' }}>
          <p style={{ fontSize: '11px', color: 'var(--text-5)', marginBottom: '10px' }}>
            LIVE SEARCH · {result.searchesPerformed} Tavily searches · {result.sources.length} source results · {result.pocs.length} supported {result.pocs.length === 1 ? 'person' : 'people'}
          </p>
          {result.pocs.length === 0 ? (
            <p style={{ fontSize: '13px', color: 'var(--text-4)' }}>Insufficient evidence to identify a supported contact. No POCs were invented.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {Object.entries(groupedPOCs).map(([department, pocs]) => (
                <section key={department}>
                  <h3 style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-3)', marginBottom: '8px' }}>{department} · {pocs?.length || 0}</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '10px' }}>
              {pocs?.map((poc, index) => (
                <article key={`${poc.sourceUrl}-${poc.name}-${index}`} style={{ padding: '14px', borderRadius: '10px', background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'flex-start' }}>
                    <div>
                      <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-1)' }}>{poc.name}</h3>
                      <p style={{ fontSize: '12px', color: 'var(--text-4)', marginTop: '3px' }}>{poc.role || 'Role: Unknown'}</p>
                    </div>
                    <span style={{ fontSize: '10px', color: 'var(--text-4)', whiteSpace: 'nowrap' }}>{Math.round(poc.confidence * 100)}% confidence</span>
                  </div>
                  <dl style={{ display: 'grid', gridTemplateColumns: '90px 1fr', gap: '5px 8px', margin: '12px 0', fontSize: '11px' }}>
                    <dt style={{ color: 'var(--text-5)' }}>Department</dt><dd style={{ color: 'var(--text-3)' }}>{poc.department || 'Unknown'}{poc.department && ' · AI inference'}</dd>
                    <dt style={{ color: 'var(--text-5)' }}>Seniority</dt><dd style={{ color: 'var(--text-3)' }}>{poc.seniority || 'Unknown'}{poc.seniority && ' · AI inference'}</dd>
                    <dt style={{ color: 'var(--text-5)' }}>Profile</dt><dd>{poc.profileUrl ? <a href={poc.profileUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--blue-light)' }}>Sourced profile <ExternalLink size={10} /></a> : <span style={{ color: 'var(--text-3)' }}>Unknown</span>}</dd>
                    <dt style={{ color: 'var(--text-5)' }}>Email</dt><dd style={{ color: 'var(--text-3)' }}>{poc.emailStatus === 'unverified' ? 'Unverified' : 'Unknown'}</dd>
                    <dt style={{ color: 'var(--text-5)' }}>Location</dt><dd style={{ color: 'var(--text-3)' }}>{poc.location || 'Unknown'}</dd>
                    <dt style={{ color: 'var(--text-5)' }}>Evidence</dt><dd style={{ color: 'var(--text-3)' }}>{poc.evidenceType === 'sourced' ? 'Name supported by source' : poc.evidenceType === 'inferred' ? 'AI inference' : 'Unknown'}</dd>
                  </dl>
                  {poc.relevanceReason && <p style={{ fontSize: '11px', color: 'var(--text-4)', lineHeight: 1.5, marginBottom: '8px' }}>Why relevant · AI inference: {poc.relevanceReason}</p>}
                  {(() => {
                    const source = result.sources.find(item => item.url === poc.sourceUrl)
                    return <div>
                      <a href={poc.sourceUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: '11px', color: 'var(--blue-light)', overflowWrap: 'anywhere' }}>{source?.title || 'Source'} <ExternalLink size={10} /></a>
                      {source?.content && <p style={{ marginTop: '5px', fontSize: '10px', color: 'var(--text-5)', lineHeight: 1.45 }}>{source.content}</p>}
                    </div>
                  })()}
                </article>
              ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  )
}
