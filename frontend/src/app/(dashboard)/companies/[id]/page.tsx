import Link from 'next/link'
import { notFound } from 'next/navigation'
import { DEMO_COMPANIES, DEMO_CONTACTS, DEMO_INTENT_SIGNALS } from '@/lib/demo-data'
import { formatNumber, timeAgo } from '@/lib/utils'
import POCDiscoveryPanel from '@/components/poc-discovery-panel'
import {
  Building2, Users, Globe, MapPin, TrendingUp, Flame, ArrowLeft,
  Mail, Sparkles, CheckCircle, Shield, Zap, ExternalLink
} from 'lucide-react'

interface Props {
  params: Promise<{ id: string }>
}

interface StoredLead {
  id: string
  company: string
  website: string
  industry: string
  country: string
  city: string
  employees: number | string
  intentSignal: string
  leadScore: number
  status: string
}

interface CompanyResearch {
  summary: string
  sources: Array<{ title: string; url: string }>
}

async function fetchLeadResearch(id: string) {
  const backendUrl = (process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000').replace(/\/$/, '')
  try {
    const response = await fetch(`${backendUrl}/api/leads/${encodeURIComponent(id)}/research`, { cache: 'no-store' })
    if (!response.ok) return null
    return await response.json() as {
      lead: StoredLead
      research: CompanyResearch | null
      researchError?: string
    }
  } catch {
    return null
  }
}

export default async function CompanyDetailPage({ params }: Props) {
  const { id } = await params
  const demoCompany = DEMO_COMPANIES.find(c => c.id === id)
  const liveResult = demoCompany ? null : await fetchLeadResearch(id)
  const lead = liveResult?.lead
  const company = demoCompany ?? (lead ? {
    id: lead.id,
    name: lead.company,
    website: lead.website,
    industry: lead.industry,
    city: lead.city,
    state: lead.country,
    intentStatus: lead.status === 'HOT' || lead.status === 'MEETING_SCHEDULED'
      ? 'HOT'
      : lead.status === 'WARM' || lead.status === 'CONTACTED' ? 'WARM' : 'COLD',
    leadScore: lead.leadScore,
    description: liveResult?.research?.summary || 'Company research is unavailable. Showing stored lead information only.',
    employeeCount: Number(lead.employees) || 0,
    revenue: 'Unknown',
    fundingStage: 'Unknown',
    relationshipStatus: 'PROSPECT',
    recentDevelopments: lead.intentSignal,
    technologies: [],
  } : null)

  if (!company) {
    notFound()
  }

  const research = liveResult?.research || null
  const contacts = demoCompany ? DEMO_CONTACTS.filter(c => c.companyId === company.id) : []
  const signals = demoCompany ? DEMO_INTENT_SIGNALS.filter(s => s.companyId === company.id) : []

  const intentColors: Record<string, { bg: string; text: string; border: string }> = {
    HOT:  { bg: 'rgba(244,63,94,0.12)',  text: '#FB7185', border: 'rgba(244,63,94,0.30)' },
    WARM: { bg: 'rgba(245,158,11,0.12)', text: '#FBBF24', border: 'rgba(245,158,11,0.30)' },
    COLD: { bg: 'rgba(113,113,122,0.10)',text: '#A1A1AA', border: 'rgba(113,113,122,0.25)' },
  }
  const ic = intentColors[company.intentStatus] ?? intentColors.COLD
  const scoreColor = company.leadScore >= 80 ? '#10B981' : company.leadScore >= 60 ? '#3B82F6' : '#F59E0B'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* Back button */}
      <div>
        <Link
          href="/companies"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '13px',
            fontWeight: 600,
            color: 'var(--blue-light)',
            textDecoration: 'none',
          }}
        >
          <ArrowLeft style={{ width: '14px', height: '14px' }} />
          Back to Companies
        </Link>
      </div>

      {/* Header Banner */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: '16px',
        padding: '28px',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: '24px',
        flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', minWidth: '280px' }}>
          <div style={{
            width: '64px', height: '64px', borderRadius: '14px',
            background: 'var(--bg-elevated)', border: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '24px', fontWeight: 900, color: 'var(--text-2)',
            flexShrink: 0,
          }}>
            {company.name.charAt(0)}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '6px' }}>
              <h1 style={{ fontSize: '24px', fontWeight: 900, color: 'var(--text-1)', letterSpacing: '-0.03em' }}>
                {company.name}
              </h1>
              <span style={{
                fontSize: '11px', fontWeight: 800, padding: '3px 8px', borderRadius: '6px',
                background: ic.bg, color: ic.text, border: `1px solid ${ic.border}`,
              }}>
                {company.intentStatus} INTENT
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', fontSize: '13px', color: 'var(--text-4)' }}>
              <span>{company.industry}</span>
              <span>•</span>
              <span>{company.city}, {company.state}</span>
              <span>•</span>
              <a
                href={`https://${company.website}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'var(--blue-light)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
              >
                {company.website} <ExternalLink style={{ width: '12px', height: '12px' }} />
              </a>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ textAlign: 'center', padding: '10px 18px', background: 'var(--bg-elevated)', borderRadius: '12px', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '28px', fontWeight: 900, color: scoreColor, lineHeight: 1 }}>{company.leadScore}</div>
            <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-5)', marginTop: '4px', letterSpacing: '0.06em' }}>LEAD SCORE</div>
          </div>
          <Link
            href={`/outreach?company=${company.id}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 20px',
              borderRadius: '10px',
              background: 'var(--blue)',
              color: 'white',
              fontSize: '13px',
              fontWeight: 700,
              textDecoration: 'none',
              boxShadow: '0 4px 16px rgba(59,130,246,0.30)',
            }}
          >
            <Sparkles style={{ width: '15px', height: '15px' }} />
            Draft Outreach
          </Link>
        </div>
      </div>

      {/* Grid: Overview, Intent Signals, Contacts */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px', alignItems: 'start' }}>
        {/* Left Column: Dossier & Signals */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Dossier */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '14px', padding: '24px' }}>
            <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-1)', marginBottom: '12px' }}>
              Company Dossier
            </h2>
            <p style={{ fontSize: '14px', color: 'var(--text-3)', lineHeight: 1.6, marginBottom: '12px', whiteSpace: 'pre-line' }}>
              {company.description}
            </p>
            {research && (
              <div style={{ marginBottom: '20px' }}>
                <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-5)', marginBottom: '6px' }}>
                  GEMINI RESEARCH · TAVILY SOURCED
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {research.sources.map(source => (
                    <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '12px', color: 'var(--blue-light)' }}>
                      {source.title}
                    </a>
                  ))}
                </div>
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-5)', marginBottom: '2px' }}>Employees</div>
                <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-1)' }}>{formatNumber(company.employeeCount)}</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-5)', marginBottom: '2px' }}>Annual Revenue</div>
                <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-1)' }}>{company.revenue}</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-5)', marginBottom: '2px' }}>Funding Stage</div>
                <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-1)' }}>{company.fundingStage}</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-5)', marginBottom: '2px' }}>Relationship</div>
                <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-1)' }}>{company.relationshipStatus}</div>
              </div>
            </div>
          </div>

          {/* Buying & Intent Signals */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '14px', padding: '24px' }}>
            <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-1)', marginBottom: '14px' }}>
              Recent Developments & Intent Signals
            </h2>
            {company.recentDevelopments && (
              <div style={{ padding: '14px 16px', borderRadius: '10px', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.20)', marginBottom: '16px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--blue-light)', marginBottom: '4px' }}>
                  {demoCompany ? 'KEY TRIGGER' : 'STORED LEAD SIGNAL · NOT VERIFIED'}
                </div>
                <p style={{ fontSize: '13px', color: 'var(--text-2)', lineHeight: 1.5 }}>{company.recentDevelopments}</p>
              </div>
            )}
            {signals.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {signals.map(s => (
                  <div key={s.id} style={{ padding: '12px 14px', borderRadius: '10px', background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span style={{ fontSize: '10px', fontWeight: 800, padding: '2px 6px', borderRadius: '4px', background: 'rgba(244,63,94,0.12)', color: '#FB7185' }}>
                        {s.signalType}
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--text-5)' }}>{timeAgo(s.detectedDate)}</span>
                      <span style={{ fontSize: '11px', color: 'var(--text-5)', marginLeft: 'auto' }}>Source: {s.source}</span>
                    </div>
                    <p style={{ fontSize: '13px', color: 'var(--text-3)', lineHeight: 1.5 }}>{s.description}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: '13px', color: 'var(--text-5)' }}>No automated external intent triggers recorded.</p>
            )}
          </div>
        </div>

        {/* Right Column: Decision Makers & Tech Stack */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {!demoCompany && <POCDiscoveryPanel leadId={id} companyName={company.name} />}

          {/* Existing demo contacts remain sample data only. */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '14px', padding: '20px' }}>
            <h2 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-1)', marginBottom: '14px' }}>
              {demoCompany ? 'Demo Decision Makers' : 'Decision Makers'} ({contacts.length})
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {contacts.map(ct => (
                <div key={ct.id} style={{ padding: '12px', borderRadius: '10px', background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-1)' }}>{ct.name}</span>
                    {ct.emailVerified && <CheckCircle style={{ width: '13px', height: '13px', color: '#10B981' }} />}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-4)', marginBottom: '6px' }}>{ct.role}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-5)', fontFamily: 'monospace' }}>{ct.email}</div>
                </div>
              ))}
              {contacts.length === 0 && (
                <p style={{ fontSize: '12px', color: 'var(--text-5)' }}>No contacts mapped for this account.</p>
              )}
            </div>
          </div>

          {/* Tech Stack */}
          {company.technologies && company.technologies.length > 0 && (
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '14px', padding: '20px' }}>
              <h2 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-1)', marginBottom: '12px' }}>
                Tech Stack
              </h2>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {company.technologies.map(t => (
                  <span key={t} style={{
                    fontSize: '11px', fontWeight: 600, color: 'var(--text-3)',
                    background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                    padding: '4px 10px', borderRadius: '6px',
                  }}>
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
