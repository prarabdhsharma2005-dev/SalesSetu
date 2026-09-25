'use client'

import { useState } from 'react'
import { DEMO_CONTACTS, DEMO_COMPANIES } from '@/lib/demo-data'
import { Users, CheckCircle, Mail, MapPin, Building2, Search, Star, Sparkles, ArrowUpRight } from 'lucide-react'

const SENIORITY_ORDER = ['C-Suite', 'VP', 'Director', 'Senior Manager', 'Manager']

function SeniorityBadge({ level }: { level: string }) {
  const cfg: Record<string, { bg: string; text: string }> = {
    'C-Suite':       { bg: 'rgba(244,63,94,0.12)',  text: '#FB7185' },
    'VP':            { bg: 'rgba(139,92,246,0.12)', text: '#A78BFA' },
    'Director':      { bg: 'rgba(59,130,246,0.12)', text: '#60A5FA' },
    'Senior Manager':{ bg: 'rgba(16,185,129,0.12)', text: '#34D399' },
    'Manager':       { bg: 'rgba(107,114,128,0.10)',text: '#9CA3AF' },
  }
  const c = cfg[level] ?? cfg['Manager']
  return (
    <span style={{
      fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '6px',
      background: c.bg, color: c.text,
    }}>
      {level}
    </span>
  )
}

export default function ContactsPage() {
  const [search, setSearch]     = useState('')
  const [seniority, setSeniority] = useState('All')

  const filtered = DEMO_CONTACTS.filter(ct => {
    if (search && !ct.name.toLowerCase().includes(search.toLowerCase()) &&
        !ct.role.toLowerCase().includes(search.toLowerCase())) return false
    if (seniority !== 'All' && ct.seniority !== seniority) return false
    return true
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>

      {/* ── Header ──────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 900, color: 'var(--text-1)', letterSpacing: '-0.03em' }}>
            Decision Maker Intelligence
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--text-4)', marginTop: '6px' }}>
            Verified POCs with email confidence scores and relevance context
          </p>
        </div>
        <div style={{
          padding: '8px 14px', borderRadius: '10px',
          background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.20)',
          fontSize: '13px', fontWeight: 600, color: 'var(--blue-light)',
        }}>
          {DEMO_CONTACTS.length} verified contacts
        </div>
      </div>

      {/* ── Search + Filters ────────────────────── */}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', width: '15px', height: '15px', color: 'var(--text-4)' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or role..."
            style={{
              width: '100%', paddingLeft: '42px', paddingRight: '16px', height: '44px',
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: '11px', color: 'var(--text-1)', fontSize: '14px',
              fontFamily: 'inherit', outline: 'none',
            }}
          />
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          {['All', ...SENIORITY_ORDER].map(s => (
            <button key={s} onClick={() => setSeniority(s)} style={{
              padding: '6px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s ease',
              background: seniority === s ? 'var(--blue)' : 'var(--bg-card)',
              color: seniority === s ? 'white' : 'var(--text-4)',
              border: seniority === s ? '1px solid var(--blue)' : '1px solid var(--border)',
            }}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* ── Contact Grid ────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '14px' }}>
        {filtered.map(ct => {
          const company = DEMO_COMPANIES.find(c => c.id === ct.companyId)
          const conf = Math.round(ct.confidence * 100)

          return (
            <div
              key={ct.id}
              style={{
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: '14px', padding: '20px',
                transition: 'all 0.2s ease',
              }}
              className="contact-card"
            >
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '14px' }}>
                <div style={{
                  width: '44px', height: '44px', borderRadius: '50%', flexShrink: 0,
                  background: 'linear-gradient(135deg, var(--blue) 0%, var(--purple) 100%)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '16px', fontWeight: 800, color: 'white',
                }}>
                  {ct.name.charAt(0)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '3px' }}>
                    <p style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-1)' }}>{ct.name}</p>
                    {ct.emailVerified && <CheckCircle style={{ width: '14px', height: '14px', color: '#10B981', flexShrink: 0 }} />}
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--text-4)', marginBottom: '6px' }}>{ct.role}</p>
                  <SeniorityBadge level={ct.seniority} />
                </div>
              </div>

              {/* Company */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '10px' }}>
                <Building2 style={{ width: '13px', height: '13px', color: 'var(--text-5)' }} />
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--blue-light)' }}>{company?.name}</span>
                <span style={{ fontSize: '11px', color: 'var(--text-5)' }}>· {company?.industry}</span>
              </div>

              {/* Email + Location */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Mail style={{ width: '12px', height: '12px', color: 'var(--text-5)' }} />
                  <span style={{ fontSize: '12px', color: 'var(--text-4)', fontFamily: 'monospace' }}>{ct.email}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <MapPin style={{ width: '12px', height: '12px', color: 'var(--text-5)' }} />
                  <span style={{ fontSize: '12px', color: 'var(--text-4)' }}>{ct.location}</span>
                </div>
              </div>

              {/* Confidence bar */}
              <div style={{ marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-5)' }}>Email confidence</span>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: conf >= 90 ? '#34D399' : '#FBBF24' }}>{conf}%</span>
                </div>
                <div style={{ height: '4px', borderRadius: '9999px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: '9999px', width: `${conf}%`, background: conf >= 90 ? '#10B981' : '#F59E0B', transition: 'width 0.6s ease' }} />
                </div>
              </div>

              {/* Relevance */}
              <div style={{ padding: '10px 12px', borderRadius: '9px', background: 'rgba(139,92,246,0.07)', border: '1px solid rgba(139,92,246,0.18)', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                  <Sparkles style={{ width: '12px', height: '12px', color: 'var(--purple-light)', flexShrink: 0, marginTop: '2px' }} />
                  <p style={{ fontSize: '11px', color: 'var(--text-4)', lineHeight: 1.5 }}>{ct.relevanceReason}</p>
                </div>
              </div>

              {/* CTA */}
              <button style={{
                width: '100%', padding: '9px', borderRadius: '9px',
                background: 'rgba(59,130,246,0.10)', border: '1px solid rgba(59,130,246,0.22)',
                color: 'var(--blue-light)', fontSize: '12px', fontWeight: 700,
                cursor: 'pointer', fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                transition: 'all 0.15s ease',
              }}>
                <Sparkles style={{ width: '12px', height: '12px' }} />
                Draft Personalized Outreach
              </button>
            </div>
          )
        })}
      </div>

      <style>{`
        .contact-card:hover {
          border-color: rgba(59,130,246,0.25) !important;
          transform: translateY(-2px);
          box-shadow: 0 8px 30px rgba(0,0,0,0.25) !important;
        }
      `}</style>
    </div>
  )
}
