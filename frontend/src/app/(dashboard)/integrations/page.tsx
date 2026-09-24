'use client'

import { useState } from 'react'
import { FileSpreadsheet, CheckCircle2, Copy, ExternalLink, ArrowRight, ShieldCheck, RefreshCw, Mail, Calendar, Video, MessageSquare } from 'lucide-react'

export default function IntegrationsPage() {
  const [webhookUrl, setWebhookUrl] = useState('')
  const [isSaved, setIsSaved] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleSave = () => {
    setIsSaved(true)
    setTimeout(() => setIsSaved(false), 3000)
  }

  const copyScriptHint = () => {
    navigator.clipboard.writeText('backend/google-apps-script.js')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <h2 className="text-2xl font-bold text-white tracking-tight">Integrations & Storage</h2>
        <p className="text-sm text-zinc-400 mt-1">
          SalesSetu is configured to use <strong className="text-emerald-400">Google Sheets as the primary datastore</strong>. No SQL database setup required.
        </p>
      </div>

      {/* Primary Datastore: Google Sheets */}
      <div className="bg-zinc-900 border border-emerald-500/30 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold text-white">Google Sheets Datastore</h3>
                <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Primary Storage
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                All Leads, Deals, Outreach, and Meeting Notes are stored and synchronized directly in your Google Sheet.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-950/80 text-emerald-300 border border-emerald-800/40">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Connected & Active
            </span>
          </div>
        </div>

        {/* Tab Mapping Overview */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-6">
          {[
            { name: 'Leads', desc: 'Enriched companies, scores, intent' },
            { name: 'Deals', desc: 'Pipeline stages, deal values, health' },
            { name: 'Meetings', desc: 'MoM, action items, sentiment' },
            { name: 'Outreach', desc: 'Email drafts, approvals, logs' },
          ].map((tab) => (
            <div key={tab.name} className="p-3.5 bg-zinc-950/60 border border-zinc-800 rounded-xl">
              <div className="flex items-center gap-1.5 text-sm font-medium text-zinc-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                Sheet Tab: <span className="text-emerald-400 font-mono">{tab.name}</span>
              </div>
              <p className="text-xs text-zinc-500 mt-1">{tab.desc}</p>
            </div>
          ))}
        </div>

        {/* Webhook Connection Input */}
        <div className="bg-zinc-950/80 border border-zinc-800 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
              Google Sheets Webhook URL (Optional 1-Click Sync)
            </label>
            <button
              onClick={copyScriptHint}
              className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition-colors"
            >
              <Copy className="w-3.5 h-3.5" />
              {copied ? 'Script Path Copied!' : 'View Webhook Script (backend/google-apps-script.js)'}
            </button>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://script.google.com/macros/s/.../exec"
              className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-emerald-500"
            />
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5"
            >
              {isSaved ? <CheckCircle2 className="w-4 h-4" /> : <RefreshCw className="w-4 h-4" />}
              {isSaved ? 'Saved' : 'Connect'}
            </button>
          </div>
          <p className="text-[11px] text-zinc-500">
            💡 Even without a webhook URL, SalesSetu operates using the local Google Sheets file cache in <code className="text-zinc-400">backend/data/sheets_store.json</code> so your leads and pipeline work out-of-the-box.
          </p>
        </div>
      </div>

      {/* Additional Integrations */}
      <div>
        <h3 className="text-base font-semibold text-white mb-3">Communication & Calendar Integrations</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              title: 'Gmail API',
              desc: 'Sync threads & dispatch 1-on-1 cold outreach',
              icon: Mail,
              color: 'text-red-400',
              status: 'Ready for OAuth',
            },
            {
              title: 'Google Calendar',
              desc: 'Book meetings & view scheduled demo calls',
              icon: Calendar,
              color: 'text-blue-400',
              status: 'Ready for OAuth',
            },
            {
              title: 'Google Meet',
              desc: 'Auto-join and transcribe sales calls',
              icon: Video,
              color: 'text-amber-400',
              status: 'Planned',
            },
            {
              title: 'Slack / Teams',
              desc: 'Get notified when hot leads open emails',
              icon: MessageSquare,
              color: 'text-purple-400',
              status: 'Planned',
            },
          ].map((item) => {
            const Icon = item.icon
            return (
              <div key={item.title} className="p-4 bg-zinc-900/60 border border-zinc-800 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <Icon className={`w-5 h-5 ${item.color}`} />
                  <span className="text-[10px] uppercase font-semibold text-zinc-500 bg-zinc-800/80 px-2 py-0.5 rounded">
                    {item.status}
                  </span>
                </div>
                <h4 className="text-sm font-semibold text-zinc-200">{item.title}</h4>
                <p className="text-xs text-zinc-500">{item.desc}</p>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
