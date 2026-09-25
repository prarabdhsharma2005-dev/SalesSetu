'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Bot, Target, Search, Building2, Users,
  Mail, CheckSquare, Bell, Calendar, KanbanSquare, BarChart3,
  CalendarDays, Plug, Settings, Zap, ChevronLeft, ChevronRight,
  Sparkles, ArrowUpRight,
} from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'

const groups = [
  {
    label: 'CORE PLATFORM',
    items: [
      { label: 'Executive Cockpit',     href: '/dashboard', icon: LayoutDashboard },
      { label: 'Autonomous SDR Agent',  href: '/agent',     icon: Bot, ai: true },
    ],
  },
  {
    label: 'PROSPECTING',
    items: [
      { label: 'Lead Discovery',      href: '/leads',     icon: Search },
      { label: 'ICP Rulebook',        href: '/icp',       icon: Target },
      { label: 'Company Intelligence',href: '/companies', icon: Building2 },
      { label: 'Decision Makers',     href: '/contacts',  icon: Users },
    ],
  },
  {
    label: 'SALES EXECUTION',
    items: [
      { label: 'Outreach Studio',       href: '/outreach',   icon: Mail,         ai: true },
      { label: 'Human Approvals',       href: '/approvals',  icon: CheckSquare,  badge: 3 },
      { label: 'Follow-Up Cadence',     href: '/follow-ups', icon: Bell,         badge: 5 },
      { label: 'Meetings & MoM',        href: '/meetings',   icon: Calendar },
    ],
  },
  {
    label: 'PIPELINE & GROWTH',
    items: [
      { label: 'Deal Pipeline',        href: '/pipeline',      icon: KanbanSquare },
      { label: 'Revenue Analytics',    href: '/analytics',     icon: BarChart3 },
      { label: 'Sales Calendar',       href: '/calendar',      icon: CalendarDays },
      { label: 'Integrations',         href: '/integrations',  icon: Plug },
      { label: 'Settings',             href: '/settings',      icon: Settings },
    ],
  },
]

export function Sidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside
      style={{
        background: 'var(--bg-card)',
        borderRight: '1px solid var(--border)',
        transition: 'width 0.25s cubic-bezier(0.4,0,0.2,1)',
        width: collapsed ? '72px' : '280px',
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        overflow: 'hidden',
      }}
    >
      {/* ── Logo ─────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: collapsed ? '20px 20px' : '20px 20px',
          borderBottom: '1px solid var(--border)',
          height: '76px',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, var(--blue) 0%, var(--purple) 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            boxShadow: '0 4px 16px rgba(59,130,246,0.30)',
          }}
        >
          <Zap style={{ width: '18px', height: '18px', color: 'white' }} />
        </div>
        {!collapsed && (
          <div style={{ overflow: 'hidden', flex: 1 }}>
            <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-0.02em', lineHeight: 1 }}>
              SalesSetu
            </div>
            <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-4)', marginTop: '3px', letterSpacing: '0.02em' }}>
              AI Sales Operating System
            </div>
          </div>
        )}
      </div>

      {/* ── Nav ──────────────────────────────────── */}
      <nav style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {groups.map((group) => (
          <div key={group.label} style={{ marginBottom: '4px' }}>
            {!collapsed && (
              <div style={{
                fontSize: '10px', fontWeight: 700, color: 'var(--text-5)',
                letterSpacing: '0.10em', textTransform: 'uppercase',
                padding: '8px 10px 4px',
              }}>
                {group.label}
              </div>
            )}
            {collapsed && <div style={{ height: '12px' }} />}
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '1px' }}>
              {group.items.map((item) => {
                const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      title={collapsed ? item.label : undefined}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: collapsed ? '9px 17px' : '9px 10px',
                        borderRadius: '8px',
                        textDecoration: 'none',
                        position: 'relative',
                        transition: 'all 0.15s ease',
                        background: isActive
                          ? 'rgba(59, 130, 246, 0.12)'
                          : 'transparent',
                        border: isActive
                          ? '1px solid rgba(59, 130, 246, 0.20)'
                          : '1px solid transparent',
                      }}
                      className={cn('group sidebar-item', isActive ? 'active' : '')}
                    >
                      <item.icon
                        style={{
                          width: '16px',
                          height: '16px',
                          flexShrink: 0,
                          color: isActive ? 'var(--blue-light)' : 'var(--text-4)',
                          transition: 'color 0.15s ease',
                        }}
                      />
                      {!collapsed && (
                        <>
                          <span
                            style={{
                              fontSize: '13px',
                              fontWeight: isActive ? 600 : 500,
                              color: isActive ? 'var(--text-1)' : 'var(--text-3)',
                              flex: 1,
                              transition: 'color 0.15s ease',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {item.label}
                          </span>
                          {/* AI badge */}
                          {(item as { ai?: boolean }).ai && (
                            <span style={{
                              fontSize: '9px', fontWeight: 700, color: 'var(--purple-light)',
                              background: 'var(--purple-subtle)', border: '1px solid rgba(139,92,246,0.25)',
                              padding: '1px 5px', borderRadius: '4px', letterSpacing: '0.04em',
                            }}>
                              AI
                            </span>
                          )}
                          {/* Notification badge */}
                          {(item as { badge?: number }).badge && (
                            <span style={{
                              background: 'var(--blue)', color: 'white',
                              fontSize: '10px', fontWeight: 700,
                              padding: '1px 6px', borderRadius: '10px',
                              minWidth: '20px', textAlign: 'center',
                            }}>
                              {(item as { badge?: number }).badge}
                            </span>
                          )}
                        </>
                      )}
                      {/* Collapsed badge */}
                      {collapsed && (item as { badge?: number }).badge && (
                        <span style={{
                          position: 'absolute', top: '4px', right: '4px',
                          background: 'var(--blue)', color: 'white',
                          fontSize: '9px', fontWeight: 700,
                          width: '16px', height: '16px',
                          borderRadius: '50%', display: 'flex',
                          alignItems: 'center', justifyContent: 'center',
                        }}>
                          {(item as { badge?: number }).badge}
                        </span>
                      )}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* ── Demo Status ──────────────────────────── */}
      {!collapsed && (
        <div style={{
          margin: '0 10px 10px',
          padding: '10px 12px',
          borderRadius: '10px',
          background: 'rgba(245,158,11,0.08)',
          border: '1px solid rgba(245,158,11,0.20)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--warm)' }} className="pulse-dot" />
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--warm)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Demo Mode
            </span>
          </div>
          <p style={{ fontSize: '11px', color: 'var(--text-4)', lineHeight: '1.5' }}>
            30 Indian B2B companies loaded
          </p>
        </div>
      )}

      {/* ── User Footer ──────────────────────────── */}
      <div
        style={{
          borderTop: '1px solid var(--border)',
          padding: collapsed ? '12px 18px' : '12px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: '34px',
            height: '34px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--blue) 0%, var(--purple) 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '13px',
            fontWeight: 800,
            color: 'white',
            flexShrink: 0,
          }}
        >
          P
        </div>
        {!collapsed && (
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              Prarabdh Sharma
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-4)' }}>
              Founder & Owner
            </div>
          </div>
        )}
        {!collapsed && (
          <button
            onClick={() => setCollapsed(true)}
            style={{
              width: '28px', height: '28px', borderRadius: '7px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'transparent', border: '1px solid var(--border)',
              cursor: 'pointer', color: 'var(--text-4)',
              transition: 'all 0.15s ease', flexShrink: 0,
            }}
          >
            <ChevronLeft style={{ width: '14px', height: '14px' }} />
          </button>
        )}
        {collapsed && (
          <button
            onClick={() => setCollapsed(false)}
            style={{ position: 'absolute', bottom: '14px', left: '18px', zIndex: 10, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-4)', display: 'none' }}
          >
            <ChevronRight style={{ width: '14px', height: '14px' }} />
          </button>
        )}
      </div>

      {/* Collapsed expand button */}
      {collapsed && (
        <button
          onClick={() => setCollapsed(false)}
          style={{
            position: 'absolute',
            bottom: '14px',
            left: '18px',
            width: '28px',
            height: '28px',
            borderRadius: '7px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            cursor: 'pointer',
            color: 'var(--text-4)',
            transition: 'all 0.15s ease',
          }}
        >
          <ChevronRight style={{ width: '14px', height: '14px' }} />
        </button>
      )}

      <style>{`
        .sidebar-item:hover:not(.active) {
          background: rgba(255, 255, 255, 0.04) !important;
          border-color: rgba(255, 255, 255, 0.06) !important;
        }
        .sidebar-item:hover:not(.active) svg {
          color: var(--text-2) !important;
        }
        .sidebar-item:hover:not(.active) span {
          color: var(--text-2) !important;
        }
      `}</style>
    </aside>
  )
}
