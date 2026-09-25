'use client'

import { useState } from 'react'
import { DEMO_MEETINGS, DEMO_COMPANIES, DEMO_CONTACTS } from '@/lib/demo-data'
import { useMeetings } from '@/lib/use-backend'
import { Calendar, CheckCircle2, Clock, ExternalLink, Sparkles, FileText, Target, MessageSquare, ChevronDown, ChevronUp, Zap } from 'lucide-react'

const MOM_DATA = {
  mtg_1: {
    summary: 'BrowserStack is evaluating 3 AI testing vendors. Arjun confirmed they have Q4 budget allocated (~₹20-25L). Key requirement: JIRA integration + real-time test failure alerts. Competitor mentioned: a US-based vendor with no India support.',
    actionItems: [
      { owner: 'Prarabdh', action: 'Send technical integration doc for JIRA + Selenium compatibility', due: 'By Friday' },
      { owner: 'Arjun (BrowserStack)', action: 'Share detailed RFP requirements document', due: 'By Wednesday' },
      { owner: 'Prarabdh', action: 'Set up 1-week proof of concept with BrowserStack\'s QA team', due: 'Next Monday' },
    ],
    nextStep: 'Technical POC kick-off scheduled for Monday 10am',
    sentiment: 'POSITIVE',
    dealSignals: ['Budget confirmed at ₹20-25L', 'Timeline: Q4 decision', 'Strong product-fit indicators'],
  },
}

const TALK_TRACKS = {
  mtg_1: [
    { point: 'Lead with BrowserStack\'s RFP', detail: 'Reference: "Active procurement for AI testing tools" — this is why you\'re here today. Position SalesSetu as the exact solution they\'re seeking.' },
    { point: 'India-first advantage', detail: 'Highlight: 24/7 India support, INR pricing, compliance with Indian data laws. Competitors are US-based with 12-hour response delays.' },
    { point: 'JIRA + Selenium integration', detail: 'Come prepared with the technical architecture doc. Arjun is a Director of Technology — go deep on the integration story.' },
    { point: 'ROI anchor: 3.4x pipeline growth', detail: 'Use the Chargebee + Darwinbox case study. Similar SaaS profile, similar team size, 90-day result.' },
  ],
}

export default function MeetingsPage() {
  const [expanded, setExpanded] = useState<string | null>('mtg_1')
  const [momView, setMomView]   = useState<string | null>(null)

  const { data: rawMeetings = [] } = useMeetings()

  const meetings = rawMeetings.map(m => {
    const demo = DEMO_MEETINGS.find(dm => dm.id === m.id || dm.title === m.title)
    return {
      id: m.id,
      title: m.title || demo?.title || 'Discovery & Demo Call',
      companyId: demo?.companyId || 'co_6',
      contactId: demo?.contactId || 'ct_3',
      scheduledAt: m.date ? new Date(m.date) : (demo?.scheduledAt || new Date()),
      duration: demo?.duration || 45,
      meetLink: demo?.meetLink || 'https://meet.google.com/abc-defg-hij',
      agenda: m.summary || demo?.agenda || 'Discuss sales requirements and solution architecture.',
      status: demo?.status || 'SCHEDULED',
      sentiment: m.sentiment || 'Positive',
      actionItems: m.actionItems || '',
    }
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>

      {/* ── Header ──────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 900, color: 'var(--text-1)', letterSpacing: '-0.03em' }}>
            Meeting Intelligence & MoM
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--text-4)', marginTop: '6px' }}>
            Pre-call battle cards, AI-synthesized meeting notes, and automated CRM sync
          </p>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '7px',
          padding: '8px 14px', borderRadius: '10px',
          background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.20)',
        }}>
          <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#10B981' }} className="pulse-dot" />
          <span style={{ fontSize: '12px', fontWeight: 600, color: '#10B981' }}>
            Live Sync · {meetings.length} meetings
          </span>
        </div>
      </div>

      {/* ── Meetings ────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {meetings.map((mtg) => {
          const company  = DEMO_COMPANIES.find(c => c.id === mtg.companyId)
          const contact  = DEMO_CONTACTS.find(c => c.id === mtg.contactId)
          const isOpen   = expanded === mtg.id
          const hasMoM   = !!MOM_DATA[mtg.id as keyof typeof MOM_DATA]
          const mom      = MOM_DATA[mtg.id as keyof typeof MOM_DATA]
          const tracks   = TALK_TRACKS[mtg.id as keyof typeof TALK_TRACKS]
          const timeStr  = new Date(mtg.scheduledAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
          const dateStr  = new Date(mtg.scheduledAt).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })
          const isToday  = new Date(mtg.scheduledAt).toDateString() === new Date().toDateString()
          const showMoM  = momView === mtg.id

          return (
            <div
              key={mtg.id}
              style={{
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: '16px', overflow: 'hidden',
                boxShadow: 'var(--shadow-card)',
              }}
            >
              {/* ── Row ─── */}
              <div style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                {/* Time badge */}
                <div style={{
                  width: '56px', height: '56px', borderRadius: '12px', flexShrink: 0,
                  background: isToday ? 'rgba(59,130,246,0.12)' : 'var(--bg-elevated)',
                  border: isToday ? '1px solid rgba(59,130,246,0.25)' : '1px solid var(--border)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{ fontSize: '18px', fontWeight: 900, color: isToday ? 'var(--blue-light)' : 'var(--text-3)', lineHeight: 1 }}>
                    {new Date(mtg.scheduledAt).getDate()}
                  </span>
                  <span style={{ fontSize: '10px', fontWeight: 700, color: isToday ? 'var(--blue-light)' : 'var(--text-5)', letterSpacing: '0.04em' }}>
                    {new Date(mtg.scheduledAt).toLocaleString('en-IN', { month: 'short' }).toUpperCase()}
                  </span>
                </div>

                {/* Meeting info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                    <p style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-1)' }}>{mtg.title}</p>
                    {isToday && (
                      <span style={{
                        fontSize: '10px', fontWeight: 800,
                        background: 'rgba(59,130,246,0.15)', color: 'var(--blue-light)',
                        padding: '2px 8px', borderRadius: '5px', border: '1px solid rgba(59,130,246,0.25)',
                      }}>
                        TODAY
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-4)' }}>
                      {company?.name} · {contact?.name}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--text-5)' }}>
                      <Clock style={{ width: '11px', height: '11px' }} />
                      {timeStr} · {mtg.duration} min
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                  <a
                    href={mtg.meetLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'flex', alignItems: 'center', gap: '6px',
                      padding: '8px 16px', borderRadius: '9px',
                      background: 'var(--blue)', color: 'white',
                      fontSize: '13px', fontWeight: 700, textDecoration: 'none',
                      boxShadow: '0 2px 10px rgba(59,130,246,0.25)',
                    }}
                  >
                    <CheckCircle2 style={{ width: '13px', height: '13px' }} />
                    Join Meet
                    <ExternalLink style={{ width: '11px', height: '11px', opacity: 0.7 }} />
                  </a>
                  <button
                    onClick={() => setExpanded(isOpen ? null : mtg.id)}
                    style={{
                      width: '36px', height: '36px', borderRadius: '9px',
                      background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', color: 'var(--text-4)',
                    }}
                  >
                    {isOpen ? <ChevronUp style={{ width: '14px', height: '14px' }} /> : <ChevronDown style={{ width: '14px', height: '14px' }} />}
                  </button>
                </div>
              </div>

              {/* ── Battle Card / MoM ─── */}
              {isOpen && (
                <div style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>
                  {/* Tab switcher */}
                  <div style={{ display: 'flex', gap: '0', borderBottom: '1px solid var(--border)' }}>
                    {[
                      { key: 'prep', label: 'Pre-Call Battle Card', icon: Target },
                      { key: 'mom',  label: 'Meeting Notes (MoM)',  icon: FileText, disabled: !hasMoM },
                    ].map(tab => (
                      <button
                        key={tab.key}
                        onClick={() => setMomView(tab.disabled ? null : (showMoM && tab.key === 'mom' ? null : tab.key === 'mom' ? mtg.id : null))}
                        disabled={tab.disabled}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '6px',
                          padding: '12px 20px',
                          background: (showMoM ? tab.key === 'mom' : tab.key === 'prep') ? 'rgba(59,130,246,0.08)' : 'transparent',
                          border: 'none',
                          borderBottom: (showMoM ? tab.key === 'mom' : tab.key === 'prep') ? '2px solid var(--blue)' : '2px solid transparent',
                          color: tab.disabled ? 'var(--text-5)' : (showMoM ? tab.key === 'mom' : tab.key === 'prep') ? 'var(--blue-light)' : 'var(--text-4)',
                          fontSize: '13px', fontWeight: 600, cursor: tab.disabled ? 'not-allowed' : 'pointer',
                          fontFamily: 'inherit', transition: 'all 0.15s ease',
                        }}
                      >
                        <tab.icon style={{ width: '13px', height: '13px' }} />
                        {tab.label}
                        {tab.disabled && <span style={{ fontSize: '10px', color: 'var(--text-5)' }}>(post-meeting)</span>}
                      </button>
                    ))}
                  </div>

                  {/* Content: Battle Card */}
                  {!showMoM && tracks && (
                    <div style={{ padding: '24px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                        <Sparkles style={{ width: '15px', height: '15px', color: 'var(--purple-light)' }} />
                        <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--purple-light)' }}>
                          AI-Generated Talk Tracks for {company?.name}
                        </span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        {tracks.map((t, i) => (
                          <div key={i} style={{
                            padding: '16px', borderRadius: '12px',
                            background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)',
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                              <span style={{
                                width: '22px', height: '22px', borderRadius: '6px', flexShrink: 0,
                                background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.25)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '11px', fontWeight: 800, color: 'var(--purple-light)',
                              }}>
                                {i + 1}
                              </span>
                              <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-1)' }}>{t.point}</p>
                            </div>
                            <p style={{ fontSize: '12px', color: 'var(--text-4)', lineHeight: 1.6 }}>{t.detail}</p>
                          </div>
                        ))}
                      </div>
                      {/* Agenda */}
                      <div style={{ marginTop: '16px', padding: '14px', borderRadius: '12px', background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.18)' }}>
                        <p style={{ fontSize: '11px', fontWeight: 800, color: 'var(--blue-light)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '6px' }}>Agenda</p>
                        <p style={{ fontSize: '13px', color: 'var(--text-3)' }}>{mtg.agenda}</p>
                      </div>
                    </div>
                  )}

                  {/* Content: MoM */}
                  {showMoM && mom && (
                    <div style={{ padding: '24px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '24px' }}>
                        <div>
                          <p style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-5)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '10px' }}>AI Meeting Summary</p>
                          <p style={{ fontSize: '13px', color: 'var(--text-3)', lineHeight: 1.7, marginBottom: '20px' }}>{mom.summary}</p>

                          <p style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-5)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '10px' }}>Action Items</p>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {mom.actionItems.map((a, i) => (
                              <div key={i} style={{
                                display: 'flex', alignItems: 'flex-start', gap: '10px',
                                padding: '12px 14px', borderRadius: '10px',
                                background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)',
                              }}>
                                <span style={{
                                  width: '20px', height: '20px', borderRadius: '5px', flexShrink: 0,
                                  background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  fontSize: '10px', fontWeight: 800, color: '#34D399',
                                }}>
                                  {i + 1}
                                </span>
                                <div style={{ flex: 1 }}>
                                  <p style={{ fontSize: '13px', color: 'var(--text-2)', marginBottom: '2px' }}>{a.action}</p>
                                  <p style={{ fontSize: '11px', color: 'var(--text-5)' }}>
                                    <strong style={{ color: 'var(--text-4)' }}>{a.owner}</strong> · Due: {a.due}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          <div style={{ padding: '16px', borderRadius: '12px', background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.20)' }}>
                            <p style={{ fontSize: '11px', fontWeight: 800, color: '#34D399', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '8px' }}>Deal Signals</p>
                            {mom.dealSignals.map((s, i) => (
                              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                                <Zap style={{ width: '11px', height: '11px', color: '#34D399', flexShrink: 0 }} />
                                <span style={{ fontSize: '12px', color: 'var(--text-3)' }}>{s}</span>
                              </div>
                            ))}
                          </div>
                          <div style={{ padding: '14px', borderRadius: '12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                            <p style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-5)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '6px' }}>Next Step</p>
                            <p style={{ fontSize: '13px', color: 'var(--text-2)' }}>{mom.nextStep}</p>
                          </div>
                          <button style={{
                            padding: '10px', borderRadius: '10px',
                            background: 'var(--blue)', border: 'none',
                            color: 'white', fontSize: '13px', fontWeight: 700,
                            cursor: 'pointer', fontFamily: 'inherit',
                            boxShadow: '0 2px 10px rgba(59,130,246,0.25)',
                          }}>
                            Sync to CRM
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
