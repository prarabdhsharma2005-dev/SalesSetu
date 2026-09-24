'use client'

import { useState } from 'react'
import { DEMO_COMPANIES, DEMO_CONTACTS, DEMO_INTENT_SIGNALS } from '@/lib/demo-data'
import { intentColor, scoreColor, formatNumber, timeAgo } from '@/lib/utils'
import {
  Search, Filter, SlidersHorizontal, Flame, TrendingUp, Globe,
  Building2, Users, Zap, ArrowRight, Star, ChevronDown, ChevronUp,
  MapPin, Globe2, Briefcase, RefreshCw
} from 'lucide-react'

const INDUSTRIES = ['All', 'SaaS', 'FinTech', 'EdTech', 'HealthTech', 'E-commerce', 'Manufacturing', 'Logistics', 'InsurTech']
const CITIES     = ['All', 'Bangalore', 'Mumbai', 'Chennai', 'Hyderabad', 'Pune', 'Delhi', 'Gurgaon', 'Faridabad', 'Coimbatore']
const INTENTS    = ['All', 'HOT', 'WARM', 'COLD', 'INACTIVE']
const SIZES      = ['All', '1-50', '51-200', '201-500', '501-2000', '2000+']

function IntentBadge({ status }: { status: string }) {
  const c = intentColor(status)
  const icons: Record<string, React.ReactNode> = {
    HOT: <Flame className="w-3 h-3" />,
    WARM: <TrendingUp className="w-3 h-3" />,
    COLD: <Globe className="w-3 h-3" />,
    INACTIVE: <RefreshCw className="w-3 h-3" />,
  }
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full border ${c.bg} ${c.text} ${c.border}`}>
      {icons[status]}
      {status}
    </span>
  )
}

function ScoreBar({ score, label }: { score: number; label: string }) {
  const color = score >= 80 ? 'bg-green-500' : score >= 60 ? 'bg-indigo-500' : score >= 40 ? 'bg-amber-500' : 'bg-red-500'
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-[var(--color-text-4)] w-16 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-[var(--color-bg-3)] rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${score}%` }} />
      </div>
      <span className={`text-xs font-bold w-6 text-right ${scoreColor(score)}`}>{score}</span>
    </div>
  )
}

export default function LeadsPage() {
  const [search, setSearch]       = useState('')
  const [industry, setIndustry]   = useState('All')
  const [city, setCity]           = useState('All')
  const [intent, setIntent]       = useState('All')
  const [expanded, setExpanded]   = useState<string | null>(null)
  const [isSearching, setIsSearching] = useState(false)

  const filtered = DEMO_COMPANIES.filter((c) => {
    if (search && !c.name.toLowerCase().includes(search.toLowerCase()) && !c.industry.toLowerCase().includes(search.toLowerCase())) return false
    if (industry !== 'All' && c.industry !== industry) return false
    if (city !== 'All' && c.city !== city) return false
    if (intent !== 'All' && c.intentStatus !== intent) return false
    return true
  })

  function handleSearch() {
    setIsSearching(true)
    setTimeout(() => setIsSearching(false), 1200)
  }

  return (
    <div className="space-y-5 max-w-[1400px]">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-[var(--color-text-1)]">Lead Discovery</h2>
          <p className="text-sm text-[var(--color-text-3)] mt-0.5">Find and score high-intent leads with AI</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-[var(--color-text-4)] bg-[var(--color-surface)] border border-[var(--color-border)] px-3 py-1.5 rounded-lg">
          <span className="w-2 h-2 rounded-full bg-[var(--color-warm)] animate-pulse" />
          Demo Mode · {DEMO_COMPANIES.length} companies loaded
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-4">
        <div className="flex gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-4)]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder='e.g. "AI sales automation for Indian SaaS companies"'
              className="w-full pl-10 pr-4 py-2.5 bg-[var(--color-bg-3)] border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-1)] placeholder-[var(--color-text-4)] focus:outline-none focus:border-[var(--color-brand)] transition-all"
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
          </div>
          <button
            onClick={handleSearch}
            className="flex items-center gap-2 px-4 py-2.5 bg-[var(--color-brand)] hover:bg-[var(--color-brand-dark)] text-white text-sm font-semibold rounded-lg transition-colors"
          >
            <Zap className="w-4 h-4" />
            {isSearching ? 'Searching...' : 'AI Search'}
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          {/* Industry */}
          <div className="flex items-center gap-1">
            <Briefcase className="w-3.5 h-3.5 text-[var(--color-text-4)]" />
            <select
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              className="text-xs bg-[var(--color-bg-3)] border border-[var(--color-border)] text-[var(--color-text-2)] rounded-md px-2 py-1.5 focus:outline-none focus:border-[var(--color-brand)]"
            >
              {INDUSTRIES.map(i => <option key={i}>{i}</option>)}
            </select>
          </div>
          {/* City */}
          <div className="flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5 text-[var(--color-text-4)]" />
            <select
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="text-xs bg-[var(--color-bg-3)] border border-[var(--color-border)] text-[var(--color-text-2)] rounded-md px-2 py-1.5 focus:outline-none focus:border-[var(--color-brand)]"
            >
              {CITIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          {/* Intent */}
          <div className="flex items-center gap-1">
            <Flame className="w-3.5 h-3.5 text-[var(--color-text-4)]" />
            <select
              value={intent}
              onChange={(e) => setIntent(e.target.value)}
              className="text-xs bg-[var(--color-bg-3)] border border-[var(--color-border)] text-[var(--color-text-2)] rounded-md px-2 py-1.5 focus:outline-none focus:border-[var(--color-brand)]"
            >
              {INTENTS.map(i => <option key={i}>{i}</option>)}
            </select>
          </div>
          <div className="ml-auto text-xs text-[var(--color-text-4)]">
            {filtered.length} results
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="space-y-2">
        {filtered.map((company) => {
          const contacts = DEMO_CONTACTS.filter(c => c.companyId === company.id)
          const signals  = DEMO_INTENT_SIGNALS.filter(s => s.companyId === company.id)
          const isExpanded = expanded === company.id

          return (
            <div
              key={company.id}
              className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl overflow-hidden hover:border-[var(--color-border-2)] transition-all"
            >
              {/* Row */}
              <div
                className="flex items-center gap-4 p-4 cursor-pointer"
                onClick={() => setExpanded(isExpanded ? null : company.id)}
              >
                {/* Logo placeholder */}
                <div className="w-10 h-10 rounded-xl bg-[var(--color-bg-3)] border border-[var(--color-border)] flex items-center justify-center text-sm font-bold text-[var(--color-text-3)] flex-shrink-0">
                  {company.name.charAt(0)}
                </div>

                {/* Company Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-[var(--color-text-1)]">{company.name}</p>
                    <IntentBadge status={company.intentStatus} />
                  </div>
                  <p className="text-xs text-[var(--color-text-3)] mt-0.5">
                    {company.industry} · {company.city}, {company.state} ·{' '}
                    {company.employeeCount ? formatNumber(company.employeeCount) + ' employees' : '—'} ·{' '}
                    {company.fundingStage}
                  </p>
                </div>

                {/* Scores */}
                <div className="hidden md:flex flex-col gap-1 w-40">
                  <ScoreBar score={company.leadScore}    label="Lead" />
                  <ScoreBar score={company.whyNowScore}  label="Why Now" />
                </div>

                {/* POC count */}
                <div className="hidden lg:flex items-center gap-1.5 w-24">
                  <Users className="w-3.5 h-3.5 text-[var(--color-text-4)]" />
                  <span className="text-xs text-[var(--color-text-3)]">{contacts.length} POC{contacts.length !== 1 ? 's' : ''}</span>
                </div>

                {/* CTA */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <a
                    href={`/companies/${company.id}`}
                    className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-[var(--color-brand)] hover:bg-[var(--color-brand-dark)] text-white text-xs font-semibold rounded-lg transition-colors"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Research <ArrowRight className="w-3 h-3" />
                  </a>
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-[var(--color-text-4)]" /> : <ChevronDown className="w-4 h-4 text-[var(--color-text-4)]" />}
                </div>
              </div>

              {/* Expanded Panel */}
              {isExpanded && (
                <div className="border-t border-[var(--color-border)] bg-[var(--color-bg-3)] p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Description */}
                  <div>
                    <p className="text-[11px] font-semibold text-[var(--color-text-4)] uppercase tracking-wider mb-2">About</p>
                    <p className="text-xs text-[var(--color-text-2)]">{company.description}</p>
                    {company.recentDevelopments && (
                      <>
                        <p className="text-[11px] font-semibold text-[var(--color-text-4)] uppercase tracking-wider mt-3 mb-1">Recent Developments</p>
                        <p className="text-xs text-[var(--color-text-2)]">{company.recentDevelopments}</p>
                      </>
                    )}
                  </div>

                  {/* Intent Signals */}
                  <div>
                    <p className="text-[11px] font-semibold text-[var(--color-text-4)] uppercase tracking-wider mb-2">Intent Signals</p>
                    {signals.length > 0 ? (
                      <ul className="space-y-2">
                        {signals.map(s => (
                          <li key={s.id} className="flex items-start gap-2">
                            <span className="w-2 h-2 rounded-full bg-[var(--color-hot)] mt-1.5 flex-shrink-0" />
                            <div>
                              <p className="text-xs text-[var(--color-text-1)] font-medium">{s.signalType}</p>
                              <p className="text-[11px] text-[var(--color-text-3)]">{s.description}</p>
                              <p className="text-[10px] text-[var(--color-text-4)]">
                                🤖 AI inference · {s.source} · {Math.round(s.confidence * 100)}% confidence · {timeAgo(s.detectedDate)}
                              </p>
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-[var(--color-text-4)]">No active signals detected</p>
                    )}
                  </div>

                  {/* Key Contacts + Actions */}
                  <div>
                    <p className="text-[11px] font-semibold text-[var(--color-text-4)] uppercase tracking-wider mb-2">Key POCs</p>
                    {contacts.length > 0 ? (
                      <ul className="space-y-2 mb-3">
                        {contacts.slice(0, 2).map(ct => (
                          <li key={ct.id} className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-[var(--color-brand-glow)] border border-[var(--color-brand)]/20 flex items-center justify-center text-[10px] font-bold text-[var(--color-brand-light)]">
                              {ct.name.charAt(0)}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-medium text-[var(--color-text-1)] truncate">{ct.name}</p>
                              <p className="text-[10px] text-[var(--color-text-4)] truncate">{ct.role}</p>
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-[var(--color-text-4)] mb-3">No contacts identified yet</p>
                    )}
                    <div className="flex flex-col gap-1.5">
                      <a href={`/companies/${company.id}`}
                        className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-[var(--color-brand)] hover:bg-[var(--color-brand-dark)] text-white text-xs font-semibold rounded-lg transition-colors">
                        <Building2 className="w-3 h-3" /> View Full Profile
                      </a>
                      <button
                        className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-[var(--color-surface)] hover:bg-[var(--color-bg-3)] border border-[var(--color-border)] text-[var(--color-text-2)] text-xs font-medium rounded-lg transition-colors">
                        <Zap className="w-3 h-3 text-[var(--color-brand-light)]" /> Generate Outreach
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}

        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl">
            <Search className="w-8 h-8 text-[var(--color-text-4)] mb-3" />
            <p className="text-sm font-medium text-[var(--color-text-2)]">No companies match your filters</p>
            <p className="text-xs text-[var(--color-text-4)] mt-1">Try adjusting industry, city, or intent filters</p>
          </div>
        )}
      </div>
    </div>
  )
}
