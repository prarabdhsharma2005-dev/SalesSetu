'use client'

import { useState } from 'react'
import { DEMO_COMPANIES, DEMO_CONTACTS, DEMO_DEALS } from '@/lib/demo-data'
import { formatCurrency, timeAgo } from '@/lib/utils'
import { Bell, Clock, Zap, Sparkles, Mail, Check, ChevronRight, AlertTriangle, TrendingUp } from 'lucide-react'

const followUps = [
  {
    id: 'fu_1',
    companyId: 'co_3',
    contactId: 'ct_5',
    dealId: 'deal_2',
    daysStale: 8,
    urgency: 'HIGH',
    lastTouch: 'Email sent — Freddy AI Partnership deck shared',
    aiReason: 'No reply in 8 days. Freshworks typically responds within 3–5 days. Risk of going cold.',
    aiSuggestion: 'Send a brief value-add follow-up — share the "AI partnerships ROI" case study. Don\'t re-pitch; add new value.',
    signalUpdate: 'Aditya Kumar (VP Partnerships) engaged with MoEngage LinkedIn post yesterday — still active.',
  },
  {
    id: 'fu_2',
    companyId: 'co_22',
    contactId: 'ct_7',
    dealId: 'deal_4',
    daysStale: 3,
    urgency: 'CRITICAL',
    lastTouch: 'Commercial proposal sent via email',
    aiReason: 'Navin (CEO) opened the proposal 4 times but hasn\'t replied. Classic "interested but needs a nudge" signal.',
    aiSuggestion: 'Call or WhatsApp Navin directly — "Hi Navin, saw you reviewed the proposal — happy to walk through any questions in 10 minutes."',
    signalUpdate: 'Proposal PDF opened 4x in last 48 hours. Last open: 2 hours ago.',
  },
  {
    id: 'fu_3',
    companyId: 'co_9',
    contactId: 'ct_6',
    dealId: 'deal_5',
    daysStale: 12,
    urgency: 'MEDIUM',
    lastTouch: 'Discovery call completed — sent follow-up email with ROI summary',
    aiReason: 'Budget review delay mentioned. Decision still in progress. Don\'t go dark — maintain presence with value-add touchpoints.',
    aiSuggestion: 'Share the "HR tech AI ROI benchmark report" as a resource — positions you as a trusted advisor, not just a vendor.',
    signalUpdate: 'Darwinbox AI hiring module launched this week — new urgency driver. Reach out now.',
  },
  {
    id: 'fu_4',
    companyId: 'co_17',
    contactId: 'ct_11',
    dealId: undefined,
    daysStale: 5,
    urgency: 'MEDIUM',
    lastTouch: 'Initial cold email sent — AI segment builder hook',
    aiReason: 'No reply yet. Email opened once. Kapil is Head of Partnerships — typically reviews emails but replies to follow-ups.',
    aiSuggestion: 'LinkedIn DM follow-up: "Hey Kapil, sent you an email last week about pairing MoEngage\'s segment builder with our SDR automation — saw you just launched the AI feature, perfect timing!"',
    signalUpdate: 'Kapil posted on LinkedIn about MoEngage AI segment builder 2 days ago.',
  },
  {
    id: 'fu_5',
    companyId: 'co_28',
    contactId: 'ct_10',
    dealId: 'deal_6',
    daysStale: 6,
    urgency: 'CRITICAL',
    lastTouch: 'Competitor shortlisted — price negotiation email sent',
    aiReason: 'Deal AT_RISK. 6 days since last contact. Ritu (Director Sales Ops) is evaluating alternatives. Every day of silence increases churn risk.',
    aiSuggestion: 'Executive escalation: Have Prarabdh reach out to Sprinklr\'s CRO directly with a 30-day extended pilot offer. Show commitment at the leadership level.',
    signalUpdate: 'Sprinklr posted 3 "AI SDR evaluation" questions in a Slack community. Still active in evaluation.',
  },
]

const urgencyConfig: Record<string, { bg: string; text: string; border: string; label: string }> = {
  CRITICAL: { bg: 'rgba(244,63,94,0.12)',  text: '#FB7185', border: 'rgba(244,63,94,0.30)',  label: '🔥 Critical' },
  HIGH:     { bg: 'rgba(245,158,11,0.12)', text: '#FBBF24', border: 'rgba(245,158,11,0.30)', label: '⚡ High' },
  MEDIUM:   { bg: 'rgba(59,130,246,0.12)', text: '#60A5FA', border: 'rgba(59,130,246,0.25)', label: '○ Medium' },
}

export default function FollowUpsPage() {
  const [snoozed, setSnoozed] = useState<Set<string>>(new Set())
  const [done, setDone]       = useState<Set<string>>(new Set())

  const activeItems = followUps.filter(f => !done.has(f.id) && !snoozed.has(f.id))
  const criticalCount = activeItems.filter(f => f.urgency === 'CRITICAL').length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>

      {/* ── Header ──────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 900, color: 'var(--text-1)', letterSpacing: '-0.03em' }}>
            Follow-Up Cadence
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--text-4)', marginTop: '6px' }}>
            AI-prioritized touchpoint queue · Never let a warm deal go cold
          </p>
        </div>
        {criticalCount > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '8px 16px', borderRadius: '10px',
            background: 'rgba(244,63,94,0.10)', border: '1px solid rgba(244,63,94,0.25)',
          }}>
            <AlertTriangle style={{ width: '15px', height: '15px', color: '#FB7185' }} />
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#FB7185' }}>
              {criticalCount} critical follow-up{criticalCount !== 1 ? 's' : ''} today
            </span>
          </div>
        )}
      </div>

      {/* ── Follow-up Cards ─────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {activeItems.map(fu => {
          const company = DEMO_COMPANIES.find(c => c.id === fu.companyId)
          const contact = DEMO_CONTACTS.find(c => c.id === fu.contactId)
          const deal    = DEMO_DEALS.find(d => d.id === fu.dealId)
          const uc      = urgencyConfig[fu.urgency]

          return (
            <div
              key={fu.id}
              style={{
                background: 'var(--bg-card)',
                border: `1px solid ${fu.urgency === 'CRITICAL' ? 'rgba(244,63,94,0.25)' : 'var(--border)'}`,
                borderRadius: '16px', padding: '22px',
                boxShadow: fu.urgency === 'CRITICAL' ? '0 4px 20px rgba(244,63,94,0.08)' : 'var(--shadow-card)',
              }}
            >
              {/* Top row */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', marginBottom: '14px' }}>
                {/* Company logo */}
                <div style={{
                  width: '44px', height: '44px', borderRadius: '11px', flexShrink: 0,
                  background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '18px', fontWeight: 900, color: 'var(--text-3)',
                }}>
                  {company?.name.charAt(0)}
                </div>

                {/* Company + contact info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '3px', flexWrap: 'wrap' }}>
                    <p style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-1)' }}>{company?.name}</p>
                    <span style={{
                      fontSize: '10px', fontWeight: 800, padding: '2px 8px', borderRadius: '6px',
                      background: uc.bg, color: uc.text, border: `1px solid ${uc.border}`,
                    }}>
                      {uc.label}
                    </span>
                    {deal && (
                      <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--blue-light)', background: 'rgba(59,130,246,0.10)', padding: '2px 8px', borderRadius: '5px' }}>
                        {formatCurrency(deal.value ?? 0)}
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--text-4)' }}>
                    {contact?.name} · {contact?.role}
                  </p>
                </div>

                {/* Days stale */}
                <div style={{
                  textAlign: 'center', padding: '8px 14px', borderRadius: '10px',
                  background: fu.daysStale >= 7 ? 'rgba(244,63,94,0.10)' : 'rgba(245,158,11,0.08)',
                  border: `1px solid ${fu.daysStale >= 7 ? 'rgba(244,63,94,0.20)' : 'rgba(245,158,11,0.18)'}`,
                  flexShrink: 0,
                }}>
                  <div style={{ fontSize: '22px', fontWeight: 900, color: fu.daysStale >= 7 ? '#FB7185' : '#FBBF24', lineHeight: 1 }}>
                    {fu.daysStale}d
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--text-5)', marginTop: '2px' }}>since touch</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                {/* Last touch */}
                <div style={{ padding: '12px', borderRadius: '10px', background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                  <p style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-5)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '6px' }}>
                    Last Touch
                  </p>
                  <p style={{ fontSize: '12px', color: 'var(--text-3)', lineHeight: 1.5 }}>{fu.lastTouch}</p>
                </div>

                {/* New signal */}
                <div style={{ padding: '12px', borderRadius: '10px', background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.18)' }}>
                  <p style={{ fontSize: '10px', fontWeight: 800, color: '#34D399', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '6px' }}>
                    New Signal
                  </p>
                  <p style={{ fontSize: '12px', color: 'var(--text-3)', lineHeight: 1.5 }}>{fu.signalUpdate}</p>
                </div>
              </div>

              {/* AI suggestion */}
              <div style={{
                padding: '14px', borderRadius: '12px', marginBottom: '14px',
                background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.22)',
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                  <Sparkles style={{ width: '14px', height: '14px', color: 'var(--purple-light)', flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <p style={{ fontSize: '11px', fontWeight: 800, color: 'var(--purple-light)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '4px' }}>
                      AI Recommended Action
                    </p>
                    <p style={{ fontSize: '13px', color: 'var(--text-2)', lineHeight: 1.6 }}>{fu.aiSuggestion}</p>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => setDone(s => new Set([...s, fu.id]))}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '9px 16px', borderRadius: '9px',
                    background: 'rgba(16,185,129,0.10)', border: '1px solid rgba(16,185,129,0.22)',
                    color: '#34D399', fontSize: '13px', fontWeight: 700,
                    cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s ease',
                  }}
                >
                  <Check style={{ width: '13px', height: '13px' }} /> Mark Done
                </button>
                <button
                  onClick={() => setSnoozed(s => new Set([...s, fu.id]))}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '9px 16px', borderRadius: '9px',
                    background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                    color: 'var(--text-4)', fontSize: '13px', fontWeight: 600,
                    cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s ease',
                  }}
                >
                  Snooze 24h
                </button>
                <button style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                  padding: '9px 16px', borderRadius: '9px',
                  background: 'var(--blue)', border: 'none',
                  color: 'white', fontSize: '13px', fontWeight: 700,
                  cursor: 'pointer', fontFamily: 'inherit',
                  boxShadow: '0 2px 10px rgba(59,130,246,0.25)',
                }}>
                  <Sparkles style={{ width: '13px', height: '13px' }} /> Draft AI Follow-up <ChevronRight style={{ width: '13px', height: '13px' }} />
                </button>
              </div>
            </div>
          )
        })}

        {activeItems.length === 0 && (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: '64px 0', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px',
          }}>
            <Check style={{ width: '40px', height: '40px', color: '#10B981', marginBottom: '16px' }} />
            <p style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-2)', marginBottom: '6px' }}>All caught up! 🎉</p>
            <p style={{ fontSize: '13px', color: 'var(--text-5)' }}>No pending follow-ups. Great sales hygiene.</p>
          </div>
        )}
      </div>
    </div>
  )
}
