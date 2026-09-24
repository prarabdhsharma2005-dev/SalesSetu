'use client'

import { Search, Bell, Plus, ChevronDown } from 'lucide-react'

interface TopBarProps {
  title: string
  subtitle?: string
}

export function TopBar({ title, subtitle }: TopBarProps) {
  return (
    <header className="flex items-center gap-4 h-16 px-6 border-b border-[var(--color-border)] bg-[var(--color-bg-2)]/50 backdrop-blur-sm flex-shrink-0">
      {/* Title */}
      <div className="flex-1">
        <h1 className="text-base font-semibold text-[var(--color-text-1)]">{title}</h1>
        {subtitle && <p className="text-xs text-[var(--color-text-3)]">{subtitle}</p>}
      </div>

      {/* Search */}
      <div className="relative hidden md:block">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--color-text-4)]" />
        <input
          type="text"
          placeholder="Search companies, contacts, deals..."
          className="w-72 pl-9 pr-4 py-2 text-xs bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-2)] placeholder-[var(--color-text-4)] focus:outline-none focus:border-[var(--color-brand)] focus:ring-1 focus:ring-[var(--color-brand)]/30 transition-all"
        />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {/* Notifications */}
        <button className="relative w-8 h-8 rounded-lg flex items-center justify-center text-[var(--color-text-3)] hover:text-[var(--color-text-1)] hover:bg-[var(--color-surface)] transition-colors">
          <Bell className="w-4 h-4" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-[var(--color-brand)] rounded-full"></span>
        </button>

        {/* New button */}
        <button className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--color-brand)] hover:bg-[var(--color-brand-dark)] text-white text-xs font-semibold rounded-lg transition-colors">
          <Plus className="w-3.5 h-3.5" />
          New
        </button>

        {/* User avatar */}
        <button className="flex items-center gap-2 pl-2 pr-1 py-1 rounded-lg hover:bg-[var(--color-surface)] transition-colors">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[var(--color-brand)] to-[var(--color-accent-2)] flex items-center justify-center text-white text-xs font-bold">
            D
          </div>
          <ChevronDown className="w-3 h-3 text-[var(--color-text-4)]" />
        </button>
      </div>
    </header>
  )
}
