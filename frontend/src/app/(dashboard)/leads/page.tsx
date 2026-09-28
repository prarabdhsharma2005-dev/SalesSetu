'use client'

import { useState } from 'react'
import { DEMO_COMPANIES, DEMO_CONTACTS, DEMO_INTENT_SIGNALS } from '@/lib/demo-data'
import { useLeadSearch, useQualifyLead } from '@/lib/use-backend'
import { formatNumber, timeAgo } from '@/lib/utils'
import {
  Search, Flame, TrendingUp, Globe,
  Building2, Users, Zap, ArrowRight, ChevronDown, ChevronUp,
  MapPin, Briefcase, RefreshCw, Star, ExternalLink, CheckCircle,
  Sparkles,
} from 'lucide-react'

const INDUSTRIES = ['All', 'SaaS', 'FinTech', 'EdTech', 'HealthTech', 'E-commerce', 'Manufacturing', 'InsurTech']
const CITIES     = ['All', 'Bangalore', 'Mumbai', 'Chennai', 'Hyderabad', 'Pune', 'Delhi', 'Gurgaon', 'Coimbatore']
const INTENTS    = ['All', 'HOT', 'WARM', 'COLD']

function IntentBadge({ status }: { status: string }) {
  const cfg: Record<string, { bg: string; text: string; border: string; icon: React.ReactNode }> = {
    HOT:  { bg: 'rgba(244,63,94,0.12)',  text: '#FB7185', border: 'rgba(244,63,94,0.30)',  icon: <Flame style={{ width: '11px', height: '11px' }} /> },
    WARM: { bg: 'rgba(245,158,11,0.12)', text: '#FBBF24', border: 'rgba(245,158,11,0.30)', icon: <TrendingUp style={{ width: '11px', height: '11px' }} /> },
    COLD: { bg: 'rgba(113,113,122,0.10)',text: '#A1A1AA', border: 'rgba(113,113,122,0.25)',icon: <Globe style={{ width: '11px', height: '11px' }} /> },
  }
  const c = cfg[status] ?? cfg.COLD
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '4px',
      fontSize: '10px', fontWeight: 800, letterSpacing: '0.05em',
      padding: '3px 8px', borderRadius: '6px',
      background: c.bg, color: c.text, border: `1px solid ${c.border}`,
    }}>
      {c.icon} {status}
    </span>
  )
}

function ScoreRing({ score }: { score: number }) {
  const color = score >= 80 ? '#10B981' : score >= 60 ? '#3B82F6' : score >= 40 ? '#F59E0B' : '#EF4444'
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: '22px', fontWeight: 900, color, letterSpacing: '-0.03em', lineHeight: 1 }}>{score}</div>
      <div style={{ fontSize: '10px', color: 'var(--text-5)', marginTop: '2px' }}>/100</div>
    </div>
  )
}

function FilterChip({ label, value, options, onChange }: {
  label: string; value: string; options: string[]; onChange: (v: string) => void
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <span style={{ fontSize: '12px', color: 'var(--text-4)', fontWeight: 500 }}>{label}:</span>
      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
        {options.map(opt => (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            style={{
              padding: '4px 10px', borderRadius: '7px',
              fontSize: '12px', fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
              transition: 'all 0.15s ease',
              background: value === opt ? 'var(--blue)' : 'rgba(255,255,255,0.04)',
              color: value === opt ? 'white' : 'var(--text-4)',
              border: value === opt ? '1px solid var(--blue)' : '1px solid var(--border)',
            }}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function LeadsPage() {
  const [search, setSearch]     = useState('')
  const [industry, setIndustry] = useState('All')
  const [city, setCity]         = useState('All')
  const [intent, setIntent]     = useState('All')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [submittedSearch, setSubmittedSearch] = useState('')
  const qualificationMutation = useQualifyLead()

  const {
    data: rawLeads = [],
    isFetching: isSearching,
    isError,
    refetch,
  } = useLeadSearch({ query: submittedSearch, industry, city, intent })

  const companies = rawLeads.map(lead => {
    const demoMatch = DEMO_COMPANIES.find(c => 
      c.id === lead.id || c.name.toLowerCase() === lead.company.toLowerCase()
    )
    if (demoMatch) {
      return {
        ...demoMatch,
        leadId: lead.id,
        name: lead.company || demoMatch.name,
        industry: lead.industry || demoMatch.industry,
        city: lead.city || demoMatch.city,
        leadScore: lead.leadScore || demoMatch.leadScore,
        intentStatus: (lead.status === 'HOT' || lead.status === 'MEETING_SCHEDULED')
          ? ('HOT' as const)
          : (lead.status === 'WARM' || lead.status === 'CONTACTED')
          ? ('WARM' as const)
          : demoMatch.intentStatus,
        recentDevelopments: lead.intentSignal || demoMatch.recentDevelopments,
      }
    }
    return {
      id: lead.id,
      leadId: lead.id,
      name: lead.company,
      website: lead.website || `${lead.company.toLowerCase().replace(/\s+/g, '')}.com`,
      industry: lead.industry || 'Technology',
      employeeCount: typeof lead.employees === 'number' ? lead.employees : parseInt(String(lead.employees)) || 150,
      city: lead.city || 'Bangalore',
      state: 'Karnataka',
      country: lead.country || 'India',
      revenue: '$5M - $20M',
      technologies: ['React', 'Node.js', 'PostgreSQL', 'AWS'],
      leadScore: lead.leadScore || 85,
      whyNowScore: Math.min(100, (lead.leadScore || 85) + 5),
      intentStatus: (lead.status === 'HOT' || lead.status === 'MEETING_SCHEDULED')
        ? ('HOT' as const)
        : (lead.status === 'WARM' || lead.status === 'CONTACTED')
        ? ('WARM' as const)
        : ('COLD' as const),
      recentDevelopments: lead.intentSignal || 'Active expansion signal detected',
      relationshipStatus: 'PROSPECT',
      fundingStage: 'Growth Stage',
      description: `${lead.company} is an active enterprise lead in ${lead.industry || 'Technology'}.`,
    }
  })

  const filtered = companies.sort((a, b) => b.leadScore - a.leadScore)

  function handleSearch() {
    if (search === submittedSearch) {
      void refetch()
      return
    }
    setSubmittedSearch(search)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>

      {/* ── Page Header ──────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 900, color: 'var(--text-1)', letterSpacing: '-0.03em', lineHeight: 1.1 }}>
            Lead Discovery & Intent Radar
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--text-4)', marginTop: '6px', fontWeight: 500 }}>
            AI-powered company intelligence with real-time buying signals
          </p>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '7px',
          padding: '8px 14px', borderRadius: '10px',
          background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.20)',
        }}>
          <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#10B981' }} className="pulse-dot" />
          <span style={{ fontSize: '12px', fontWeight: 600, color: '#10B981' }}>
            Live Sync · {companies.length} companies
          </span>
        </div>
      </div>

      {/* ── AI Search + Filters ──────────────────── */}
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: '16px', padding: '24px',
        boxShadow: 'var(--shadow-card)',
      }}>
        {/* Search bar */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search style={{
              position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)',
              width: '16px', height: '16px', color: 'var(--text-4)',
            }} />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder='Try "SaaS companies in Bangalore raising funds" or "FinTech with AI hiring signals"'
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              style={{
                width: '100%', paddingLeft: '44px', paddingRight: '16px',
                height: '48px', fontSize: '14px',
                background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                borderRadius: '12px', color: 'var(--text-1)',
                fontFamily: 'inherit', outline: 'none',
                transition: 'border-color 0.2s ease',
              }}
            />
          </div>
          <button
            onClick={handleSearch}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '0 20px', height: '48px',
              background: isSearching
                ? 'rgba(139,92,246,0.80)'
                : 'linear-gradient(135deg, var(--blue) 0%, var(--purple) 100%)',
              border: 'none', borderRadius: '12px',
              cursor: 'pointer', color: 'white',
              fontSize: '14px', fontWeight: 700, fontFamily: 'inherit',
              whiteSpace: 'nowrap',
              boxShadow: '0 4px 16px rgba(59,130,246,0.25)',
              transition: 'all 0.2s ease',
            }}
          >
            <Sparkles style={{ width: '15px', height: '15px' }} />
            {isSearching ? 'Scanning signals...' : 'AI Search'}
          </button>
        </div>

        {/* Filter chips */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center' }}>
          <FilterChip label="Industry" value={industry} options={INDUSTRIES} onChange={setIndustry} />
          <FilterChip label="City" value={city} options={CITIES.slice(0, 6)} onChange={setCity} />
          <FilterChip label="Intent" value={intent} options={INTENTS} onChange={setIntent} />
          <div style={{
            marginLeft: 'auto', fontSize: '13px', fontWeight: 600,
            color: 'var(--text-4)', background: 'var(--bg-elevated)',
            padding: '4px 12px', borderRadius: '7px', border: '1px solid var(--border)',
          }}>
            {filtered.length} results
          </div>
        </div>
      </div>

      {/* ── Company Cards ────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {isError && (
          <div role="alert" style={{ padding: '16px', color: 'var(--text-3)', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px' }}>
            Lead search could not reach the backend. Please try again.
          </div>
        )}
        {isSearching && (
          <div role="status" style={{ padding: '12px', color: 'var(--text-4)', textAlign: 'center' }}>
            Searching stored leads…
          </div>
        )}
        {!isSearching && !isError && filtered.length === 0 && (
          <div style={{ padding: '24px', color: 'var(--text-4)', textAlign: 'center', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px' }}>
            No leads match these search criteria.
          </div>
        )}
        {filtered.map((company) => {
          const contacts = DEMO_CONTACTS.filter(c => c.companyId === company.id)
          const signals  = DEMO_INTENT_SIGNALS.filter(s => s.companyId === company.id)
          const isOpen   = expanded === company.id
          const storedLead = rawLeads.find(lead => lead.id === company.leadId)
          const storedQualification = storedLead?.qualificationStatus ? {
            status: storedLead.qualificationStatus,
            score: storedLead.qualificationScore ?? null,
            reasons: storedLead.qualificationReasons || [],
            criteria: storedLead.qualificationCriteria || [],
            evidence: storedLead.qualificationEvidence || [],
            unknowns: storedLead.qualificationUnknowns || [],
            updatedAt: storedLead.qualificationUpdatedAt || '',
          } : null
          const latestQualification = qualificationMutation.data?.lead.id === company.leadId
            ? qualificationMutation.data.qualification
            : storedQualification
          const isQualifying = qualificationMutation.isPending && qualificationMutation.variables === company.leadId

          return (
            <div
              key={company.id}
              style={{
                background: 'var(--bg-card)', border: `1px solid ${isOpen ? 'rgba(59,130,246,0.25)' : 'var(--border)'}`,
                borderRadius: '14px', overflow: 'hidden',
                transition: 'border-color 0.2s ease',
                boxShadow: isOpen ? '0 4px 24px rgba(59,130,246,0.10)' : 'none',
              }}
            >
              {/* ── Card Row ─── */}
              <div
                onClick={() => setExpanded(isOpen ? null : company.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '16px',
                  padding: '18px 20px', cursor: 'pointer',
                  transition: 'background 0.15s ease',
                }}
                className="company-row"
              >
                {/* Logo */}
                <div style={{
                  width: '44px', height: '44px', borderRadius: '11px', flexShrink: 0,
                  background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '16px', fontWeight: 900, color: 'var(--text-3)',
                }}>
                  {company.name.charAt(0)}
                </div>

                {/* Company info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                    <p style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-1)' }}>{company.name}</p>
                    <IntentBadge status={company.intentStatus} />
                    {signals.length > 0 && (
                      <span style={{
                        fontSize: '10px', fontWeight: 700, color: 'var(--purple-light)',
                        background: 'var(--purple-subtle)', border: '1px solid rgba(139,92,246,0.25)',
                        padding: '2px 7px', borderRadius: '5px',
                      }}>
                        {signals.length} signal{signals.length > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--text-4)', lineHeight: 1.4 }}>
                    {company.industry} · {company.city}, {company.state} · {' '}
                    {formatNumber(company.employeeCount)} employees · {company.fundingStage}
                  </p>
                </div>

                {/* Score bars */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', width: '160px', flexShrink: 0 }}>
                  {[
                    { label: 'Lead Score', value: company.leadScore },
                    { label: 'Why Now',    value: company.whyNowScore },
                  ].map(s => (
                    <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '10px', color: 'var(--text-5)', width: '60px', flexShrink: 0 }}>{s.label}</span>
                      <div style={{ flex: 1, height: '4px', borderRadius: '9999px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                        <div style={{
                          height: '100%', borderRadius: '9999px',
                          width: `${s.value}%`,
                          background: s.value >= 80 ? '#10B981' : s.value >= 60 ? '#3B82F6' : '#F59E0B',
                          transition: 'width 0.6s ease-out',
                        }} />
                      </div>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-3)', width: '24px', textAlign: 'right' }}>{s.value}</span>
                    </div>
                  ))}
                </div>

                {/* POC count */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '5px',
                  padding: '4px 10px', borderRadius: '7px',
                  background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                  flexShrink: 0,
                }}>
                  <Users style={{ width: '12px', height: '12px', color: 'var(--text-4)' }} />
                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-3)' }}>
                    {contacts.length} POC{contacts.length !== 1 ? 's' : ''}
                  </span>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                  <a
                    href={`/companies/${company.leadId || company.id}`}
                    onClick={e => e.stopPropagation()}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '5px',
                      padding: '7px 14px', borderRadius: '8px',
                      background: 'var(--blue)', color: 'white',
                      fontSize: '12px', fontWeight: 700, textDecoration: 'none',
                      transition: 'background 0.15s ease',
                    }}
                  >
                    Research <ArrowRight style={{ width: '12px', height: '12px' }} />
                  </a>
                  <div style={{
                    width: '32px', height: '32px', borderRadius: '8px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                    color: 'var(--text-4)', cursor: 'pointer',
                  }}>
                    {isOpen
                      ? <ChevronUp style={{ width: '14px', height: '14px' }} />
                      : <ChevronDown style={{ width: '14px', height: '14px' }} />
                    }
                  </div>
                </div>
              </div>

              {/* ── Intelligence Drawer ─── */}
              {isOpen && (
                <div style={{
                  borderTop: '1px solid var(--border)',
                  background: 'var(--bg-elevated)',
                  padding: '24px',
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 1fr',
                  gap: '24px',
                }}>
                  {/* Column 1: Company Dossier */}
                  <div>
                    <p style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-5)', letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: '12px' }}>
                      Company Dossier
                    </p>
                    <p style={{ fontSize: '13px', color: 'var(--text-3)', lineHeight: 1.6, marginBottom: '12px' }}>
                      {company.description}
                    </p>
                    {company.recentDevelopments && (
                      <>
                        <p style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-5)', letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: '8px', marginTop: '12px' }}>
                          Recent Developments
                        </p>
                        <p style={{ fontSize: '13px', color: 'var(--text-2)', lineHeight: 1.6 }}>
                          {company.recentDevelopments}
                        </p>
                      </>
                    )}
                    {/* Tech stack */}
                    <p style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-5)', letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: '8px', marginTop: '12px' }}>
                      Tech Stack
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                      {company.technologies?.map((t: string) => (
                        <span key={t} style={{
                          fontSize: '11px', fontWeight: 600, color: 'var(--text-3)',
                          background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)',
                          padding: '2px 8px', borderRadius: '5px',
                        }}>
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Column 2: Live Intent Triggers */}
                  <div>
                    <p style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-5)', letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: '12px' }}>
                      Live Intent Triggers
                    </p>
                    {signals.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {signals.map(s => (
                          <div key={s.id} style={{
                            padding: '12px', borderRadius: '10px',
                            background: 'rgba(244,63,94,0.06)', border: '1px solid rgba(244,63,94,0.15)',
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                              <span style={{
                                fontSize: '9px', fontWeight: 800, letterSpacing: '0.08em',
                                padding: '2px 6px', borderRadius: '4px',
                                background: 'rgba(244,63,94,0.15)', color: '#FB7185',
                                border: '1px solid rgba(244,63,94,0.25)',
                              }}>
                                {s.signalType}
                              </span>
                              <span style={{ fontSize: '10px', color: 'var(--text-5)' }}>{timeAgo(s.detectedDate)}</span>
                            </div>
                            <p style={{ fontSize: '12px', color: 'var(--text-2)', lineHeight: 1.5, marginBottom: '4px' }}>
                              {s.description}
                            </p>
                            <p style={{ fontSize: '10px', color: 'var(--text-5)' }}>
                              🤖 {s.source} · {Math.round(s.confidence * 100)}% confidence
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-5)', fontSize: '13px' }}>
                        No active signals detected
                      </div>
                    )}
                  </div>

                  {/* Column 3: Verified Decision Makers */}
                  <div>
                    <p style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-5)', letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: '12px' }}>
                      Verified Decision Makers
                    </p>
                    {contacts.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px' }}>
                        {contacts.slice(0, 3).map(ct => (
                          <div key={ct.id} style={{
                            display: 'flex', alignItems: 'center', gap: '10px',
                            padding: '10px 12px', borderRadius: '10px',
                            background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)',
                          }}>
                            <div style={{
                              width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
                              background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.25)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: '12px', fontWeight: 800, color: 'var(--blue-light)',
                            }}>
                              {ct.name.charAt(0)}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-1)' }}>{ct.name}</p>
                                {ct.emailVerified && <CheckCircle style={{ width: '11px', height: '11px', color: '#10B981' }} />}
                              </div>
                              <p style={{ fontSize: '11px', color: 'var(--text-4)' }}>{ct.role}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p style={{ fontSize: '13px', color: 'var(--text-5)', marginBottom: '14px' }}>
                        No contacts identified yet
                      </p>
                    )}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <a
                        href={`/companies/${company.leadId || company.id}`}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                          padding: '10px', borderRadius: '10px',
                          background: 'var(--blue)', color: 'white',
                          fontSize: '13px', fontWeight: 700, textDecoration: 'none',
                          boxShadow: '0 2px 10px rgba(59,130,246,0.25)',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <Building2 style={{ width: '14px', height: '14px' }} />
                        View Full Intelligence
                      </a>
                      <button style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                        padding: '10px', borderRadius: '10px',
                        background: 'rgba(139,92,246,0.10)', border: '1px solid rgba(139,92,246,0.25)',
                        color: 'var(--purple-light)', fontSize: '13px', fontWeight: 700,
                        cursor: 'pointer', fontFamily: 'inherit',
                        transition: 'all 0.15s ease',
                      }}>
                        <Sparkles style={{ width: '14px', height: '14px' }} />
                        Draft AI Pitch
                      </button>
                    </div>
                  </div>
                  <section style={{ gridColumn: '1 / -1', padding: '18px', border: '1px solid var(--border)', borderRadius: '12px', background: 'var(--bg-card)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
                      <div>
                        <p style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-2)' }}>Qualification</p>
                        <p style={{ fontSize: '11px', color: 'var(--text-5)', marginTop: '3px' }}>AI assessment of available SalesSetu data; not an objectively verified score.</p>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: latestQualification ? 'var(--text-2)' : 'var(--text-5)' }}>
                          {latestQualification ? latestQualification.status.replace('_', ' ').toUpperCase() : 'Not yet qualified'}
                        </span>
                        <button
                          type="button"
                          disabled={!company.leadId || isQualifying}
                          onClick={event => { event.stopPropagation(); qualificationMutation.reset(); if (company.leadId) qualificationMutation.mutate(company.leadId) }}
                          style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-2)', fontSize: '12px', fontWeight: 700, cursor: isQualifying ? 'wait' : 'pointer', fontFamily: 'inherit' }}
                        >
                          {isQualifying ? 'Qualifying…' : latestQualification ? 'Requalify' : 'Qualify lead'}
                        </button>
                      </div>
                    </div>
                    {qualificationMutation.isError && qualificationMutation.variables === company.leadId && <p role="alert" style={{ color: '#FCA5A5', fontSize: '12px', marginBottom: '10px' }}>{qualificationMutation.error.message}</p>}
                    {latestQualification && (
                      <>
                        <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-2)', marginBottom: '10px' }}>
                          Score: {latestQualification.score === null ? 'Unknown — insufficient assessable criteria' : `${latestQualification.score}/100 · assessed criteria only`}
                        </p>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '8px' }}>
                          {latestQualification.criteria.map(criterion => (
                            <div key={criterion.key} style={{ padding: '10px', borderRadius: '9px', border: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>
                              <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-2)' }}>{criterion.label}: {criterion.rating.toUpperCase()}</p>
                              <p style={{ fontSize: '11px', color: 'var(--text-4)', marginTop: '4px', lineHeight: 1.5 }}>{criterion.assessment}</p>
                              {criterion.evidence.map((item, index) => (
                                <p key={`${item.field}-${index}`} style={{ fontSize: '10px', color: 'var(--text-5)', marginTop: '4px', overflowWrap: 'anywhere' }}>
                                  {item.origin === 'sales_setu_record' ? 'Stored record (source not independently verified)' : item.origin === 'user_defined' ? 'Saved ICP rulebook' : item.origin === 'source_backed' ? 'Source-backed' : item.origin === 'ai_inference' ? 'AI inference' : 'Unknown'}: {item.value}
                                  {item.sourceUrl && <> · <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--blue-light)' }}>Source</a></>}
                                </p>
                              ))}
                            </div>
                          ))}
                        </div>
                        {latestQualification.reasons.length > 0 && <div style={{ marginTop: '12px' }}><p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-3)', marginBottom: '5px' }}>Reasons</p>{latestQualification.reasons.map((reason, index) => <p key={index} style={{ fontSize: '11px', color: 'var(--text-4)', marginTop: '3px' }}>• {reason}</p>)}</div>}
                        {latestQualification.unknowns.length > 0 && <div style={{ marginTop: '12px' }}><p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-3)', marginBottom: '5px' }}>Unknown / unavailable</p>{latestQualification.unknowns.map((unknown, index) => <p key={index} style={{ fontSize: '11px', color: 'var(--text-5)', marginTop: '3px' }}>• {unknown}</p>)}</div>}
                        <p style={{ fontSize: '10px', color: 'var(--text-5)', marginTop: '10px' }}>Updated {latestQualification.updatedAt ? new Date(latestQualification.updatedAt).toLocaleString() : '—'} · status requires review when ICP context is unavailable.</p>
                      </>
                    )}
                  </section>
                </div>
              )}
            </div>
          )
        })}

        {filtered.length === 0 && (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: '64px 0',
            background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px',
          }}>
            <Search style={{ width: '40px', height: '40px', color: 'var(--text-5)', marginBottom: '16px' }} />
            <p style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-3)', marginBottom: '6px' }}>No companies match your filters</p>
            <p style={{ fontSize: '13px', color: 'var(--text-5)' }}>Try adjusting industry, city, or intent filters</p>
          </div>
        )}
      </div>

      <style>{`
        .company-row:hover { background: rgba(255,255,255,0.02); }
      `}</style>
    </div>
  )
}
