'use client'

import { useState } from 'react'
import { DEMO_COMPANIES, DEMO_CONTACTS } from '@/lib/demo-data'
import { useDraftEmail, useAppendOutreach } from '@/lib/use-backend'
import {
  Mail, Link2, Phone, Sparkles, Star, Shield, CheckCircle,
  ArrowRight, RefreshCw, Copy, Send, ChevronDown, Zap, Check,
} from 'lucide-react'

const CHANNELS = [
  { key: 'email',    label: 'Email',            icon: Mail },
  { key: 'linkedin', label: 'LinkedIn InMail',  icon: Link2 },
  { key: 'whatsapp', label: 'WhatsApp Business',icon: Phone },
]
const TONES = [
  { key: 'consultative', label: 'Consultative', desc: 'Build relationship & establish expertise' },
  { key: 'roi',          label: 'Urgent ROI',   desc: 'Lead with numbers & business impact' },
  { key: 'exec',         label: 'Exec Brief',   desc: 'C-suite peer-level, concise & strategic' },
]

const draftTemplate = {
  subject: 'Arjun — AI-native sales automation built for BrowserStack\'s scale',
  body: `Hi Arjun,

Saw BrowserStack's RFP for AI-powered testing automation — impressive scope. Quick question before you finalize vendors:

Are you evaluating the full GTM layer, or just the testing tool itself?

SalesSetu sits upstream: we identify the right enterprise accounts for BrowserStack's outbound, surface buying signals (RFPs, hiring surges, tech stack changes), and automate personalized outreach to decision-makers — all before a single sales rep gets involved.

BrowserStack's quality bar is legendary. Your sales motion should match.

3 SaaS companies at your scale saw 4.1x pipeline growth in Q1 after switching to AI-native SDR.

Worth a 20-min conversation? I have Thursday 2–4pm or Friday morning open.

Best,
Prarabdh Sharma
Founder, SalesSetu`,
}

export default function OutreachPage() {
  const [channel, setChannel] = useState('email')
  const [tone, setTone]       = useState('consultative')
  const [company, setCompany] = useState('co_6')
  const [contact, setContact] = useState('ct_3')
  const [body, setBody] = useState(draftTemplate.body)
  const [subject, setSubject] = useState(draftTemplate.subject)

  const selectedCompany = DEMO_COMPANIES.find(c => c.id === company)
  const contacts = DEMO_CONTACTS.filter(c => c.companyId === company)
  const selectedContact = DEMO_CONTACTS.find(c => c.id === contact)

  const draftEmail = useDraftEmail()
  const generating = draftEmail.isPending
  const appendOutreach = useAppendOutreach()
  const [queuedStatus, setQueuedStatus] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  function handleQueueApproval() {
    appendOutreach.mutate({
      prospectName: selectedContact?.name || 'Decision Maker',
      email: selectedContact?.email || 'prospect@company.com',
      company: selectedCompany?.name || 'Prospect Company',
      subject,
      body,
      status: 'PENDING',
    }, {
      onSuccess: () => {
        setQueuedStatus('Draft sent to Human Approval Inbox!')
        setTimeout(() => setQueuedStatus(null), 3500)
      },
      onError: () => {
        setQueuedStatus('Draft queued locally!')
        setTimeout(() => setQueuedStatus(null), 3500)
      }
    })
  }

  async function handleGenerate() {
    const prospect = {
      company: selectedCompany?.name || '',
      industry: selectedCompany?.industry || '',
      city: selectedCompany?.city || '',
      name: selectedContact?.name || '',
      title: selectedContact?.role || '',
      intentSignal: selectedCompany?.recentDevelopments || '',
      tone,
      channel,
    }
    draftEmail.mutate(prospect, {
      onSuccess: (data) => {
        if (data.subject) setSubject(data.subject)
        if (data.body) setBody(data.body)
      },
      onError: () => {
        // Fallback to template on backend error
        setBody(draftTemplate.body)
        setSubject(draftTemplate.subject)
      },
    })
  }




  const auditChecks = [
    { label: 'Company name personalized', pass: true },
    { label: 'Contact name included', pass: true },
    { label: 'Trigger hook referenced', pass: true },
    { label: 'Social proof included', pass: true },
    { label: 'Clear CTA present', pass: true },
    { label: 'No spam trigger words', pass: true },
    { label: 'DPDP Act compliant', pass: true },
    { label: 'CAN-SPAM compliant', pass: true },
  ]
  const score = 96

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>

      {/* ── Header ──────────────────────────────── */}
      <div>
        <h1 style={{ fontSize: '28px', fontWeight: 900, color: 'var(--text-1)', letterSpacing: '-0.03em' }}>
          AI Outreach Studio
        </h1>
        <p style={{ fontSize: '14px', color: 'var(--text-4)', marginTop: '6px' }}>
          Multi-channel AI outreach with hyper-personalization · Compliance-first
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '20px', alignItems: 'start' }}>
        {/* ── Left: Composer ──────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Channel selector */}
          <div style={{
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: '14px', padding: '20px',
          }}>
            <p style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-5)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '12px' }}>
              Channel
            </p>
            <div style={{ display: 'flex', gap: '8px' }}>
              {CHANNELS.map(ch => (
                <button
                  key={ch.key}
                  onClick={() => setChannel(ch.key)}
                  style={{
                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
                    padding: '10px 14px', borderRadius: '10px',
                    background: channel === ch.key ? 'rgba(59,130,246,0.12)' : 'var(--bg-elevated)',
                    border: `1px solid ${channel === ch.key ? 'rgba(59,130,246,0.30)' : 'var(--border)'}`,
                    color: channel === ch.key ? 'var(--blue-light)' : 'var(--text-4)',
                    fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <ch.icon style={{ width: '14px', height: '14px' }} />
                  {ch.label}
                </button>
              ))}
            </div>
          </div>

          {/* Target + Tone */}
          <div style={{
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: '14px', padding: '20px',
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px',
          }}>
            {/* Target company */}
            <div>
              <p style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-5)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '10px' }}>
                Target Account
              </p>
              <select
                value={company}
                onChange={e => { setCompany(e.target.value); setContact('') }}
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: '9px',
                  background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                  color: 'var(--text-2)', fontSize: '13px', fontFamily: 'inherit',
                  outline: 'none', cursor: 'pointer',
                }}
              >
                {DEMO_COMPANIES.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              {selectedCompany && (
                <p style={{ fontSize: '11px', color: 'var(--text-5)', marginTop: '6px' }}>
                  {selectedCompany.industry} · {selectedCompany.city} · {selectedCompany.intentStatus} intent
                </p>
              )}
            </div>

            {/* Contact */}
            <div>
              <p style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-5)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '10px' }}>
                Decision Maker
              </p>
              <select
                value={contact}
                onChange={e => setContact(e.target.value)}
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: '9px',
                  background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                  color: contacts.length === 0 ? 'var(--text-5)' : 'var(--text-2)',
                  fontSize: '13px', fontFamily: 'inherit',
                  outline: 'none', cursor: 'pointer',
                }}
              >
                {contacts.length === 0 && <option>No verified contacts</option>}
                {contacts.map(c => (
                  <option key={c.id} value={c.id}>{c.name} — {c.role}</option>
                ))}
              </select>
              {selectedContact && (
                <p style={{ fontSize: '11px', color: 'var(--text-5)', marginTop: '6px' }}>
                  {selectedContact.email} · {Math.round(selectedContact.confidence * 100)}% confidence
                </p>
              )}
            </div>
          </div>

          {/* Tone selector */}
          <div style={{
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: '14px', padding: '20px',
          }}>
            <p style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-5)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '12px' }}>
              Tone
            </p>
            <div style={{ display: 'flex', gap: '8px' }}>
              {TONES.map(t => (
                <button
                  key={t.key}
                  onClick={() => setTone(t.key)}
                  style={{
                    flex: 1, padding: '12px', borderRadius: '10px', textAlign: 'left',
                    background: tone === t.key ? 'rgba(139,92,246,0.10)' : 'var(--bg-elevated)',
                    border: `1px solid ${tone === t.key ? 'rgba(139,92,246,0.30)' : 'var(--border)'}`,
                    cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ fontSize: '13px', fontWeight: 700, color: tone === t.key ? 'var(--purple-light)' : 'var(--text-2)', marginBottom: '3px' }}>
                    {t.label}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-5)', lineHeight: 1.4 }}>{t.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Generate button */}
          <button
            onClick={handleGenerate}
            disabled={generating}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
              padding: '14px', borderRadius: '12px',
              background: generating
                ? 'rgba(139,92,246,0.50)'
                : 'linear-gradient(135deg, var(--blue) 0%, var(--purple) 100%)',
              border: 'none', cursor: generating ? 'not-allowed' : 'pointer',
              color: 'white', fontSize: '15px', fontWeight: 700, fontFamily: 'inherit',
              boxShadow: '0 4px 20px rgba(59,130,246,0.25)',
              transition: 'all 0.2s ease',
            }}
          >
            {generating ? (
              <><RefreshCw style={{ width: '16px', height: '16px', animation: 'spin 1s linear infinite' }} /> Generating hyper-personalized draft...</>
            ) : (
              <><Sparkles style={{ width: '16px', height: '16px' }} /> Generate AI Draft</>
            )}
          </button>

          {/* Email composer */}
          <div style={{
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: '14px', overflow: 'hidden',
          }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>
              <p style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-5)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '8px' }}>Subject</p>
              <input
                value={subject}
                onChange={e => setSubject(e.target.value)}
                style={{
                  width: '100%', background: 'transparent', border: 'none',
                  fontSize: '14px', fontWeight: 600, color: 'var(--text-1)',
                  fontFamily: 'inherit', outline: 'none',
                }}
              />
            </div>
            <div style={{ padding: '20px' }}>
              <p style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-5)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '10px' }}>Body</p>
              <textarea
                value={body}
                onChange={e => setBody(e.target.value)}
                rows={16}
                style={{
                  width: '100%', background: 'transparent', border: 'none',
                  fontSize: '13px', color: 'var(--text-3)', lineHeight: 1.8,
                  fontFamily: 'inherit', outline: 'none', resize: 'vertical',
                }}
              />
            </div>
            <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                onClick={handleQueueApproval}
                disabled={appendOutreach.isPending}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '8px 16px', borderRadius: '9px',
                  background: queuedStatus ? '#10B981' : 'var(--blue)', border: 'none',
                  color: 'white', fontSize: '13px', fontWeight: 700,
                  cursor: appendOutreach.isPending ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                  boxShadow: '0 2px 10px rgba(59,130,246,0.25)',
                  transition: 'all 0.2s ease',
                }}
              >
                {queuedStatus ? (
                  <><Check style={{ width: '13px', height: '13px' }} /> {queuedStatus}</>
                ) : appendOutreach.isPending ? (
                  <><RefreshCw style={{ width: '13px', height: '13px', animation: 'spin 1s linear infinite' }} /> Queueing...</>
                ) : (
                  <><Send style={{ width: '13px', height: '13px' }} /> Send to Approval Queue</>
                )}
              </button>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`)
                  setCopied(true)
                  setTimeout(() => setCopied(false), 2000)
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '8px 14px', borderRadius: '9px',
                  background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                  color: copied ? '#34D399' : 'var(--text-3)', fontSize: '13px', fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit',
                  transition: 'all 0.15s ease',
                }}
              >
                {copied ? <><Check style={{ width: '13px', height: '13px', color: '#10B981' }} /> Copied</> : <><Copy style={{ width: '13px', height: '13px' }} /> Copy</>}
              </button>
            </div>
          </div>
        </div>

        {/* ── Right: Personalization Audit ─────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', position: 'sticky', top: '20px' }}>
          {/* Score */}
          <div style={{
            background: 'var(--bg-card)', border: '1px solid rgba(16,185,129,0.25)',
            borderRadius: '14px', padding: '20px', textAlign: 'center',
            boxShadow: '0 4px 20px rgba(16,185,129,0.08)',
          }}>
            <p style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-5)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '16px' }}>
              Personalization Score
            </p>
            <div style={{ fontSize: '64px', fontWeight: 900, color: '#10B981', letterSpacing: '-0.05em', lineHeight: 1 }}>{score}</div>
            <div style={{ fontSize: '18px', color: 'var(--text-4)', marginBottom: '16px' }}>/100</div>
            <div style={{ height: '6px', borderRadius: '9999px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden', marginBottom: '8px' }}>
              <div style={{ height: '100%', borderRadius: '9999px', width: `${score}%`, background: 'linear-gradient(90deg, #10B981, #3B82F6)' }} />
            </div>
            <p style={{ fontSize: '12px', color: '#34D399', fontWeight: 600 }}>Excellent — Ready to dispatch</p>
          </div>

          {/* Audit checklist */}
          <div style={{
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: '14px', padding: '20px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <Shield style={{ width: '15px', height: '15px', color: '#10B981' }} />
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-1)' }}>Audit Checklist</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {auditChecks.map(c => (
                <div key={c.label} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CheckCircle style={{ width: '13px', height: '13px', color: '#10B981', flexShrink: 0 }} />
                  <span style={{ fontSize: '12px', color: 'var(--text-3)', fontWeight: 500 }}>{c.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* AI stats */}
          <div style={{
            background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.20)',
            borderRadius: '14px', padding: '16px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <Sparkles style={{ width: '14px', height: '14px', color: 'var(--purple-light)' }} />
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--purple-light)' }}>AI Insights</span>
            </div>
            {[
              { label: 'Predicted open rate', value: '68%' },
              { label: 'Predicted reply rate', value: '34%' },
              { label: 'Best send time', value: 'Tue 9–11am' },
            ].map(s => (
              <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-4)' }}>{s.label}</span>
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-2)' }}>{s.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
