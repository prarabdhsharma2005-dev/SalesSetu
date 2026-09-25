'use client'

import { Search, Bell, Plus, Zap, ChevronDown, Command } from 'lucide-react'
import { useState } from 'react'
import { useBackendHealth } from '@/lib/use-backend'

export function TopBar() {
  const [searchFocused, setSearchFocused] = useState(false)
  const { data: health, isSuccess } = useBackendHealth()

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <header
      style={{
        height: '76px',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        gap: '24px',
        padding: '0 28px',
        background: 'rgba(9, 11, 16, 0.80)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderBottom: '1px solid var(--border)',
        position: 'sticky',
        top: 0,
        zIndex: 40,
      }}
    >
      {/* ── Greeting ────────────────────────────── */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <h1
          style={{
            fontSize: '20px',
            fontWeight: 800,
            color: 'var(--text-1)',
            letterSpacing: '-0.025em',
            lineHeight: 1.1,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {greeting}, Prarabdh 👋
        </h1>
        <p style={{ fontSize: '12px', color: 'var(--text-4)', marginTop: '2px', fontWeight: 500 }}>
          {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* ── Global Command Search ────────────────── */}
      <div style={{ flexShrink: 0, width: '340px', position: 'relative' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: searchFocused ? 'var(--bg-elevated)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${searchFocused ? 'var(--border-focus)' : 'var(--border)'}`,
            borderRadius: '10px',
            padding: '0 12px',
            height: '40px',
            transition: 'all 0.2s ease',
            boxShadow: searchFocused ? '0 0 0 3px rgba(59,130,246,0.10)' : 'none',
          }}
        >
          <Search style={{ width: '15px', height: '15px', color: 'var(--text-4)', flexShrink: 0 }} />
          <input
            type="text"
            placeholder="Search companies, deals, contacts..."
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              fontSize: '13px',
              color: 'var(--text-2)',
              fontFamily: 'inherit',
            }}
          />
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '2px',
              padding: '2px 6px',
              borderRadius: '5px',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.08)',
              flexShrink: 0,
            }}
          >
            <Command style={{ width: '10px', height: '10px', color: 'var(--text-5)' }} />
            <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-5)' }}>K</span>
          </div>
        </div>
      </div>

      {/* ── Backend Live Sync Indicator ──────────── */}
      <div
        title={isSuccess ? `Backend online (${health?.service || 'SalesSetu API'})` : 'Operating with local seed cache'}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '7px',
          padding: '7px 13px',
          borderRadius: '9px',
          background: isSuccess ? 'rgba(16,185,129,0.10)' : 'rgba(59,130,246,0.10)',
          border: `1px solid ${isSuccess ? 'rgba(16,185,129,0.25)' : 'rgba(59,130,246,0.22)'}`,
          flexShrink: 0,
          cursor: 'default',
        }}
      >
        <div
          style={{
            width: '7px',
            height: '7px',
            borderRadius: '50%',
            background: isSuccess ? '#10B981' : '#3B82F6',
          }}
          className="pulse-dot"
        />
        <Zap style={{ width: '13px', height: '13px', color: isSuccess ? '#10B981' : 'var(--blue-light)' }} />
        <span style={{ fontSize: '12px', fontWeight: 600, color: isSuccess ? '#34D399' : 'var(--blue-light)', whiteSpace: 'nowrap' }}>
          {isSuccess ? 'Backend Connected · Live' : 'Autonomous SDR · Active'}
        </span>
      </div>

      {/* ── Actions ──────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
        {/* Notification Bell */}
        <button
          style={{
            width: '40px', height: '40px', borderRadius: '10px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'transparent',
            border: '1px solid var(--border)',
            cursor: 'pointer',
            color: 'var(--text-3)',
            position: 'relative',
            transition: 'all 0.15s ease',
          }}
          className="top-bar-btn"
        >
          <Bell style={{ width: '16px', height: '16px' }} />
          <span style={{
            position: 'absolute', top: '8px', right: '8px',
            width: '7px', height: '7px',
            background: 'var(--blue)', borderRadius: '50%',
            border: '1.5px solid var(--bg-canvas)',
          }} />
        </button>

        {/* New Prospect CTA */}
        <button
          style={{
            display: 'flex', alignItems: 'center', gap: '7px',
            padding: '0 16px', height: '40px',
            background: 'var(--blue)',
            border: 'none',
            borderRadius: '10px',
            cursor: 'pointer',
            color: 'white',
            fontSize: '13px',
            fontWeight: 700,
            fontFamily: 'inherit',
            transition: 'all 0.15s ease',
            boxShadow: '0 4px 16px rgba(59,130,246,0.30)',
          }}
          className="top-bar-cta"
        >
          <Plus style={{ width: '15px', height: '15px' }} />
          New Prospect
        </button>
      </div>

      <style>{`
        .top-bar-btn:hover {
          background: rgba(255,255,255,0.06) !important;
          border-color: var(--border-strong) !important;
          color: var(--text-1) !important;
        }
        .top-bar-cta:hover {
          background: var(--blue-dark) !important;
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(59,130,246,0.40) !important;
        }
        .top-bar-cta:active { transform: translateY(0); }
      `}</style>
    </header>
  )
}
