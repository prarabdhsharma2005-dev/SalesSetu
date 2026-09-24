'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Bot,
  Target,
  Search,
  Building2,
  Users,
  Mail,
  CheckSquare,
  Bell,
  Calendar,
  KanbanSquare,
  BarChart3,
  CalendarDays,
  Plug,
  Settings,
  ChevronLeft,
  ChevronRight,
  Zap,
} from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'

const navItems = [
  { label: 'Dashboard',      href: '/dashboard',    icon: LayoutDashboard, group: 'main' },
  { label: 'AI Sales Agent', href: '/agent',        icon: Bot,             group: 'main' },
  { label: 'ICP Builder',    href: '/icp',          icon: Target,          group: 'discovery' },
  { label: 'Lead Discovery', href: '/leads',        icon: Search,          group: 'discovery' },
  { label: 'Companies',      href: '/companies',    icon: Building2,       group: 'discovery' },
  { label: 'Contacts',       href: '/contacts',     icon: Users,           group: 'discovery' },
  { label: 'Outreach',       href: '/outreach',     icon: Mail,            group: 'engage' },
  { label: 'Approval Inbox', href: '/approvals',    icon: CheckSquare,     group: 'engage', badge: 3 },
  { label: 'Follow-ups',     href: '/follow-ups',   icon: Bell,            group: 'engage', badge: 5 },
  { label: 'Meetings',       href: '/meetings',     icon: Calendar,        group: 'engage' },
  { label: 'Pipeline',       href: '/pipeline',     icon: KanbanSquare,    group: 'close' },
  { label: 'Analytics',      href: '/analytics',    icon: BarChart3,       group: 'close' },
  { label: 'Calendar',       href: '/calendar',     icon: CalendarDays,    group: 'close' },
  { label: 'Integrations',   href: '/integrations', icon: Plug,            group: 'settings' },
  { label: 'Settings',       href: '/settings',     icon: Settings,        group: 'settings' },
]

const groupLabels: Record<string, string> = {
  main:      'Overview',
  discovery: 'Discovery',
  engage:    'Engage',
  close:     'Close',
  settings:  'Settings',
}

export function Sidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  const groups = ['main', 'discovery', 'engage', 'close', 'settings']

  return (
    <aside
      className={cn(
        'flex flex-col h-screen bg-[var(--color-bg-2)] border-r border-[var(--color-border)] transition-all duration-300 flex-shrink-0',
        collapsed ? 'w-16' : 'w-60'
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-[var(--color-border)] h-16">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--color-brand)] to-[var(--color-accent-2)] flex items-center justify-center flex-shrink-0">
          <Zap className="w-4 h-4 text-white" />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <span className="font-bold text-[var(--color-text-1)] text-base leading-none">SalesSetu</span>
            <p className="text-[10px] text-[var(--color-text-3)] mt-0.5">AI Sales OS</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
        {groups.map((group) => {
          const items = navItems.filter((n) => n.group === group)
          return (
            <div key={group}>
              {!collapsed && (
                <p className="text-[10px] font-semibold text-[var(--color-text-4)] uppercase tracking-widest px-2 mb-1">
                  {groupLabels[group]}
                </p>
              )}
              <ul className="space-y-0.5">
                {items.map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={cn(
                          'flex items-center gap-3 px-2 py-2 rounded-lg text-sm font-medium transition-all duration-150 group relative',
                          isActive
                            ? 'bg-[var(--color-brand-glow)] text-[var(--color-brand-light)] border border-[var(--color-brand)]/20'
                            : 'text-[var(--color-text-3)] hover:text-[var(--color-text-1)] hover:bg-[var(--color-surface)]'
                        )}
                        title={collapsed ? item.label : undefined}
                      >
                        <item.icon
                          className={cn(
                            'w-4 h-4 flex-shrink-0 transition-colors',
                            isActive ? 'text-[var(--color-brand-light)]' : 'text-[var(--color-text-4)] group-hover:text-[var(--color-text-2)]'
                          )}
                        />
                        {!collapsed && (
                          <>
                            <span className="flex-1 truncate">{item.label}</span>
                            {item.badge && (
                              <span className="ml-auto bg-[var(--color-brand)] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                                {item.badge}
                              </span>
                            )}
                          </>
                        )}
                        {collapsed && item.badge && (
                          <span className="absolute -top-1 -right-1 bg-[var(--color-brand)] text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                            {item.badge}
                          </span>
                        )}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })}
      </nav>

      {/* Demo badge */}
      {!collapsed && (
        <div className="mx-3 mb-3 px-3 py-2 rounded-lg bg-[var(--color-warm-bg)] border border-[var(--color-warm)]/20">
          <p className="text-[10px] font-semibold text-[var(--color-warm)] uppercase tracking-wider">Demo Mode</p>
          <p className="text-[11px] text-[var(--color-text-3)] mt-0.5">Using simulated data</p>
        </div>
      )}

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center justify-center h-10 border-t border-[var(--color-border)] text-[var(--color-text-4)] hover:text-[var(--color-text-2)] hover:bg-[var(--color-surface)] transition-colors"
      >
        {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>
    </aside>
  )
}
