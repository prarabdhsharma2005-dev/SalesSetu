'use client'

import { useState, useEffect } from 'react'
import { DEMO_COMPANIES, DEMO_CONTACTS } from '@/lib/demo-data'
import { useOutreach, useUpdateOutreachStatus } from '@/lib/use-backend'
import { CheckSquare, X, Check, Sparkles, Mail, Star, Shield, Clock, ChevronRight, MessageSquare } from 'lucide-react'

const draftEmails = [
  {
    id: 'draft_1',
    companyId: 'co_28',
    contactId: 'ct_10',
    subject: 'Re: Sprinklr SDR Automation — Extending Trial + Executive Sponsor Offer',
    body: `Hi Ritu,

Following our conversation last week, I wanted to reach out with a couple of thoughts that I believe directly address Sprinklr's evaluation criteria.

I understand you're comparing 2-3 vendors on pricing. Rather than a race to the bottom, I'd like to offer something more valuable: a 30-day extended pilot with your actual Sprinklr SDRs — measured by response rate improvement and meeting bookings.

Additionally, our CEO Prarabdh Sharma would love to connect with your CRO for a peer-level conversation about how AI-native SDR motion changes the unit economics of outbound.

Would Thursday or Friday this week work for a 20-minute call?

Best,
Prarabdh`,
    tone: 'Executive Brief',
    channel: 'Email',
    aiRationale: 'Deal is AT_RISK with competitor shortlisted. Executive touch + extended trial offer addresses price objection while re-anchoring on value. Confidence 94%.',
    triggerHook: 'Competitor shortlisted detected via social listening. Deal stalled for 6 days.',
    confidence: 94,
    personalizationScore: 96,
    compliance: ['No spam triggers', 'CAN-SPAM compliant', 'DPDP Act safe'],
  },
  {
    id: 'draft_2',
    companyId: 'co_17',
    contactId: 'ct_11',
    subject: 'Kapil — AI sales automation that pairs with MoEngage\'s new segment builder',
    body: `Hi Kapil,

Saw the MoEngage AI segment builder announcement — congrats on the launch!

Quick thought: your segment builder identifies who to target. SalesSetu's autonomous SDR then reaches out to those exact accounts with hyper-personalized, AI-crafted messages — closing the loop from "who to target" to "meeting booked."

3 Indian SaaS companies using this combo saw 3.2x pipeline growth in 90 days. Happy to share the playbook.

Worth a 15-minute chat this week?

— Prarabdh`,
    tone: 'Consultative',
    channel: 'Email',
    aiRationale: 'MoEngage just launched AI segment builder — perfect hook to position SalesSetu as the GTM execution layer for their own product. Timing score 91/100.',
    triggerHook: 'MoEngage AI segment builder press release detected (3 days ago). Kapil is Head of Strategic Partnerships.',
    confidence: 91,
    personalizationScore: 93,
    compliance: ['No spam triggers', 'CAN-SPAM compliant', 'DPDP Act safe'],
  },
  {
    id: 'draft_3',
    companyId: 'co_20',
    contactId: 'ct_9',
    subject: 'Vishal — congrats on the Series A + thoughts on your enterprise GTM',
    body: `Hi Vishal,

Huge congrats on the NimbleEdge Series A — well deserved. On-device AI inference is going to be massive.

Building enterprise sales from scratch post-funding is one of the hardest things to do fast. SalesSetu is built exactly for this — autonomous outbound that reaches 50+ enterprise accounts per week with context-rich, personalized outreach.

Your first 5 enterprise logos in 90 days. That's the goal I'd love to help you hit.

Would you be open to a 20-minute strategy call next week?

Prarabdh`,
    tone: 'Urgent ROI',
    channel: 'Email',
    aiRationale: 'NimbleEdge raised Series A 8 days ago. Vishal (Co-Founder/CEO) is actively building enterprise GTM. Funding-moment outreach has 3.4x higher response rate. Confidence 96%.',
    triggerHook: 'Series A funding round detected via TechCrunch (8 days ago). LinkedIn shows BDR hiring surge.',
    confidence: 96,
    personalizationScore: 98,
    compliance: ['No spam triggers', 'CAN-SPAM compliant', 'DPDP Act safe'],
  },
]

export default function ApprovalsPage() {
  const { data: liveOutreach = [] } = useOutreach()
  const updateOutreachMutation = useUpdateOutreachStatus()

  // Format backend outreach items to match draft shape
  const customDrafts = liveOutreach.map((item) => ({
    id: item.id,
    companyId: '',
    companyName: item.company,
    contactId: '',
    contactName: item.prospectName,
    subject: item.subject,
    body: item.body,
    tone: 'Executive AI',
    channel: 'Email',
    aiRationale: 'Generated in AI Outreach Studio and queued for human review before dispatch.',
    triggerHook: `Outreach queued for ${item.email}`,
    confidence: 94,
    personalizationScore: 96,
    compliance: ['No spam triggers', 'CAN-SPAM compliant', 'DPDP Act safe'],
    initialStatus: (item.status.toLowerCase() as 'pending' | 'approved' | 'rejected') || 'pending',
  }))

  const allDrafts = [
    ...customDrafts,
    ...draftEmails.map(d => ({
      ...d,
      companyName: undefined as string | undefined,
      contactName: undefined as string | undefined,
      initialStatus: 'pending' as const,
    }))
  ]

  const [statuses, setStatuses] = useState<Record<string, 'pending' | 'approved' | 'rejected'>>({})

  // Initialize and load saved statuses from localStorage
  useEffect(() => {
    try {
      const saved = typeof window !== 'undefined' ? localStorage.getItem('salessetu_approvals') : null
      const parsed = saved ? JSON.parse(saved) : {}
      const initial: Record<string, 'pending' | 'approved' | 'rejected'> = {}
      for (const d of allDrafts) {
        initial[d.id] = parsed[d.id] || d.initialStatus || 'pending'
      }
      setStatuses(initial)
    } catch {
      // ignore
    }
  }, [liveOutreach.length])

  function approve(id: string) {
    setStatuses(s => {
      const next = { ...s, [id]: 'approved' as const }
      try { localStorage.setItem('salessetu_approvals', JSON.stringify(next)) } catch {}
      return next
    })
    if (id.startsWith('outreach_')) {
      updateOutreachMutation.mutate({ id, status: 'APPROVED' })
    }
  }

  function reject(id: string) {
    setStatuses(s => {
      const next = { ...s, [id]: 'rejected' as const }
      try { localStorage.setItem('salessetu_approvals', JSON.stringify(next)) } catch {}
      return next
    })
    if (id.startsWith('outreach_')) {
      updateOutreachMutation.mutate({ id, status: 'REJECTED' })
    }
  }

  const pendingCount = allDrafts.filter(d => (statuses[d.id] || d.initialStatus) === 'pending').length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>

      {/* ── Header ──────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 900, color: 'var(--text-1)', letterSpacing: '-0.03em' }}>
            Human Approval Inbox
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--text-4)', marginTop: '6px' }}>
            Review AI-drafted outreach before dispatch · Human-in-the-Loop control
          </p>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '8px 16px', borderRadius: '10px',
          background: pendingCount > 0 ? 'rgba(244,63,94,0.10)' : 'rgba(16,185,129,0.10)',
          border: `1px solid ${pendingCount > 0 ? 'rgba(244,63,94,0.25)' : 'rgba(16,185,129,0.25)'}`,
        }}>
          <CheckSquare style={{ width: '15px', height: '15px', color: pendingCount > 0 ? '#FB7185' : '#34D399' }} />
          <span style={{ fontSize: '13px', fontWeight: 700, color: pendingCount > 0 ? '#FB7185' : '#34D399' }}>
            {pendingCount} pending review{pendingCount !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* ── Draft Cards ─────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {allDrafts.map((draft) => {
          const company = draft.companyId ? DEMO_COMPANIES.find(c => c.id === draft.companyId) : undefined
          const contact = draft.contactId ? DEMO_CONTACTS.find(c => c.id === draft.contactId) : undefined
          const recipientName = draft.contactName || contact?.name || 'Key Contact'
          const recipientCompany = draft.companyName || company?.name || 'Target Account'
          const recipientRole = contact?.role || 'Executive'
          const status = statuses[draft.id] || draft.initialStatus || 'pending'

          return (
            <div
              key={draft.id}
              style={{
                background: 'var(--bg-card)',
                border: `1px solid ${status === 'approved' ? 'rgba(16,185,129,0.30)' : status === 'rejected' ? 'rgba(239,68,68,0.20)' : 'var(--border)'}`,
                borderRadius: '16px', overflow: 'hidden',
                opacity: status !== 'pending' ? 0.7 : 1,
                transition: 'all 0.3s ease',
                boxShadow: status === 'approved' ? '0 4px 20px rgba(16,185,129,0.10)' : 'var(--shadow-card)',
              }}
            >
              {/* Status ribbon */}
              {status !== 'pending' && (
                <div style={{
                  padding: '10px 24px',
                  background: status === 'approved' ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.10)',
                  borderBottom: `1px solid ${status === 'approved' ? 'rgba(16,185,129,0.20)' : 'rgba(239,68,68,0.15)'}`,
                  display: 'flex', alignItems: 'center', gap: '8px',
                }}>
                  {status === 'approved'
                    ? <><Check style={{ width: '14px', height: '14px', color: '#34D399' }} /><span style={{ fontSize: '13px', fontWeight: 700, color: '#34D399' }}>Approved & Dispatched</span></>
                    : <><X style={{ width: '14px', height: '14px', color: '#F87171' }} /><span style={{ fontSize: '13px', fontWeight: 700, color: '#F87171' }}>Rejected</span></>
                  }
                </div>
              )}

              <div style={{ padding: '24px', display: 'grid', gridTemplateColumns: '1fr 300px', gap: '24px' }}>
                {/* ── Left: Email Draft ─── */}
                <div>
                  {/* Header */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '20px' }}>
                    <div style={{
                      width: '40px', height: '40px', borderRadius: '10px', flexShrink: 0,
                      background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.20)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Mail style={{ width: '18px', height: '18px', color: 'var(--blue-light)' }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-1)' }}>
                          To: {recipientName}
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--text-4)' }}>
                          {recipientRole} @ {recipientCompany}
                        </span>
                        <span style={{
                          fontSize: '10px', fontWeight: 700, color: 'var(--purple-light)',
                          background: 'var(--purple-subtle)', border: '1px solid rgba(139,92,246,0.25)',
                          padding: '2px 7px', borderRadius: '5px',
                        }}>
                          {draft.tone}
                        </span>
                        <span style={{
                          fontSize: '10px', fontWeight: 700, color: 'var(--blue-light)',
                          background: 'rgba(59,130,246,0.10)', border: '1px solid rgba(59,130,246,0.20)',
                          padding: '2px 7px', borderRadius: '5px',
                        }}>
                          {draft.channel}
                        </span>
                      </div>
                      <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-1)' }}>
                        {draft.subject}
                      </p>
                    </div>
                  </div>

                  {/* Email body */}
                  <div style={{
                    padding: '16px', borderRadius: '12px',
                    background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                    fontSize: '13px', color: 'var(--text-3)', lineHeight: 1.8,
                    whiteSpace: 'pre-wrap', fontFamily: 'inherit',
                    maxHeight: '280px', overflowY: 'auto',
                  }}>
                    {draft.body}
                  </div>

                  {/* Compliance checks */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '14px', flexWrap: 'wrap' }}>
                    {draft.compliance.map(c => (
                      <div key={c} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <Shield style={{ width: '11px', height: '11px', color: '#10B981' }} />
                        <span style={{ fontSize: '11px', color: 'var(--text-4)', fontWeight: 500 }}>{c}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ── Right: AI Sidebar ─── */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {/* Confidence + Personalization scores */}
                  <div style={{
                    padding: '16px', borderRadius: '12px',
                    background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.18)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                      <Sparkles style={{ width: '15px', height: '15px', color: 'var(--purple-light)' }} />
                      <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--purple-light)' }}>AI Analysis</span>
                    </div>
                    {[
                      { label: 'AI Confidence', value: draft.confidence, color: '#A78BFA' },
                      { label: 'Personalization', value: draft.personalizationScore, color: '#34D399' },
                    ].map(s => (
                      <div key={s.label} style={{ marginBottom: '10px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span style={{ fontSize: '11px', color: 'var(--text-4)', fontWeight: 500 }}>{s.label}</span>
                          <span style={{ fontSize: '12px', fontWeight: 800, color: s.color }}>{s.value}/100</span>
                        </div>
                        <div style={{ height: '4px', borderRadius: '9999px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                          <div style={{ height: '100%', borderRadius: '9999px', width: `${s.value}%`, background: s.color, transition: 'width 0.6s ease' }} />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Trigger Hook */}
                  <div style={{
                    padding: '14px', borderRadius: '12px',
                    background: 'rgba(244,63,94,0.06)', border: '1px solid rgba(244,63,94,0.18)',
                  }}>
                    <p style={{ fontSize: '10px', fontWeight: 800, color: '#FB7185', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '8px' }}>
                      Trigger Hook
                    </p>
                    <p style={{ fontSize: '12px', color: 'var(--text-3)', lineHeight: 1.5 }}>
                      {draft.triggerHook}
                    </p>
                  </div>

                  {/* AI Rationale */}
                  <div style={{
                    padding: '14px', borderRadius: '12px',
                    background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                  }}>
                    <p style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-5)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '8px' }}>
                      AI Rationale
                    </p>
                    <p style={{ fontSize: '12px', color: 'var(--text-4)', lineHeight: 1.5 }}>
                      {draft.aiRationale}
                    </p>
                  </div>

                  {/* Action buttons */}
                  {status === 'pending' && (
                    <div style={{ display: 'flex', gap: '8px', marginTop: 'auto' }}>
                      <button
                        onClick={() => reject(draft.id)}
                        style={{
                          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                          padding: '10px', borderRadius: '10px',
                          background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.25)',
                          color: '#F87171', fontSize: '13px', fontWeight: 700,
                          cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s ease',
                        }}
                      >
                        <X style={{ width: '14px', height: '14px' }} /> Reject
                      </button>
                      <button
                        onClick={() => approve(draft.id)}
                        style={{
                          flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                          padding: '10px', borderRadius: '10px',
                          background: 'var(--blue)', border: 'none',
                          color: 'white', fontSize: '13px', fontWeight: 700,
                          cursor: 'pointer', fontFamily: 'inherit',
                          boxShadow: '0 2px 10px rgba(59,130,246,0.25)',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <Check style={{ width: '14px', height: '14px' }} /> Approve & Dispatch
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
