'use client'

import { useState, useEffect } from 'react'
import { DEMO_STATS, DEMO_COMPANIES, DEMO_MEETINGS, DEMO_DEALS, DEMO_ACTIVITIES } from '@/lib/demo-data'
import { formatCurrency, timeAgo, dealHealthColor, scoreColor, intentColor } from '@/lib/utils'
import {
  TrendingUp, Users, Mail, Calendar, DollarSign, Target,
  Flame, AlertTriangle, Clock, Zap, ArrowRight, CheckCircle2,
  Building2, Bot, ExternalLink, ArrowUpRight, Activity,
  Sparkles, Shield,
} from 'lucide-react'

/* ── Hero KPI Cards ──────────────────────────────── */
const kpiCards = [
  {
    label: 'Pipeline Value',
    value: '₹1.82 Cr',
    delta: '+₹24L this week',
    deltaUp: true,
    icon: DollarSign,
    accent: 'blue',
    subtext: '6 active deals',
  },
  {
    label: 'High-Intent Accounts',
    value: String(DEMO_COMPANIES.filter(c => c.intentStatus === 'HOT').length),
    delta: '+3 new this week',
    deltaUp: true,
    icon: Flame,
    accent: 'rose',
    subtext: 'Buying signals detected',
  },
  {
    label: 'Outbound Sent (AI)',
    value: String(DEMO_STATS.outreachSent),
    delta: `${DEMO_STATS.responseRate}% response rate`,
    deltaUp: true,
    icon: Mail,
    accent: 'purple',
    subtext: 'Autonomous SDR active',
  },
  {
    label: 'Discovery Meetings',
    value: String(DEMO_STATS.meetings),
    delta: '+3 this month',
    deltaUp: true,
    icon: Calendar,
    accent: 'emerald',
    subtext: '2 scheduled today',
  },
]

const accentStyles: Record<string, { icon: string; bg: string; border: string; badge: string; shadow: string }> = {
  blue:    { icon: '#60A5FA', bg: 'rgba(59,130,246,0.10)', border: 'rgba(59,130,246,0.20)', badge: 'rgba(59,130,246,0.15)', shadow: 'rgba(59,130,246,0.15)' },
  rose:    { icon: '#FB7185', bg: 'rgba(244,63,94,0.10)',  border: 'rgba(244,63,94,0.20)',  badge: 'rgba(244,63,94,0.15)',  shadow: 'rgba(244,63,94,0.15)' },
  purple:  { icon: '#A78BFA', bg: 'rgba(139,92,246,0.10)', border: 'rgba(139,92,246,0.20)', badge: 'rgba(139,92,246,0.15)', shadow: 'rgba(139,92,246,0.15)' },
  emerald: { icon: '#34D399', bg: 'rgba(16,185,129,0.10)', border: 'rgba(16,185,129,0.20)', badge: 'rgba(16,185,129,0.15)', shadow: 'rgba(16,185,129,0.15)' },
}

/* ── AI Prescribed Actions ───────────────────────── */
const aiActions = [
  {
    num: '01', urgency: 'CRITICAL', color: '#F43F5E',
    icon: Flame,
    title: 'BrowserStack meeting in 2 hours — prepare battle card',
    rationale: 'Active RFP for AI testing tools. Arjun Kapoor (Director) confirmed. Deal value ₹24L.',
    href: '/meetings',
    cta: 'Open Battle Card',
  },
  {
    num: '02', urgency: 'HIGH', color: '#F59E0B',
    icon: Mail,
    title: '3 outreach drafts awaiting human approval',
    rationale: 'AI drafted hyper-personalized emails for Sprinklr, MoEngage, Darwinbox. Avg confidence 91%.',
    href: '/approvals',
    cta: 'Review & Approve',
  },
  {
    num: '03', urgency: 'HIGH', color: '#F59E0B',
    icon: AlertTriangle,
    title: 'Sprinklr deal at risk — competitor shortlisted',
    rationale: 'Deal value ₹42L. Price negotiation ongoing. AI recommends executive sponsor call + extended trial.',
    href: '/pipeline',
    cta: 'View Deal',
  },
  {
    num: '04', urgency: 'MEDIUM', color: '#3B82F6',
    icon: Zap,
    title: 'Spendflo proposal sent 3 days ago — follow up now',
    rationale: 'High-intent signals still active. Navin (CEO) opened email 4 times. Strike while hot.',
    href: '/follow-ups',
    cta: 'Send Follow-up',
  },
]

/* ── Deal Health Colors ──────────────────────────── */
function healthBadge(health: string) {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    HEALTHY:          { bg: 'rgba(16,185,129,0.12)',  text: '#34D399', label: 'Healthy' },
    NEEDS_ATTENTION:  { bg: 'rgba(245,158,11,0.12)',  text: '#FBBF24', label: 'Needs Attention' },
    AT_RISK:          { bg: 'rgba(239,68,68,0.12)',   text: '#F87171', label: 'At Risk' },
  }
  const s = map[health] ?? { bg: 'rgba(107,114,128,0.12)', text: '#9CA3AF', label: health }
  return (
    <span style={{
      fontSize: '11px', fontWeight: 700,
      padding: '2px 8px', borderRadius: '6px',
      background: s.bg, color: s.text,
    }}>
      {s.label}
    </span>
  )
}

/* ── Section header ──────────────────────────────── */
function SectionHeader({ icon: Icon, title, badge, href, hrefLabel }: {
  icon: React.ElementType; title: string; badge?: number | string;
  href?: string; hrefLabel?: string;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
      <div style={{
        width: '32px', height: '32px', borderRadius: '8px',
        background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.20)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon style={{ width: '15px', height: '15px', color: 'var(--blue-light)' }} />
      </div>
      <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-1)', flex: 1 }}>{title}</h2>
      {badge !== undefined && (
        <span style={{
          fontSize: '11px', fontWeight: 700,
          padding: '2px 8px', borderRadius: '6px',
          background: 'rgba(59,130,246,0.12)', color: 'var(--blue-light)',
          border: '1px solid rgba(59,130,246,0.20)',
        }}>
          {badge}
        </span>
      )}
      {href && (
        <a href={href} style={{
          fontSize: '12px', fontWeight: 600, color: 'var(--blue-light)',
          textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px',
        }}>
          {hrefLabel ?? 'View all'} <ArrowUpRight style={{ width: '12px', height: '12px' }} />
        </a>
      )}
    </div>
  )
}

export default function DashboardPage() {
  const hotCompanies  = DEMO_COMPANIES.filter(c => c.intentStatus === 'HOT').slice(0, 5)
  const atRiskDeals   = DEMO_DEALS.filter(d => d.health === 'AT_RISK' || d.health === 'NEEDS_ATTENTION')
  const todayMeetings = DEMO_MEETINGS

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>

      {/* ── Page Title ────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{
            fontSize: '28px', fontWeight: 900, color: 'var(--text-1)',
            letterSpacing: '-0.03em', lineHeight: 1.1,
          }}>
            Executive Cockpit
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--text-4)', marginTop: '6px', fontWeight: 500 }}>
            AI Daily Brief — {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '8px 14px', borderRadius: '10px',
            background: 'rgba(139,92,246,0.10)', border: '1px solid rgba(139,92,246,0.22)',
          }}>
            <Sparkles style={{ width: '14px', height: '14px', color: 'var(--purple-light)' }} />
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--purple-light)' }}>AI Copilot Active</span>
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '8px 14px', borderRadius: '10px',
            background: 'rgba(16,185,129,0.10)', border: '1px solid rgba(16,185,129,0.22)',
          }}>
            <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#10B981' }} className="pulse-dot" />
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#34D399' }}>SDR Running</span>
          </div>
        </div>
      </div>

      {/* ── Hero KPI Cards ────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '16px' }}>
        {kpiCards.map((kpi) => {
          const a = accentStyles[kpi.accent]
          return (
            <div
              key={kpi.label}
              style={{
                background: 'var(--bg-card)', border: `1px solid ${a.border}`,
                borderRadius: '16px', padding: '24px',
                boxShadow: `0 4px 24px ${a.shadow}`,
                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                position: 'relative', overflow: 'hidden',
              }}
              className="kpi-card"
            >
              {/* Background glow */}
              <div style={{
                position: 'absolute', top: '-20px', right: '-20px',
                width: '80px', height: '80px', borderRadius: '50%',
                background: a.bg, filter: 'blur(20px)',
              }} />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div style={{
                  width: '40px', height: '40px', borderRadius: '10px',
                  background: a.bg, border: `1px solid ${a.border}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <kpi.icon style={{ width: '18px', height: '18px', color: a.icon }} />
                </div>
                <span style={{
                  fontSize: '11px', fontWeight: 700, color: '#34D399',
                  background: 'rgba(16,185,129,0.12)', padding: '3px 8px',
                  borderRadius: '6px', border: '1px solid rgba(16,185,129,0.20)',
                }}>
                  {kpi.delta}
                </span>
              </div>
              <div style={{ fontSize: '36px', fontWeight: 900, color: 'var(--text-1)', letterSpacing: '-0.04em', lineHeight: 1 }}>
                {kpi.value}
              </div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-3)', marginTop: '6px' }}>
                {kpi.label}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-5)', marginTop: '4px' }}>
                {kpi.subtext}
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Main Grid: AI Actions + Today's Calls ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '20px', alignItems: 'start' }}>

        {/* AI Prescribed Revenue Actions */}
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: '16px', padding: '24px',
          boxShadow: 'var(--shadow-card)',
        }}>
          <SectionHeader
            icon={Zap}
            title="AI Prescribed Revenue Actions"
            badge="Today"
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {aiActions.map((action) => (
              <a
                key={action.num}
                href={action.href}
                style={{ textDecoration: 'none' }}
              >
                <div
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: '16px',
                    padding: '16px',
                    borderRadius: '12px',
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border)',
                    transition: 'all 0.2s ease',
                    cursor: 'pointer',
                  }}
                  className="action-card"
                >
                  {/* Number */}
                  <div style={{
                    fontSize: '13px', fontWeight: 800, color: action.color,
                    fontVariantNumeric: 'tabular-nums',
                    minWidth: '28px',
                    letterSpacing: '-0.02em',
                  }}>
                    {action.num}
                  </div>
                  {/* Icon */}
                  <div style={{
                    width: '32px', height: '32px', borderRadius: '8px', flexShrink: 0,
                    background: `${action.color}18`, border: `1px solid ${action.color}30`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <action.icon style={{ width: '15px', height: '15px', color: action.color }} />
                  </div>
                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '6px' }}>
                      <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-1)', lineHeight: 1.3, flex: 1 }}>
                        {action.title}
                      </p>
                      <span style={{
                        fontSize: '10px', fontWeight: 800, letterSpacing: '0.06em',
                        padding: '2px 7px', borderRadius: '5px', flexShrink: 0,
                        background: `${action.color}18`, color: action.color,
                        border: `1px solid ${action.color}35`,
                        textTransform: 'uppercase',
                      }}>
                        {action.urgency}
                      </span>
                    </div>
                    <p style={{ fontSize: '12px', color: 'var(--text-4)', lineHeight: 1.5 }}>
                      {action.rationale}
                    </p>
                  </div>
                  {/* CTA */}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '5px',
                    padding: '6px 12px', borderRadius: '8px',
                    background: 'rgba(59,130,246,0.10)', border: '1px solid rgba(59,130,246,0.20)',
                    color: 'var(--blue-light)', fontSize: '12px', fontWeight: 600,
                    whiteSpace: 'nowrap', flexShrink: 0,
                    transition: 'all 0.15s ease',
                  }}>
                    {action.cta} <ArrowRight style={{ width: '12px', height: '12px' }} />
                  </div>
                </div>
              </a>
            ))}
          </div>
        </div>

        {/* Today's Executive Calls */}
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: '16px', padding: '24px',
          boxShadow: 'var(--shadow-card)',
        }}>
          <SectionHeader
            icon={Calendar}
            title="Today's Calls"
            badge={todayMeetings.length}
            href="/meetings"
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {todayMeetings.map((mtg) => {
              const company = DEMO_COMPANIES.find(c => c.id === mtg.companyId)
              const timeStr = new Date(mtg.scheduledAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
              const isUpcoming = new Date(mtg.scheduledAt).getTime() - new Date('2026-01-01').getTime() < 3 * 60 * 60 * 1000

              return (
                <div
                  key={mtg.id}
                  style={{
                    padding: '16px', borderRadius: '12px',
                    background: 'var(--bg-elevated)',
                    border: isUpcoming ? '1px solid rgba(59,130,246,0.25)' : '1px solid var(--border)',
                  }}
                >
                  {/* Company + Time */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '10px' }}>
                    <div style={{
                      width: '36px', height: '36px', borderRadius: '9px',
                      background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.20)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '14px', fontWeight: 800, color: 'var(--blue-light)',
                      flexShrink: 0,
                    }}>
                      {company?.name.charAt(0)}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-1)', marginBottom: '2px' }}>
                        {company?.name}
                      </p>
                      <p style={{ fontSize: '12px', color: 'var(--text-4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {mtg.title}
                      </p>
                    </div>
                    {isUpcoming && (
                      <span style={{
                        fontSize: '10px', fontWeight: 700,
                        background: 'rgba(59,130,246,0.15)', color: 'var(--blue-light)',
                        padding: '2px 7px', borderRadius: '5px',
                        border: '1px solid rgba(59,130,246,0.25)',
                        whiteSpace: 'nowrap',
                      }}>
                        UPCOMING
                      </span>
                    )}
                  </div>

                  {/* Time + Duration */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                    <Clock style={{ width: '12px', height: '12px', color: 'var(--text-5)' }} />
                    <span style={{ fontSize: '12px', color: 'var(--text-4)', fontWeight: 500 }}>
                      {timeStr} · {mtg.duration} min
                    </span>
                  </div>

                  {/* Agenda */}
                  <p style={{ fontSize: '11px', color: 'var(--text-5)', marginBottom: '12px', lineHeight: 1.5 }}>
                    {mtg.agenda}
                  </p>

                  {/* Join button */}
                  <a
                    href={mtg.meetLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                      padding: '8px', borderRadius: '8px',
                      background: 'var(--blue)', color: 'white',
                      fontSize: '12px', fontWeight: 700,
                      textDecoration: 'none',
                      transition: 'all 0.15s ease',
                      boxShadow: '0 2px 10px rgba(59,130,246,0.25)',
                    }}
                  >
                    <CheckCircle2 style={{ width: '13px', height: '13px' }} />
                    Join Google Meet
                    <ExternalLink style={{ width: '11px', height: '11px', opacity: 0.7 }} />
                  </a>
                </div>
              )
            })}
            {todayMeetings.length === 0 && (
              <div style={{ textAlign: 'center', padding: '32px 0' }}>
                <Calendar style={{ width: '32px', height: '32px', color: 'var(--text-5)', margin: '0 auto 12px' }} />
                <p style={{ fontSize: '13px', color: 'var(--text-4)' }}>No meetings today</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Bottom Grid: Intent Radar + Deals ──── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>

        {/* High-Intent Accounts Radar */}
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: '16px', padding: '24px',
          boxShadow: 'var(--shadow-card)',
        }}>
          <SectionHeader icon={Flame} title="High-Intent Account Radar" href="/leads" hrefLabel="View all leads" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {hotCompanies.map((c, i) => {
              const colors = intentColor(c.intentStatus)
              const scoreC = c.leadScore >= 80 ? '#34D399' : c.leadScore >= 60 ? '#60A5FA' : '#FBBF24'
              return (
                <a key={c.id} href={`/companies/${c.id}`} style={{ textDecoration: 'none' }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '14px',
                    padding: '12px', borderRadius: '10px',
                    transition: 'background 0.15s ease',
                  }}
                    className="list-row"
                  >
                    {/* Rank */}
                    <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-5)', width: '20px', textAlign: 'center' }}>
                      {i + 1}
                    </span>
                    {/* Logo */}
                    <div style={{
                      width: '36px', height: '36px', borderRadius: '9px', flexShrink: 0,
                      background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '14px', fontWeight: 800, color: 'var(--text-3)',
                    }}>
                      {c.name.charAt(0)}
                    </div>
                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-1)', marginBottom: '2px' }}>{c.name}</p>
                      <p style={{ fontSize: '11px', color: 'var(--text-4)' }}>{c.industry} · {c.city} · {c.fundingStage}</p>
                    </div>
                    {/* Intent badge */}
                    <span style={{
                      fontSize: '10px', fontWeight: 800, padding: '3px 9px',
                      borderRadius: '6px', letterSpacing: '0.04em',
                      background: 'var(--hot-bg)', color: 'var(--hot)',
                      border: '1px solid var(--hot-border)',
                    }}>
                      HOT
                    </span>
                    {/* Score */}
                    <div style={{ textAlign: 'right', minWidth: '52px' }}>
                      <div style={{ fontSize: '18px', fontWeight: 900, color: scoreC, lineHeight: 1 }}>
                        {c.leadScore}
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--text-5)' }}>/100</div>
                    </div>
                  </div>
                </a>
              )
            })}
          </div>
        </div>

        {/* Deals Requiring Intervention */}
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: '16px', padding: '24px',
          boxShadow: 'var(--shadow-card)',
        }}>
          <SectionHeader icon={AlertTriangle} title="Deals Requiring Intervention" href="/pipeline" hrefLabel="Full pipeline" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {atRiskDeals.map((d) => {
              const company = DEMO_COMPANIES.find(c => c.id === d.companyId)
              return (
                <a key={d.id} href="/pipeline" style={{ textDecoration: 'none' }}>
                  <div style={{
                    padding: '14px', borderRadius: '12px',
                    background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                    transition: 'all 0.15s ease',
                  }}
                    className="deal-card"
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px', marginBottom: '8px' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-1)', marginBottom: '2px' }}>
                          {d.name}
                        </p>
                        <p style={{ fontSize: '11px', color: 'var(--text-4)' }}>{company?.name}</p>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', flexShrink: 0 }}>
                        {healthBadge(d.health)}
                        <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-1)' }}>
                          {formatCurrency(d.value ?? 0)}
                        </span>
                      </div>
                    </div>
                    {d.healthReason && (
                      <p style={{ fontSize: '12px', color: 'var(--text-4)', marginBottom: '8px', lineHeight: 1.4 }}>
                        ⚠️ {d.healthReason}
                      </p>
                    )}
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: '6px',
                      padding: '8px 10px', borderRadius: '8px',
                      background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.18)',
                    }}>
                      <Sparkles style={{ width: '12px', height: '12px', color: 'var(--purple-light)', flexShrink: 0 }} />
                      <p style={{ fontSize: '12px', color: 'var(--text-3)', lineHeight: 1.4 }}>
                        <strong style={{ color: 'var(--purple-light)' }}>AI NBA:</strong> {d.nextBestAction}
                      </p>
                    </div>
                    {/* Win probability bar */}
                    <div style={{ marginTop: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ fontSize: '10px', color: 'var(--text-5)' }}>Win probability</span>
                        <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-3)' }}>{d.probability}%</span>
                      </div>
                      <div className="progress-bar">
                        <div
                          className="progress-fill"
                          style={{
                            width: `${d.probability}%`,
                            background: d.probability >= 70 ? '#10B981' : d.probability >= 50 ? '#3B82F6' : '#F59E0B',
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </a>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── Recent Activity Feed ──────────────────── */}
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: '16px', padding: '24px',
        boxShadow: 'var(--shadow-card)',
      }}>
        <SectionHeader icon={Activity} title="Recent Activity Feed" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
          {DEMO_ACTIVITIES.slice(0, 6).map((a, i) => {
            const company = DEMO_COMPANIES.find(c => c.id === a.companyId)
            return (
              <div
                key={a.id}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: '14px',
                  padding: '14px 0',
                  borderBottom: i < 5 ? '1px solid var(--border)' : 'none',
                }}
              >
                {/* Timeline dot */}
                <div style={{
                  width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0, marginTop: '2px',
                  background: a.source === 'AI' ? 'rgba(139,92,246,0.15)' : 'rgba(59,130,246,0.12)',
                  border: `1px solid ${a.source === 'AI' ? 'rgba(139,92,246,0.25)' : 'rgba(59,130,246,0.20)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '10px',
                }}>
                  {a.source === 'AI' ? '🤖' : '👤'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: '13px', color: 'var(--text-2)', lineHeight: 1.5 }}>{a.description}</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                    {company && (
                      <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--blue-light)' }}>{company.name}</span>
                    )}
                    <span style={{ color: 'var(--text-5)', fontSize: '12px' }}>·</span>
                    <span style={{ fontSize: '12px', color: 'var(--text-5)' }}>{timeAgo(a.createdAt)}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <style>{`
        .kpi-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 32px rgba(0,0,0,0.3) !important;
        }
        .action-card:hover {
          background: rgba(255,255,255,0.03) !important;
          border-color: var(--border-strong) !important;
        }
        .list-row:hover {
          background: rgba(255,255,255,0.03);
        }
        .deal-card:hover {
          border-color: var(--border-strong) !important;
          transform: translateY(-1px);
          box-shadow: 0 4px 16px rgba(0,0,0,0.2) !important;
        }
      `}</style>
    </div>
  )
}
