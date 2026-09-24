import { DEMO_STATS, DEMO_COMPANIES, DEMO_MEETINGS, DEMO_DEALS, DEMO_ACTIVITIES } from '@/lib/demo-data'
import { intentColor, formatCurrency, timeAgo, dealHealthColor, scoreColor } from '@/lib/utils'
import {
  TrendingUp, Users, Mail, Calendar, DollarSign, Target,
  Flame, AlertTriangle, Clock, Zap, ArrowRight, CheckCircle2,
  Building2, Bot
} from 'lucide-react'

const statCards = [
  { label: 'Leads Generated',    value: DEMO_STATS.leadsGenerated,  delta: '+12',  icon: Target,     color: 'brand' },
  { label: 'Qualified Leads',    value: DEMO_STATS.qualifiedLeads,  delta: '+5',   icon: Users,      color: 'success' },
  { label: 'Outreach Sent',      value: DEMO_STATS.outreachSent,    delta: '+18',  icon: Mail,       color: 'accent' },
  { label: 'Meetings Booked',    value: DEMO_STATS.meetings,        delta: '+3',   icon: Calendar,   color: 'warning' },
  { label: 'Pipeline Value',     value: formatCurrency(DEMO_STATS.pipelineValue), delta: '+₹24L', icon: DollarSign, color: 'success', isString: true },
  { label: 'Response Rate',      value: `${DEMO_STATS.responseRate}%`, delta: '+2.1%', icon: TrendingUp, color: 'brand', isString: true },
]

const top5Actions = [
  { icon: Flame,        label: 'Follow up with BrowserStack before the 2pm meeting',              priority: 'URGENT', href: '/meetings' },
  { icon: Mail,         label: 'Review 3 outreach drafts pending approval in Approval Inbox',      priority: 'HIGH',   href: '/approvals' },
  { icon: AlertTriangle, label: 'Sprinklr deal at risk — competitor shortlisted, act today',       priority: 'HIGH',   href: '/pipeline' },
  { icon: Zap,          label: 'Spendflo proposal follow-up — sent 3 days ago, no response',       priority: 'MEDIUM', href: '/follow-ups' },
  { icon: Target,       label: 'Freshworks — last contacted 8 days ago, send value-add message',   priority: 'MEDIUM', href: '/companies/co_3' },
]

function PriorityBadge({ priority }: { priority: string }) {
  const map: Record<string, string> = {
    URGENT: 'bg-[var(--color-danger)]/15 text-[var(--color-danger)] border-[var(--color-danger)]/20',
    HIGH:   'bg-[var(--color-warning)]/15 text-[var(--color-warning)] border-[var(--color-warning)]/20',
    MEDIUM: 'bg-[var(--color-brand)]/15 text-[var(--color-brand-light)] border-[var(--color-brand)]/20',
  }
  return (
    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wide ${map[priority] ?? ''}`}>
      {priority}
    </span>
  )
}

export default function DashboardPage() {
  const hotCompanies = DEMO_COMPANIES.filter(c => c.intentStatus === 'HOT').slice(0, 4)
  const atRiskDeals  = DEMO_DEALS.filter(d => d.health === 'AT_RISK' || d.health === 'NEEDS_ATTENTION')
  const todayMeetings = DEMO_MEETINGS

  return (
    <div className="space-y-6 max-w-[1400px]">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-[var(--color-text-1)]">Good morning! 👋</h2>
          <p className="text-sm text-[var(--color-text-3)] mt-0.5">
            Here's your AI daily brief — {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--color-brand-glow)] border border-[var(--color-brand)]/20">
          <Bot className="w-4 h-4 text-[var(--color-brand-light)]" />
          <span className="text-xs font-medium text-[var(--color-brand-light)]">AI Copilot Active</span>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {statCards.map((s) => (
          <div key={s.label} className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-4 hover:border-[var(--color-border-2)] transition-colors">
            <div className="flex items-center justify-between mb-3">
              <div className="w-8 h-8 rounded-lg bg-[var(--color-bg-3)] flex items-center justify-center">
                <s.icon className="w-4 h-4 text-[var(--color-text-3)]" />
              </div>
              <span className="text-[11px] font-semibold text-[var(--color-success)]">{s.delta}</span>
            </div>
            <p className="text-xl font-bold text-[var(--color-text-1)]">{s.value}</p>
            <p className="text-[11px] text-[var(--color-text-3)] mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* Top 5 Actions */}
        <div className="xl:col-span-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)]">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-[var(--color-brand-light)]" />
              <h3 className="font-semibold text-[var(--color-text-1)]">Top 5 Actions for Today</h3>
            </div>
            <span className="text-xs text-[var(--color-text-4)] bg-[var(--color-bg-3)] px-2 py-1 rounded-md">AI Generated</span>
          </div>
          <ul className="divide-y divide-[var(--color-border)]">
            {top5Actions.map((a, i) => (
              <li key={i} className="flex items-center gap-4 px-5 py-3.5 hover:bg-[var(--color-bg-3)] transition-colors group cursor-pointer">
                <span className="w-6 h-6 rounded-full bg-[var(--color-bg-3)] flex items-center justify-center text-[11px] font-bold text-[var(--color-text-4)] flex-shrink-0">
                  {i + 1}
                </span>
                <a.icon className="w-4 h-4 text-[var(--color-text-4)] flex-shrink-0" />
                <p className="flex-1 text-sm text-[var(--color-text-2)] group-hover:text-[var(--color-text-1)] transition-colors">
                  {a.label}
                </p>
                <PriorityBadge priority={a.priority} />
                <ArrowRight className="w-3.5 h-3.5 text-[var(--color-text-4)] opacity-0 group-hover:opacity-100 transition-opacity" />
              </li>
            ))}
          </ul>
        </div>

        {/* Today's Meetings */}
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-[var(--color-border)]">
            <Calendar className="w-4 h-4 text-[var(--color-brand-light)]" />
            <h3 className="font-semibold text-[var(--color-text-1)]">Today's Meetings</h3>
            <span className="ml-auto bg-[var(--color-brand)] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{todayMeetings.length}</span>
          </div>
          <div className="p-4 space-y-3">
            {todayMeetings.map((mtg) => {
              const company = DEMO_COMPANIES.find(c => c.id === mtg.companyId)
              const time = new Date(mtg.scheduledAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
              return (
                <div key={mtg.id} className="p-3 rounded-lg bg-[var(--color-bg-3)] border border-[var(--color-border)] hover:border-[var(--color-border-2)] transition-colors cursor-pointer">
                  <div className="flex items-start gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-[var(--color-brand-glow)] border border-[var(--color-brand)]/20 flex items-center justify-center flex-shrink-0">
                      <Building2 className="w-3.5 h-3.5 text-[var(--color-brand-light)]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-[var(--color-text-1)] truncate">{company?.name}</p>
                      <p className="text-[11px] text-[var(--color-text-3)] truncate mt-0.5">{mtg.title}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <Clock className="w-3 h-3 text-[var(--color-text-4)]" />
                        <span className="text-[11px] text-[var(--color-text-4)]">{time} · {mtg.duration}min</span>
                      </div>
                    </div>
                  </div>
                  <a href={mtg.meetLink} className="flex items-center gap-1 mt-2 text-[11px] text-[var(--color-brand-light)] hover:underline">
                    <CheckCircle2 className="w-3 h-3" />
                    Join Google Meet
                  </a>
                </div>
              )
            })}
            {todayMeetings.length === 0 && (
              <p className="text-sm text-[var(--color-text-4)] text-center py-4">No meetings today</p>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

        {/* High-Intent Leads */}
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)]">
            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4 text-[var(--color-hot)]" />
              <h3 className="font-semibold text-[var(--color-text-1)]">High-Intent Leads</h3>
            </div>
            <a href="/leads" className="text-xs text-[var(--color-brand-light)] hover:underline">View all</a>
          </div>
          <div className="divide-y divide-[var(--color-border)]">
            {hotCompanies.map((c) => {
              const colors = intentColor(c.intentStatus)
              return (
                <div key={c.id} className="flex items-center gap-4 px-5 py-3 hover:bg-[var(--color-bg-3)] transition-colors cursor-pointer group">
                  <div className="w-8 h-8 rounded-lg bg-[var(--color-bg-3)] border border-[var(--color-border)] flex items-center justify-center text-xs font-bold text-[var(--color-text-3)] flex-shrink-0">
                    {c.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--color-text-1)] truncate">{c.name}</p>
                    <p className="text-[11px] text-[var(--color-text-3)]">{c.industry} · {c.city}</p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${colors.bg} ${colors.text} ${colors.border}`}>
                      {c.intentStatus}
                    </span>
                    <span className={`text-sm font-bold ${scoreColor(c.leadScore)}`}>{c.leadScore}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* At-Risk Deals */}
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)]">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-[var(--color-warning)]" />
              <h3 className="font-semibold text-[var(--color-text-1)]">Deals Needing Attention</h3>
            </div>
            <a href="/pipeline" className="text-xs text-[var(--color-brand-light)] hover:underline">View pipeline</a>
          </div>
          <div className="divide-y divide-[var(--color-border)]">
            {atRiskDeals.map((d) => {
              const company = DEMO_COMPANIES.find(c => c.id === d.companyId)
              return (
                <div key={d.id} className="px-5 py-3 hover:bg-[var(--color-bg-3)] transition-colors cursor-pointer">
                  <div className="flex items-center gap-3 mb-1">
                    <p className="text-sm font-medium text-[var(--color-text-1)] flex-1 truncate">{d.name}</p>
                    <span className={`text-[11px] font-bold ${dealHealthColor(d.health)}`}>{d.health.replace('_', ' ')}</span>
                  </div>
                  {d.healthReason && (
                    <p className="text-[11px] text-[var(--color-text-4)] mb-1.5">{d.healthReason}</p>
                  )}
                  <div className="flex items-center gap-2">
                    <Zap className="w-3 h-3 text-[var(--color-brand-light)]" />
                    <p className="text-[11px] text-[var(--color-text-3)]">{d.nextBestAction}</p>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[11px] text-[var(--color-text-4)]">{company?.name}</span>
                    <span className="text-[11px] font-semibold text-[var(--color-text-2)]">{formatCurrency(d.value ?? 0)}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-[var(--color-border)]">
          <TrendingUp className="w-4 h-4 text-[var(--color-brand-light)]" />
          <h3 className="font-semibold text-[var(--color-text-1)]">Recent Activity</h3>
        </div>
        <ul className="divide-y divide-[var(--color-border)]">
          {DEMO_ACTIVITIES.slice(0, 6).map((a) => {
            const company = DEMO_COMPANIES.find(c => c.id === a.companyId)
            return (
              <li key={a.id} className="flex items-start gap-4 px-5 py-3 hover:bg-[var(--color-bg-3)] transition-colors">
                <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-brand)] mt-2 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[var(--color-text-2)]">{a.description}</p>
                  <div className="flex items-center gap-2 mt-1">
                    {company && <span className="text-[11px] text-[var(--color-brand-light)]">{company.name}</span>}
                    <span className="text-[11px] text-[var(--color-text-4)]">·</span>
                    <span className="text-[11px] text-[var(--color-text-4)]">{a.source === 'AI' ? '🤖 AI' : '👤 User'}</span>
                    <span className="text-[11px] text-[var(--color-text-4)]">· {timeAgo(a.createdAt)}</span>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
