'use client'

import { useState, useEffect } from 'react'
import { DEMO_COMPANIES } from '@/lib/demo-data'
import { Target, Plus, X, Sparkles, Building2, Users, DollarSign, TrendingUp, CheckCircle, Zap } from 'lucide-react'

const INDUSTRY_OPTIONS  = ['SaaS', 'FinTech', 'EdTech', 'HealthTech', 'E-commerce', 'Manufacturing', 'InsurTech', 'Logistics']
const CITY_OPTIONS      = ['Bangalore', 'Mumbai', 'Chennai', 'Hyderabad', 'Pune', 'Delhi', 'Gurgaon']
const STAGE_OPTIONS     = ['Series A', 'Series B', 'Series C', 'Series D', 'Series E+', 'Bootstrapped', 'Public']
const INTENT_OPTIONS    = ['HOT', 'WARM', 'COLD']

export default function IcpPage() {
  const [industries, setIndustries]   = useState<string[]>(['SaaS', 'FinTech'])
  const [cities, setCities]           = useState<string[]>(['Bangalore', 'Mumbai', 'Chennai'])
  const [stages, setStages]           = useState<string[]>(['Series A', 'Series B', 'Series C', 'Series D'])
  const [intents, setIntents]         = useState<string[]>(['HOT', 'WARM'])
  const [minEmp, setMinEmp]           = useState('100')
  const [maxEmp, setMaxEmp]           = useState('10000')
  const [minScore, setMinScore]       = useState('60')
  const [computing, setComputing]     = useState(false)
  const [computed, setComputed]       = useState(true)
  const [aiResult, setAiResult]       = useState<Record<string, unknown> | null>(null)
  const [aiError, setAiError]         = useState<string | null>(null)
  const [saved, setSaved]             = useState(false)

  useEffect(() => {
    try {
      const stored = localStorage.getItem('salesetu_icp_rulebook')
      if (stored) {
        const parsed = JSON.parse(stored)
        if (parsed.industries) setIndustries(parsed.industries)
        if (parsed.cities) setCities(parsed.cities)
        if (parsed.stages) setStages(parsed.stages)
        if (parsed.intents) setIntents(parsed.intents)
        if (parsed.minEmp) setMinEmp(parsed.minEmp)
        if (parsed.maxEmp) setMaxEmp(parsed.maxEmp)
        if (parsed.minScore) setMinScore(parsed.minScore)
        if (parsed.aiResult) setAiResult(parsed.aiResult)
      }
    } catch {
      // Ignore local storage error
    }
  }, [])

  function handleSaveRulebook() {
    const rulebook = {
      industries,
      cities,
      stages,
      intents,
      minEmp,
      maxEmp,
      minScore,
      aiResult,
      savedAt: new Date().toISOString(),
    }
    try {
      localStorage.setItem('salesetu_icp_rulebook', JSON.stringify(rulebook))
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e) {
      console.error('Failed to save ICP rulebook', e)
    }
  }

  function toggle<T>(arr: T[], val: T, set: (v: T[]) => void) {
    set(arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val])
  }

  const matchingCompanies = DEMO_COMPANIES.filter(c => {
    if (industries.length && !industries.includes(c.industry)) return false
    if (cities.length && !cities.includes(c.city)) return false
    if (intents.length && !intents.includes(c.intentStatus)) return false
    if (c.employeeCount < parseInt(minEmp || '0')) return false
    if (c.employeeCount > parseInt(maxEmp || '999999')) return false
    if (c.leadScore < parseInt(minScore || '0')) return false
    return true
  })

  async function compute() {
    setComputing(true)
    setAiError(null)
    const query = `${industries.join(', ')} companies in ${cities.join(', ')} with ${minEmp}-${maxEmp} employees, funding stage: ${stages.join(', ')}, min lead score ${minScore}`
    try {
      const base = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'
      const res = await fetch(`${base}/api/ai/icp-parse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      })
      if (res.ok) {
        const data = await res.json()
        setAiResult(data)
      }
    } catch {
      setAiError('AI service unavailable — showing local match results')
    } finally {
      setComputing(false)
      setComputed(true)
    }
  }

  const tam = matchingCompanies.length * 120
  const immediateIntent = matchingCompanies.filter(c => c.intentStatus === 'HOT').length
  const potentialPipeline = immediateIntent * 2200000

  function ChipSelector({ label, options, selected, onToggle }: {
    label: string; options: string[]; selected: string[]; onToggle: (v: string) => void
  }) {
    return (
      <div>
        <p style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-5)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '10px' }}>
          {label}
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {options.map(opt => (
            <button
              key={opt}
              onClick={() => onToggle(opt)}
              style={{
                padding: '5px 12px', borderRadius: '8px',
                fontSize: '12px', fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit',
                transition: 'all 0.15s ease',
                background: selected.includes(opt) ? 'rgba(59,130,246,0.15)' : 'var(--bg-elevated)',
                color: selected.includes(opt) ? 'var(--blue-light)' : 'var(--text-4)',
                border: selected.includes(opt) ? '1px solid rgba(59,130,246,0.35)' : '1px solid var(--border)',
              }}
            >
              {selected.includes(opt) && <CheckCircle style={{ width: '10px', height: '10px', display: 'inline', marginRight: '4px' }} />}
              {opt}
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>

      {/* ── Header ──────────────────────────────── */}
      <div>
        <h1 style={{ fontSize: '28px', fontWeight: 900, color: 'var(--text-1)', letterSpacing: '-0.03em' }}>
          ICP Rulebook Builder
        </h1>
        <p style={{ fontSize: '14px', color: 'var(--text-4)', marginTop: '6px' }}>
          Define your ideal customer profile · Real-time TAM estimator
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '20px', alignItems: 'start' }}>
        {/* ── Left: Criteria ──────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Industries */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '14px', padding: '22px' }}>
            <ChipSelector
              label="Target Industries"
              options={INDUSTRY_OPTIONS}
              selected={industries}
              onToggle={v => toggle(industries, v, setIndustries)}
            />
          </div>

          {/* Cities */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '14px', padding: '22px' }}>
            <ChipSelector
              label="Target Cities / Hubs"
              options={CITY_OPTIONS}
              selected={cities}
              onToggle={v => toggle(cities, v, setCities)}
            />
          </div>

          {/* Funding stage */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '14px', padding: '22px' }}>
            <ChipSelector
              label="Funding Stage"
              options={STAGE_OPTIONS}
              selected={stages}
              onToggle={v => toggle(stages, v, setStages)}
            />
          </div>

          {/* Intent signal priority */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '14px', padding: '22px' }}>
            <ChipSelector
              label="Intent Signal Priority"
              options={INTENT_OPTIONS}
              selected={intents}
              onToggle={v => toggle(intents, v, setIntents)}
            />
          </div>

          {/* Employee count + score range */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '14px', padding: '22px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px' }}>
            <div>
              <p style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-5)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '10px' }}>Min Employees</p>
              <input
                type="number"
                value={minEmp}
                onChange={e => setMinEmp(e.target.value)}
                style={{
                  width: '100%', padding: '9px 12px', borderRadius: '9px',
                  background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                  color: 'var(--text-2)', fontSize: '14px', fontFamily: 'inherit', outline: 'none',
                }}
              />
            </div>
            <div>
              <p style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-5)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '10px' }}>Max Employees</p>
              <input
                type="number"
                value={maxEmp}
                onChange={e => setMaxEmp(e.target.value)}
                style={{
                  width: '100%', padding: '9px 12px', borderRadius: '9px',
                  background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                  color: 'var(--text-2)', fontSize: '14px', fontFamily: 'inherit', outline: 'none',
                }}
              />
            </div>
            <div>
              <p style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-5)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '10px' }}>Min Lead Score</p>
              <input
                type="number"
                value={minScore}
                onChange={e => setMinScore(e.target.value)}
                min="0" max="100"
                style={{
                  width: '100%', padding: '9px 12px', borderRadius: '9px',
                  background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                  color: 'var(--text-2)', fontSize: '14px', fontFamily: 'inherit', outline: 'none',
                }}
              />
            </div>
          </div>

          <button
            onClick={compute}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
              padding: '14px', borderRadius: '12px',
              background: computing
                ? 'rgba(59,130,246,0.50)'
                : 'linear-gradient(135deg, var(--blue) 0%, var(--purple) 100%)',
              border: 'none', cursor: computing ? 'not-allowed' : 'pointer',
              color: 'white', fontSize: '15px', fontWeight: 700, fontFamily: 'inherit',
              boxShadow: '0 4px 20px rgba(59,130,246,0.25)',
            }}
          >
            {computing ? (
              <><Sparkles style={{ width: '16px', height: '16px' }} /> Computing TAM & AI Strategy...</>
            ) : (
              <><Zap style={{ width: '16px', height: '16px' }} /> Compute ICP & TAM</>
            )}
          </button>

          {/* AI Strategy & ICP Intelligence */}
          {aiResult && (
            <div style={{
              background: 'var(--bg-card)',
              border: '1px solid rgba(139,92,246,0.3)',
              borderRadius: '14px',
              padding: '22px',
              boxShadow: '0 4px 20px rgba(139,92,246,0.1)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                <Sparkles style={{ width: '18px', height: '18px', color: 'var(--purple-light)' }} />
                <h3 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--purple-light)', margin: 0 }}>
                  AI ICP Strategy & Recommendations
                </h3>
              </div>

              {Boolean((aiResult as any).strategyRecommendation) && (
                <div style={{ marginBottom: '16px' }}>
                  <p style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-5)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>
                    Strategy Recommendation
                  </p>
                  <p style={{ fontSize: '13px', color: 'var(--text-2)', lineHeight: 1.6, background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                    {String((aiResult as any).strategyRecommendation)}
                  </p>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                {Array.isArray((aiResult as any).buyerPersonas) && (aiResult as any).buyerPersonas.length > 0 && (
                  <div>
                    <p style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-5)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
                      Key Buyer Personas
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {(aiResult as any).buyerPersonas.map((p: string, i: number) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-3)' }}>
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--blue)' }} />
                          {p}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {Array.isArray((aiResult as any).painPoints) && (aiResult as any).painPoints.length > 0 && (
                  <div>
                    <p style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-5)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
                      Target Pain Points
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {(aiResult as any).painPoints.map((pt: string, i: number) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-3)' }}>
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#F43F5E' }} />
                          {pt}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Right: Live TAM Estimator ────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', position: 'sticky', top: '20px' }}>

          {/* TAM stats */}
          {[
            { label: 'Addressable Companies', value: String(tam), icon: Building2, accent: '#3B82F6', bg: 'rgba(59,130,246,0.10)', border: 'rgba(59,130,246,0.20)' },
            { label: 'Matching in Demo', value: String(matchingCompanies.length), icon: Users, accent: '#10B981', bg: 'rgba(16,185,129,0.10)', border: 'rgba(16,185,129,0.20)' },
            { label: 'Immediate Intent', value: String(immediateIntent), icon: TrendingUp, accent: '#F43F5E', bg: 'rgba(244,63,94,0.10)', border: 'rgba(244,63,94,0.20)' },
            { label: 'Potential Pipeline', value: `₹${(potentialPipeline / 10000000).toFixed(1)} Cr`, icon: DollarSign, accent: '#8B5CF6', bg: 'rgba(139,92,246,0.10)', border: 'rgba(139,92,246,0.20)' },
          ].map(stat => (
            <div key={stat.label} style={{
              background: 'var(--bg-card)', border: `1px solid ${stat.border}`,
              borderRadius: '12px', padding: '16px',
              display: 'flex', alignItems: 'center', gap: '14px',
            }}>
              <div style={{
                width: '40px', height: '40px', borderRadius: '10px', flexShrink: 0,
                background: stat.bg, border: `1px solid ${stat.border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <stat.icon style={{ width: '18px', height: '18px', color: stat.accent }} />
              </div>
              <div>
                <div style={{ fontSize: '22px', fontWeight: 900, color: 'var(--text-1)', letterSpacing: '-0.03em', lineHeight: 1 }}>{stat.value}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-4)', marginTop: '3px', fontWeight: 500 }}>{stat.label}</div>
              </div>
            </div>
          ))}

          {/* Matching companies preview */}
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
              <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-1)' }}>
                ICP Matches ({matchingCompanies.length})
              </p>
            </div>
            <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
              {matchingCompanies.slice(0, 8).map(c => (
                <div key={c.id} style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '10px 16px', borderBottom: '1px solid var(--border)',
                }}>
                  <div style={{
                    width: '28px', height: '28px', borderRadius: '7px', flexShrink: 0,
                    background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '11px', fontWeight: 800, color: 'var(--text-4)',
                  }}>
                    {c.name.charAt(0)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</p>
                    <p style={{ fontSize: '10px', color: 'var(--text-5)' }}>{c.industry} · Score {c.leadScore}</p>
                  </div>
                  <span style={{
                    fontSize: '9px', fontWeight: 800, padding: '2px 6px', borderRadius: '4px',
                    background: c.intentStatus === 'HOT' ? 'rgba(244,63,94,0.12)' : 'rgba(245,158,11,0.10)',
                    color: c.intentStatus === 'HOT' ? '#FB7185' : '#FBBF24',
                    border: `1px solid ${c.intentStatus === 'HOT' ? 'rgba(244,63,94,0.25)' : 'rgba(245,158,11,0.25)'}`,
                  }}>
                    {c.intentStatus}
                  </span>
                </div>
              ))}
              {matchingCompanies.length > 8 && (
                <div style={{ padding: '10px 16px', textAlign: 'center', fontSize: '12px', color: 'var(--text-5)' }}>
                  +{matchingCompanies.length - 8} more
                </div>
              )}
            </div>
          </div>

          <button
            onClick={handleSaveRulebook}
            style={{
              padding: '11px', borderRadius: '10px',
              background: saved ? '#10B981' : 'var(--bg-elevated)',
              border: saved ? '1px solid #10B981' : '1px solid var(--border)',
              color: saved ? '#ffffff' : 'var(--text-3)',
              fontSize: '13px', fontWeight: 700,
              cursor: 'pointer', fontFamily: 'inherit',
              transition: 'all 0.2s ease',
            }}
          >
            {saved ? '✓ Rulebook Saved!' : 'Save ICP Rulebook'}
          </button>
        </div>
      </div>
    </div>
  )
}
