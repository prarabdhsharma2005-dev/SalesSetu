import { DEMO_COMPANIES, DEMO_CONTACTS } from '@/lib/demo-data'
import { formatNumber } from '@/lib/utils'
import { Building2, Users, Globe, MapPin, TrendingUp, Flame, ArrowUpRight } from 'lucide-react'

export default function CompaniesPage() {
  const sorted = [...DEMO_COMPANIES].sort((a, b) => b.leadScore - a.leadScore)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      <div>
        <h1 style={{ fontSize: '28px', fontWeight: 900, color: 'var(--text-1)', letterSpacing: '-0.03em' }}>
          Company Intelligence
        </h1>
        <p style={{ fontSize: '14px', color: 'var(--text-4)', marginTop: '6px' }}>
          {DEMO_COMPANIES.length} companies tracked · Sorted by lead score
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '14px' }}>
        {sorted.map(company => {
          const contacts = DEMO_CONTACTS.filter(c => c.companyId === company.id)
          const intentColors: Record<string, { bg: string; text: string; border: string }> = {
            HOT:  { bg: 'rgba(244,63,94,0.12)',  text: '#FB7185', border: 'rgba(244,63,94,0.30)' },
            WARM: { bg: 'rgba(245,158,11,0.12)', text: '#FBBF24', border: 'rgba(245,158,11,0.30)' },
            COLD: { bg: 'rgba(113,113,122,0.10)',text: '#A1A1AA', border: 'rgba(113,113,122,0.25)' },
          }
          const ic = intentColors[company.intentStatus] ?? intentColors.COLD
          const scoreColor = company.leadScore >= 80 ? '#10B981' : company.leadScore >= 60 ? '#3B82F6' : '#F59E0B'

          return (
            <a
              key={company.id}
              href={`/companies/${company.id}`}
              style={{ textDecoration: 'none' }}
            >
              <div style={{
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: '14px', padding: '20px',
                transition: 'all 0.2s ease',
                height: '100%',
              }}
                className="company-card"
              >
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '14px' }}>
                  <div style={{
                    width: '44px', height: '44px', borderRadius: '11px', flexShrink: 0,
                    background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '18px', fontWeight: 900, color: 'var(--text-3)',
                  }}>
                    {company.name.charAt(0)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                      <p style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-1)' }}>{company.name}</p>
                      <span style={{
                        fontSize: '10px', fontWeight: 800, padding: '2px 8px', borderRadius: '6px',
                        background: ic.bg, color: ic.text, border: `1px solid ${ic.border}`,
                      }}>
                        {company.intentStatus}
                      </span>
                    </div>
                    <p style={{ fontSize: '11px', color: 'var(--text-5)' }}>{company.website}</p>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: '22px', fontWeight: 900, color: scoreColor, lineHeight: 1 }}>{company.leadScore}</div>
                    <div style={{ fontSize: '9px', color: 'var(--text-5)', marginTop: '2px' }}>SCORE</div>
                  </div>
                </div>

                {/* Tags */}
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
                  {[company.industry, company.city, company.fundingStage].map(tag => (
                    <span key={tag} style={{
                      fontSize: '11px', fontWeight: 600, color: 'var(--text-4)',
                      background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                      padding: '2px 8px', borderRadius: '5px',
                    }}>
                      {tag}
                    </span>
                  ))}
                </div>

                {/* Description */}
                <p style={{ fontSize: '12px', color: 'var(--text-4)', lineHeight: 1.5, marginBottom: '12px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {company.description}
                </p>

                {/* Stats */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-2)' }}>{formatNumber(company.employeeCount)}</div>
                    <div style={{ fontSize: '10px', color: 'var(--text-5)' }}>Employees</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-2)' }}>{contacts.length}</div>
                    <div style={{ fontSize: '10px', color: 'var(--text-5)' }}>Verified POCs</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-2)' }}>{company.revenue}</div>
                    <div style={{ fontSize: '10px', color: 'var(--text-5)' }}>Revenue</div>
                  </div>
                </div>
              </div>
            </a>
          )
        })}
      </div>

      <style>{`
        .company-card:hover {
          border-color: rgba(59,130,246,0.25) !important;
          transform: translateY(-2px);
          box-shadow: 0 8px 28px rgba(0,0,0,0.25) !important;
        }
      `}</style>
    </div>
  )
}
