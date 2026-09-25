import { DEMO_STATS, DEMO_DEALS, DEMO_COMPANIES, DEMO_ACTIVITIES } from '@/lib/demo-data'
import { formatCurrency } from '@/lib/utils'
import { BarChart3, TrendingUp, Target, DollarSign, Users, Mail, Calendar, Award } from 'lucide-react'

const metrics = [
  { label: 'Total Pipeline',       value: formatCurrency(18200000),  sub: 'Across 6 active deals',         accent: '#3B82F6', bg: 'rgba(59,130,246,0.10)', border: 'rgba(59,130,246,0.20)', icon: DollarSign },
  { label: 'Leads Generated',      value: String(DEMO_STATS.leadsGenerated),  sub: '+12 this week',       accent: '#10B981', bg: 'rgba(16,185,129,0.10)', border: 'rgba(16,185,129,0.20)', icon: Target },
  { label: 'Response Rate',        value: `${DEMO_STATS.responseRate}%`,       sub: 'Industry avg: 8-15%', accent: '#8B5CF6', bg: 'rgba(139,92,246,0.10)', border: 'rgba(139,92,246,0.20)', icon: TrendingUp },
  { label: 'Meetings Booked',      value: String(DEMO_STATS.meetings),         sub: '28.6% conversion',   accent: '#F59E0B', bg: 'rgba(245,158,11,0.10)',  border: 'rgba(245,158,11,0.20)',  icon: Calendar },
  { label: 'Win Rate (YTD)',        value: '33.3%',                              sub: 'Target: 35%',        accent: '#F43F5E', bg: 'rgba(244,63,94,0.10)',  border: 'rgba(244,63,94,0.20)',  icon: Award },
  { label: 'Avg Sales Cycle',      value: `${DEMO_STATS.avgSalesCycle}d`,      sub: 'Down 4d vs last Q',  accent: '#06B6D4', bg: 'rgba(6,182,212,0.10)',   border: 'rgba(6,182,212,0.20)',  icon: BarChart3 },
]

const funnelSteps = [
  { stage: 'Companies Discovered', count: 156, width: 100, color: '#3B82F6' },
  { stage: 'ICP Qualified',        count: 89,  width: 57,  color: '#8B5CF6' },
  { stage: 'Outreach Sent',        count: 47,  width: 30,  color: '#06B6D4' },
  { stage: 'Responded',            count: 16,  width: 10,  color: '#10B981' },
  { stage: 'Meetings Booked',      count: 12,  width: 8,   color: '#F59E0B' },
  { stage: 'Proposals Sent',       count: 6,   width: 4,   color: '#F43F5E' },
]

const channelBreakdown = [
  { channel: 'Cold Email (AI)',    sent: 89, opens: 61, replies: 31, meetings: 9, color: '#3B82F6' },
  { channel: 'LinkedIn InMail',   sent: 34, opens: 28, replies: 9,  meetings: 2, color: '#8B5CF6' },
  { channel: 'WhatsApp Business', sent: 12, opens: 11, replies: 5,  meetings: 1, color: '#10B981' },
]

export default function AnalyticsPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>

      {/* ── Header ──────────────────────────────── */}
      <div>
        <h1 style={{ fontSize: '28px', fontWeight: 900, color: 'var(--text-1)', letterSpacing: '-0.03em' }}>
          Revenue Analytics
        </h1>
        <p style={{ fontSize: '14px', color: 'var(--text-4)', marginTop: '6px' }}>
          AI-powered performance insights · Rolling 30-day view
        </p>
      </div>

      {/* ── KPI Grid ────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
        {metrics.map(m => (
          <div key={m.label} style={{
            background: 'var(--bg-card)', border: `1px solid ${m.border}`,
            borderRadius: '14px', padding: '22px',
            boxShadow: `0 4px 20px ${m.bg}`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div style={{
                width: '38px', height: '38px', borderRadius: '10px',
                background: m.bg, border: `1px solid ${m.border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <m.icon style={{ width: '17px', height: '17px', color: m.accent }} />
              </div>
              <TrendingUp style={{ width: '14px', height: '14px', color: '#10B981' }} />
            </div>
            <div style={{ fontSize: '32px', fontWeight: 900, color: 'var(--text-1)', letterSpacing: '-0.04em', lineHeight: 1, marginBottom: '6px' }}>
              {m.value}
            </div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-3)', marginBottom: '3px' }}>{m.label}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-5)' }}>{m.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        {/* ── Sales Funnel ──── */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '24px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-1)', marginBottom: '20px' }}>
            Sales Funnel
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {funnelSteps.map((step, i) => (
              <div key={step.stage}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                  <span style={{ fontSize: '13px', color: 'var(--text-3)', fontWeight: 500 }}>{step.stage}</span>
                  <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-1)' }}>{step.count}</span>
                </div>
                <div style={{ height: '8px', borderRadius: '9999px', background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: '9999px',
                    width: `${step.width}%`,
                    background: step.color,
                    transition: 'width 0.8s ease-out',
                  }} />
                </div>
                {i < funnelSteps.length - 1 && (
                  <div style={{ fontSize: '10px', color: 'var(--text-5)', marginTop: '3px', textAlign: 'right' }}>
                    {Math.round((funnelSteps[i + 1].count / step.count) * 100)}% conversion →
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ── Channel Breakdown ─── */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '24px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-1)', marginBottom: '20px' }}>
            Channel Performance
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {channelBreakdown.map(ch => (
              <div key={ch.channel} style={{
                padding: '16px', borderRadius: '12px',
                background: 'var(--bg-elevated)', border: '1px solid var(--border)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: ch.color }} />
                  <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-1)' }}>{ch.channel}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '8px', textAlign: 'center' }}>
                  {[
                    { label: 'Sent',    value: ch.sent },
                    { label: 'Opens',   value: ch.opens },
                    { label: 'Replies', value: ch.replies },
                    { label: 'Meetings',value: ch.meetings },
                  ].map(s => (
                    <div key={s.label}>
                      <div style={{ fontSize: '18px', fontWeight: 900, color: ch.color, lineHeight: 1, marginBottom: '3px' }}>{s.value}</div>
                      <div style={{ fontSize: '10px', color: 'var(--text-5)', fontWeight: 500 }}>{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Pipeline by Stage ───────────────────── */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '24px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-1)', marginBottom: '20px' }}>
          Pipeline by Stage
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: '12px' }}>
          {[
            { stage: 'Contacted',    value: 3600000, deals: 1, color: '#6B7280' },
            { stage: 'Engaged',      value: 5000000, deals: 1, color: '#3B82F6' },
            { stage: 'Qualified',    value: 1800000, deals: 1, color: '#8B5CF6' },
            { stage: 'Meeting Done', value: 2400000, deals: 1, color: '#06B6D4' },
            { stage: 'Proposal',     value: 1200000, deals: 1, color: '#F59E0B' },
            { stage: 'Negotiation',  value: 4200000, deals: 1, color: '#F43F5E' },
          ].map(s => (
            <div key={s.stage} style={{
              padding: '16px', borderRadius: '12px', textAlign: 'center',
              background: `${s.color}10`, border: `1px solid ${s.color}25`,
            }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: s.color, margin: '0 auto 10px' }} />
              <div style={{ fontSize: '16px', fontWeight: 900, color: s.color, marginBottom: '4px' }}>
                {formatCurrency(s.value).replace('₹', '₹').slice(0, 8)}
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-5)', fontWeight: 600, letterSpacing: '0.04em' }}>{s.stage}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-5)', marginTop: '4px' }}>{s.deals} deal{s.deals !== 1 ? 's' : ''}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
