'use client'

import { DEMO_DEALS, DEMO_COMPANIES, DEMO_CONTACTS } from '@/lib/demo-data'
import { useDeals } from '@/lib/use-backend'
import { formatCurrency } from '@/lib/utils'
import { KanbanSquare, DollarSign, AlertTriangle, TrendingUp, Zap, Sparkles, Building2, User } from 'lucide-react'

const STAGES = [
  { key: 'CONTACTED',         label: 'Contacted',       color: '#6B7280' },
  { key: 'ENGAGED',           label: 'Engaged',         color: '#3B82F6' },
  { key: 'QUALIFIED',         label: 'Qualified',       color: '#8B5CF6' },
  { key: 'MEETING_COMPLETED', label: 'Meeting Done',    color: '#06B6D4' },
  { key: 'PROPOSAL',          label: 'Proposal Sent',   color: '#F59E0B' },
  { key: 'NEGOTIATION',       label: 'Negotiation',     color: '#F43F5E' },
]

function healthStyle(health: string): { bg: string; text: string; label: string } {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    HEALTHY:         { bg: 'rgba(16,185,129,0.12)',  text: '#34D399', label: '✓ Healthy' },
    NEEDS_ATTENTION: { bg: 'rgba(245,158,11,0.12)',  text: '#FBBF24', label: '⚡ Attention' },
    AT_RISK:         { bg: 'rgba(239,68,68,0.12)',   text: '#F87171', label: '🔥 At Risk' },
    STALE:           { bg: 'rgba(107,114,128,0.10)', text: '#9CA3AF', label: '❄️ Stale' },
  }
  return map[health] ?? { bg: 'rgba(107,114,128,0.10)', text: '#9CA3AF', label: health }
}

export default function PipelinePage() {
  const { data: rawDeals = [] } = useDeals()

  const deals = rawDeals.map(d => {
    const demo = DEMO_DEALS.find(dd => dd.id === d.id || dd.name === d.title)
    return {
      id: d.id,
      name: d.title || demo?.name || 'Enterprise Expansion',
      companyId: demo?.companyId || 'co_6',
      contactId: demo?.contactId || 'ct_3',
      companyName: d.company || 'Enterprise Account',
      stage: d.stage,
      value: Number(d.value) || 0,
      probability: d.probability ?? 60,
      health: d.health || 'HEALTHY',
      nextBestAction: d.nextAction || demo?.nextBestAction || 'Schedule next milestone review',
      currency: 'INR',
    }
  })

  const totalPipeline = deals.reduce((s, d) => s + (d.value ?? 0), 0)
  const weightedForecast = deals.reduce((s, d) => s + ((d.value ?? 0) * d.probability / 100), 0)
  const dealsAtRisk = deals.filter(d => d.health === 'AT_RISK' || d.health === 'NEEDS_ATTENTION').length

  const topMetrics = [
    { label: 'Total Pipeline',     value: formatCurrency(totalPipeline),    icon: DollarSign,    accent: '#3B82F6', bg: 'rgba(59,130,246,0.10)', border: 'rgba(59,130,246,0.20)' },
    { label: 'Weighted Forecast',  value: formatCurrency(weightedForecast), icon: TrendingUp,    accent: '#10B981', bg: 'rgba(16,185,129,0.10)', border: 'rgba(16,185,129,0.20)' },
    { label: 'Deals at Risk',      value: String(dealsAtRisk),              icon: AlertTriangle, accent: '#F43F5E', bg: 'rgba(244,63,94,0.10)',  border: 'rgba(244,63,94,0.20)' },
    { label: 'Win Rate (YTD)',      value: '33.3%',                          icon: Zap,           accent: '#8B5CF6', bg: 'rgba(139,92,246,0.10)', border: 'rgba(139,92,246,0.20)' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>

      {/* ── Header ────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 900, color: 'var(--text-1)', letterSpacing: '-0.03em', lineHeight: 1.1 }}>
            Deal Pipeline
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--text-4)', marginTop: '6px' }}>
            AI-monitored Kanban · Real-time health tracking · Next Best Actions
          </p>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '7px',
          padding: '8px 14px', borderRadius: '10px',
          background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.20)',
        }}>
          <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#10B981' }} className="pulse-dot" />
          <span style={{ fontSize: '12px', fontWeight: 600, color: '#10B981' }}>
            Live Sync · {deals.length} deals
          </span>
        </div>
      </div>

      {/* ── Metrics ───────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '16px' }}>
        {topMetrics.map((m) => (
          <div key={m.label} style={{
            background: 'var(--bg-card)', border: `1px solid ${m.border}`,
            borderRadius: '14px', padding: '20px',
            boxShadow: `0 4px 16px ${m.bg}`,
          }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '9px',
              background: m.bg, border: `1px solid ${m.border}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: '12px',
            }}>
              <m.icon style={{ width: '16px', height: '16px', color: m.accent }} />
            </div>
            <div style={{ fontSize: '26px', fontWeight: 900, color: 'var(--text-1)', letterSpacing: '-0.03em', lineHeight: 1 }}>
              {m.value}
            </div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-4)', marginTop: '6px' }}>{m.label}</div>
          </div>
        ))}
      </div>

      {/* ── Kanban Board ──────────────────────────── */}
      <div style={{ overflowX: 'auto', paddingBottom: '8px' }}>
        <div style={{ display: 'flex', gap: '14px', minWidth: 'max-content' }}>
          {STAGES.map((stage) => {
            const stageDeals = deals.filter(d => d.stage === stage.key)
            const stageTotal = stageDeals.reduce((s, d) => s + (d.value ?? 0), 0)

            return (
              <div
                key={stage.key}
                style={{
                  width: '290px', flexShrink: 0,
                  display: 'flex', flexDirection: 'column', gap: '10px',
                }}
              >
                {/* Column header */}
                <div style={{
                  padding: '12px 14px',
                  borderRadius: '12px',
                  background: 'var(--bg-card)',
                  border: `1px solid ${stage.color}30`,
                  display: 'flex', alignItems: 'center', gap: '8px',
                }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: stage.color, flexShrink: 0 }} />
                  <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-1)', flex: 1 }}>{stage.label}</span>
                  <span style={{
                    fontSize: '11px', fontWeight: 700, color: stage.color,
                    background: `${stage.color}18`, padding: '1px 7px',
                    borderRadius: '5px', border: `1px solid ${stage.color}30`,
                  }}>
                    {stageDeals.length}
                  </span>
                  {stageTotal > 0 && (
                    <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-5)' }}>
                      {formatCurrency(stageTotal).replace('₹', '₹').slice(0, 8)}
                    </span>
                  )}
                </div>

                {/* Deal cards */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {stageDeals.map((deal) => {
                    const company = DEMO_COMPANIES.find(c => c.id === deal.companyId || c.name.toLowerCase() === deal.companyName?.toLowerCase())
                    const contact = DEMO_CONTACTS.find(c => c.id === deal.contactId)
                    const hs = healthStyle(deal.health)

                    return (
                      <div
                        key={deal.id}
                        style={{
                          background: 'var(--bg-card)',
                          border: `1px solid ${deal.health === 'AT_RISK' ? 'rgba(244,63,94,0.25)' : 'var(--border)'}`,
                          borderRadius: '12px', padding: '16px',
                          transition: 'all 0.2s ease',
                          boxShadow: 'var(--shadow-sm)',
                        }}
                        className="deal-kanban-card"
                      >
                        {/* Company + Health */}
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '10px' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-1)', marginBottom: '3px', lineHeight: 1.3 }}>
                              {deal.name}
                            </p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                              <Building2 style={{ width: '11px', height: '11px', color: 'var(--text-5)' }} />
                              <span style={{ fontSize: '11px', color: 'var(--text-4)' }}>{company?.name || deal.companyName}</span>
                            </div>
                          </div>
                          <span style={{
                            fontSize: '10px', fontWeight: 700, padding: '2px 7px',
                            borderRadius: '6px', background: hs.bg, color: hs.text,
                            border: `1px solid ${hs.text}30`, whiteSpace: 'nowrap',
                            flexShrink: 0, marginLeft: '6px',
                          }}>
                            {hs.label}
                          </span>
                        </div>

                        {/* Deal value */}
                        <div style={{ fontSize: '22px', fontWeight: 900, color: 'var(--text-1)', letterSpacing: '-0.03em', marginBottom: '10px' }}>
                          {formatCurrency(deal.value ?? 0)}
                        </div>

                        {/* Win probability bar */}
                        <div style={{ marginBottom: '12px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <span style={{ fontSize: '10px', color: 'var(--text-5)' }}>Win probability</span>
                            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-3)' }}>{deal.probability}%</span>
                          </div>
                          <div style={{ height: '4px', borderRadius: '9999px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                            <div style={{
                              height: '100%', borderRadius: '9999px',
                              width: `${deal.probability}%`,
                              background: deal.probability >= 70 ? '#10B981' : deal.probability >= 50 ? '#3B82F6' : '#F59E0B',
                              transition: 'width 0.6s ease',
                            }} />
                          </div>
                        </div>

                        {/* Contact POC */}
                        {contact && (
                          <div style={{
                            display: 'flex', alignItems: 'center', gap: '6px',
                            marginBottom: '10px',
                          }}>
                            <div style={{
                              width: '22px', height: '22px', borderRadius: '50%',
                              background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.25)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: '9px', fontWeight: 800, color: 'var(--blue-light)', flexShrink: 0,
                            }}>
                              {contact.name.charAt(0)}
                            </div>
                            <div>
                              <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-3)' }}>{contact.name}</span>
                              <span style={{ fontSize: '10px', color: 'var(--text-5)', marginLeft: '4px' }}>· {contact.seniority}</span>
                            </div>
                          </div>
                        )}

                        {/* AI Next Best Action */}
                        <div style={{
                          padding: '8px 10px', borderRadius: '8px',
                          background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.18)',
                        }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                            <Sparkles style={{ width: '11px', height: '11px', color: 'var(--purple-light)', flexShrink: 0, marginTop: '2px' }} />
                            <p style={{ fontSize: '11px', color: 'var(--text-4)', lineHeight: 1.5 }}>
                              <strong style={{ color: 'var(--purple-light)', fontWeight: 700 }}>NBA: </strong>
                              {deal.nextBestAction}
                            </p>
                          </div>
                        </div>
                      </div>
                    )
                  })}

                  {deals.length === 0 && (
                    <div style={{
                      padding: '24px', borderRadius: '12px', textAlign: 'center',
                      background: 'rgba(255,255,255,0.02)', border: '1px dashed var(--border)',
                    }}>
                      <p style={{ fontSize: '12px', color: 'var(--text-5)' }}>No deals</p>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <style>{`
        .deal-kanban-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 24px rgba(0,0,0,0.3) !important;
          border-color: var(--border-strong) !important;
        }
      `}</style>
    </div>
  )
}
