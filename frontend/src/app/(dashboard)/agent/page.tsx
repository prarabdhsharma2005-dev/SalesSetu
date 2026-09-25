'use client'

import { useState, useEffect } from 'react'
import { Bot, Zap, Activity, Shield, Settings, Play, Pause, RotateCcw, ChevronRight, Circle } from 'lucide-react'

const LOG_LINES = [
  { time: '06:00:01', type: 'INFO',    msg: 'Autonomous SDR sweep initiated — Daily cycle #127' },
  { time: '06:00:03', type: 'AI',      msg: 'ICP rulebook loaded — SaaS/FinTech, Bangalore+Mumbai, Series A-D' },
  { time: '06:00:08', type: 'SUCCESS', msg: 'MCA company registry: 1,847 companies matched initial ICP filter' },
  { time: '06:00:14', type: 'AI',      msg: 'LinkedIn hiring signal detected — Spendflo posting 3 SDR roles' },
  { time: '06:00:22', type: 'SUCCESS', msg: 'BrowserStack intent spike — RFP published, lead score elevated to 94/100' },
  { time: '06:00:31', type: 'INFO',    msg: 'SMTP validation: arjun.kapoor@browserstack.com → DELIVERABLE (95% confidence)' },
  { time: '06:00:45', type: 'AI',      msg: 'GPT-4o drafting email for Arjun Kapoor — tone: Executive Brief, context: RFP hook' },
  { time: '06:00:52', type: 'SUCCESS', msg: 'Draft scored 96/100 personalization — queued for human review' },
  { time: '06:01:03', type: 'INFO',    msg: 'Scanning Tracxn for funding rounds — NimbleEdge Series A confirmed $8M' },
  { time: '06:01:11', type: 'AI',      msg: 'Generating contextual outreach for Vishal Mehta (NimbleEdge CEO)' },
  { time: '06:01:18', type: 'SUCCESS', msg: '3 email drafts queued in Approval Inbox — awaiting human review' },
  { time: '06:01:25', type: 'INFO',    msg: 'Rate limiting: 47/50 emails queued today. Pausing outbound queue.' },
  { time: '06:01:30', type: 'WARNING', msg: 'Sprinklr deal stall detected — 6 days no activity. Alerting owner.' },
  { time: '06:01:35', type: 'AI',      msg: 'Intent refresh: 12 companies re-scored. 3 upgraded to HOT status.' },
  { time: '06:01:42', type: 'SUCCESS', msg: 'Sweep complete — Next cycle in 4h. Dashboard updated.' },
]

const STATS = [
  { label: 'Companies Scanned', value: '1,847', color: '#3B82F6' },
  { label: 'Intent Updates', value: '12',    color: '#8B5CF6' },
  { label: 'Drafts Generated', value: '3',     color: '#10B981' },
  { label: 'Outbound Today', value: '47/50',  color: '#F59E0B' },
]

const MODELS = [
  { key: 'gpt4o',   label: 'GPT-4o (OpenAI)',       desc: 'Best for complex personalization · $0.015/1K tokens' },
  { key: 'claude',  label: 'Claude 3.5 Sonnet',      desc: 'Best for long-form emails · $0.003/1K tokens' },
  { key: 'gemini',  label: 'Gemini 1.5 Pro',         desc: 'Best for multilingual · $0.002/1K tokens' },
]

export default function AgentPage() {
  const [running, setRunning]     = useState(true)
  const [model, setModel]         = useState('gpt4o')
  const [visibleLines, setVisible] = useState(5)

  useEffect(() => {
    if (!running) return
    const interval = setInterval(() => {
      setVisible(v => Math.min(v + 1, LOG_LINES.length))
    }, 800)
    return () => clearInterval(interval)
  }, [running])

  function lineColor(type: string) {
    if (type === 'SUCCESS') return '#34D399'
    if (type === 'AI')      return '#A78BFA'
    if (type === 'WARNING') return '#FBBF24'
    if (type === 'ERROR')   return '#F87171'
    return '#6B7280'
  }
  function linePrefix(type: string) {
    if (type === 'SUCCESS') return '✓'
    if (type === 'AI')      return '🤖'
    if (type === 'WARNING') return '⚠'
    if (type === 'ERROR')   return '✗'
    return '›'
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>

      {/* ── Header ──────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 900, color: 'var(--text-1)', letterSpacing: '-0.03em' }}>
            Autonomous SDR Control Room
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--text-4)', marginTop: '6px' }}>
            AI-powered outbound engine · Live sweep monitoring · Model routing
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '8px 16px', borderRadius: '10px',
            background: running ? 'rgba(16,185,129,0.10)' : 'rgba(239,68,68,0.10)',
            border: `1px solid ${running ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`,
          }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: running ? '#10B981' : '#EF4444' }} className={running ? 'pulse-dot' : ''} />
            <span style={{ fontSize: '13px', fontWeight: 700, color: running ? '#34D399' : '#F87171' }}>
              {running ? 'Agent Running' : 'Agent Paused'}
            </span>
          </div>
          <button
            onClick={() => setRunning(!running)}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '8px 16px', borderRadius: '10px',
              background: running ? 'rgba(245,158,11,0.12)' : 'var(--blue)',
              border: running ? '1px solid rgba(245,158,11,0.25)' : 'none',
              color: running ? '#FBBF24' : 'white',
              fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            {running ? <><Pause style={{ width: '13px', height: '13px' }} /> Pause</> : <><Play style={{ width: '13px', height: '13px' }} /> Resume</>}
          </button>
        </div>
      </div>

      {/* ── Stats ───────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '14px' }}>
        {STATS.map(s => (
          <div key={s.label} style={{
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: '12px', padding: '18px',
          }}>
            <div style={{ fontSize: '28px', fontWeight: 900, color: s.color, letterSpacing: '-0.04em', lineHeight: 1, marginBottom: '6px' }}>
              {s.value}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-4)', fontWeight: 500 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '20px', alignItems: 'start' }}>
        {/* ── Terminal Log ─────────────────────── */}
        <div style={{
          background: '#0A0C0F', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '14px', overflow: 'hidden',
          boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
        }}>
          {/* Terminal title bar */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '12px 16px', background: '#111318',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}>
            <div style={{ display: 'flex', gap: '6px' }}>
              {['#F87171', '#FBBF24', '#34D399'].map(c => (
                <div key={c} style={{ width: '10px', height: '10px', borderRadius: '50%', background: c, opacity: 0.8 }} />
              ))}
            </div>
            <div style={{ flex: 1, textAlign: 'center', fontSize: '12px', fontWeight: 600, color: '#6B7280', fontFamily: 'monospace' }}>
              salessetu-agent — sweep #127
            </div>
            <button
              onClick={() => setVisible(5)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <RotateCcw style={{ width: '12px', height: '12px' }} />
            </button>
          </div>

          {/* Log content */}
          <div style={{ padding: '20px', minHeight: '400px', fontFamily: 'monospace', fontSize: '13px', lineHeight: 2 }}>
            {LOG_LINES.slice(0, visibleLines).map((line, i) => (
              <div
                key={i}
                style={{
                  display: 'flex', gap: '12px',
                  opacity: i < visibleLines - 1 ? 1 : 0.9,
                  animation: i === visibleLines - 1 ? 'fade-in-up 0.3s ease-out' : 'none',
                }}
              >
                <span style={{ color: '#374151', flexShrink: 0 }}>{line.time}</span>
                <span style={{ color: lineColor(line.type), flexShrink: 0, width: '16px' }}>{linePrefix(line.type)}</span>
                <span style={{ color: lineColor(line.type) === '#6B7280' ? '#9CA3AF' : lineColor(line.type) }}>
                  {line.msg}
                </span>
              </div>
            ))}
            {running && visibleLines < LOG_LINES.length && (
              <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
                <span style={{ color: '#374151' }}>now</span>
                <span style={{ color: '#3B82F6' }}>›</span>
                <span style={{ color: '#6B7280' }}>
                  Processing<span className="cursor-blink">_</span>
                </span>
              </div>
            )}
            {visibleLines >= LOG_LINES.length && (
              <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
                <span style={{ color: '#374151' }}>06:01:42</span>
                <span style={{ color: '#34D399' }}>✓</span>
                <span style={{ color: '#34D399' }}>Sweep complete. Idle<span className="cursor-blink">_</span></span>
              </div>
            )}
          </div>
        </div>

        {/* ── Right Panel ──────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

          {/* Daily limits */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '14px', padding: '18px' }}>
            <p style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-5)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '14px' }}>
              Daily Outbound Limits
            </p>
            {[
              { label: 'Emails', used: 47, max: 50, color: '#F59E0B' },
              { label: 'LinkedIn', used: 18, max: 25, color: '#3B82F6' },
              { label: 'WhatsApp', used: 5, max: 20, color: '#10B981' },
            ].map(l => (
              <div key={l.label} style={{ marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-3)', fontWeight: 500 }}>{l.label}</span>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: l.used >= l.max * 0.9 ? '#FBBF24' : 'var(--text-3)' }}>
                    {l.used}/{l.max}
                  </span>
                </div>
                <div style={{ height: '5px', borderRadius: '9999px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: '9999px', width: `${(l.used / l.max) * 100}%`, background: l.color, transition: 'width 0.6s ease' }} />
                </div>
              </div>
            ))}
          </div>

          {/* Model routing */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '14px', padding: '18px' }}>
            <p style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-5)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '14px' }}>
              AI Model Routing
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {MODELS.map(m => (
                <button
                  key={m.key}
                  onClick={() => setModel(m.key)}
                  style={{
                    padding: '12px', borderRadius: '10px', textAlign: 'left',
                    background: model === m.key ? 'rgba(139,92,246,0.10)' : 'var(--bg-elevated)',
                    border: `1px solid ${model === m.key ? 'rgba(139,92,246,0.30)' : 'var(--border)'}`,
                    cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: model === m.key ? 'var(--purple-light)' : 'var(--text-5)', flexShrink: 0 }} />
                    <span style={{ fontSize: '12px', fontWeight: 700, color: model === m.key ? 'var(--purple-light)' : 'var(--text-2)' }}>{m.label}</span>
                  </div>
                  <p style={{ fontSize: '11px', color: 'var(--text-5)', lineHeight: 1.4, paddingLeft: '16px' }}>{m.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Next sweep */}
          <div style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.20)', borderRadius: '14px', padding: '16px' }}>
            <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--blue-light)', marginBottom: '4px' }}>
              Next Autonomous Sweep
            </p>
            <p style={{ fontSize: '22px', fontWeight: 900, color: 'var(--text-1)', letterSpacing: '-0.03em' }}>
              10:00 AM
            </p>
            <p style={{ fontSize: '11px', color: 'var(--text-5)', marginTop: '4px' }}>
              ~3h 58m from now · Cycle #128
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
