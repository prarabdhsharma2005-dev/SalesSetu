import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number, currency = 'INR') {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatNumber(n: number) {
  if (n >= 10_000_000) return `${(n / 10_000_000).toFixed(1)}Cr`
  if (n >= 100_000) return `${(n / 100_000).toFixed(1)}L`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
  return String(n)
}

export function timeAgo(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000)
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

export function intentColor(status: string) {
  switch (status?.toUpperCase()) {
    case 'HOT':      return { text: 'text-[var(--color-hot)]',  bg: 'bg-[var(--color-hot-bg)]',  border: 'border-[var(--color-hot)]/20' }
    case 'WARM':     return { text: 'text-[var(--color-warm)]', bg: 'bg-[var(--color-warm-bg)]', border: 'border-[var(--color-warm)]/20' }
    case 'COLD':     return { text: 'text-[var(--color-cold)]', bg: 'bg-[var(--color-cold-bg)]', border: 'border-[var(--color-cold)]/20' }
    case 'INACTIVE': return { text: 'text-[var(--color-text-4)]', bg: 'bg-[var(--color-inactive-bg)]', border: 'border-[var(--color-inactive)]/20' }
    default:         return { text: 'text-[var(--color-text-3)]', bg: 'bg-[var(--color-surface)]', border: 'border-[var(--color-border)]' }
  }
}

export function dealHealthColor(health: string) {
  switch (health?.toUpperCase()) {
    case 'HEALTHY':          return 'text-[var(--color-success)]'
    case 'NEEDS_ATTENTION':  return 'text-[var(--color-warning)]'
    case 'AT_RISK':          return 'text-[var(--color-danger)]'
    case 'STALE':            return 'text-[var(--color-text-4)]'
    default:                 return 'text-[var(--color-text-3)]'
  }
}

export function scoreColor(score: number) {
  if (score >= 80) return 'text-[var(--color-success)]'
  if (score >= 60) return 'text-[var(--color-brand-light)]'
  if (score >= 40) return 'text-[var(--color-warning)]'
  return 'text-[var(--color-danger)]'
}

export function truncate(str: string, n: number) {
  return str.length > n ? str.slice(0, n) + '…' : str
}
