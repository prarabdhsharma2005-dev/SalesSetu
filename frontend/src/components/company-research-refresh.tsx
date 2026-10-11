'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { refreshCompanyResearch, repairCompanyResearch } from '@/lib/api'

export default function CompanyResearchRefresh({ leadId, hasSavedResearch }: { leadId: string; hasSavedResearch: boolean }) {
  const router = useRouter()
  const [loading, setLoading] = useState<'repair' | 'refresh' | null>(null)
  const [error, setError] = useState('')

  async function run(kind: 'repair' | 'refresh') {
    setLoading(kind)
    setError('')
    try {
      if (kind === 'repair') await repairCompanyResearch(leadId)
      else await refreshCompanyResearch(leadId)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Company research could not be refreshed.')
    } finally {
      setLoading(null)
    }
  }

  return <div style={{ marginBottom: 12 }}>
    {hasSavedResearch && <button type="button" onClick={() => run('repair')} disabled={loading !== null} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', color: 'var(--blue-light)', background: 'var(--bg-elevated)', cursor: loading ? 'wait' : 'pointer', marginRight: 8 }}>
      {loading === 'repair' ? 'Checking saved research...' : 'Use cited facts from saved research'}
    </button>}
    <button type="button" onClick={() => run('refresh')} disabled={loading !== null} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', color: 'var(--blue-light)', background: 'var(--bg-elevated)', cursor: loading ? 'wait' : 'pointer' }}>
      {loading === 'refresh' ? 'Refreshing research...' : 'Refresh research'}
    </button>
    {error && <p role="alert" style={{ marginTop: 8, color: '#FCA5A5', fontSize: 12 }}>{error}</p>}
  </div>
}
