'use client'


import { CheckCircle, AlertCircle } from 'lucide-react'

const integrations = [
  {
    category: 'CRM',
    items: [
      { name: 'HubSpot',      status: 'unavailable', desc: 'Bi-directional contact & deal sync',         logo: '🟠', lastSync: '2 min ago' },
      { name: 'Salesforce',   status: 'unavailable', desc: 'Enterprise CRM integration',                 logo: '☁️', lastSync: null },
      { name: 'Pipedrive',    status: 'unavailable', desc: 'Pipeline and deal management sync',          logo: '🔵', lastSync: null },
    ],
  },
  {
    category: 'Communication',
    items: [
      { name: 'Gmail',        status: 'unavailable', desc: 'Email send, tracking & reply detection',     logo: '📧', lastSync: '1 min ago' },
      { name: 'LinkedIn',     status: 'unavailable', desc: 'InMail sending & profile enrichment',        logo: '💼', lastSync: '5 min ago' },
      { name: 'WhatsApp Business', status: 'unavailable', desc: 'WhatsApp outreach & automation',       logo: '💬', lastSync: null },
    ],
  },
  {
    category: 'Intelligence',
    items: [
      { name: 'Tracxn',       status: 'unavailable', desc: 'Funding rounds & company intelligence',      logo: '📊', lastSync: '10 min ago' },
      { name: 'LinkedIn Jobs',status: 'unavailable', desc: 'Hiring signal detection for intent scoring', logo: '🔍', lastSync: '15 min ago' },
      { name: 'Clearbit',     status: 'unavailable', desc: 'Company enrichment and firmographics',       logo: '✨', lastSync: null },
    ],
  },
  {
    category: 'Productivity',
    items: [
      { name: 'Google Calendar', status: 'unavailable', desc: 'Meeting scheduling & calendar sync',      logo: '📅', lastSync: 'Live' },
      { name: 'Google Meet',  status: 'unavailable', desc: 'Auto-generate meeting links',               logo: '🎥', lastSync: 'Live' },
      { name: 'Notion',       status: 'unavailable', desc: 'MoM and deal notes sync',                   logo: '📝', lastSync: null },
    ],
  },
]

export default function IntegrationsPage() {


  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 900, color: 'var(--text-1)', letterSpacing: '-0.03em' }}>
            Storage & Integrations
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--text-4)', marginTop: '6px' }}>
            Connect your sales stack · Google Sheets / Apps Script backend
          </p>
        </div>
        <div style={{
          padding: '8px 14px', borderRadius: '10px',
          background: 'rgba(16,185,129,0.10)', border: '1px solid rgba(16,185,129,0.22)',
          fontSize: '13px', fontWeight: 600, color: '#34D399',
          display: 'flex', alignItems: 'center', gap: '6px',
        }}>
          <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#10B981' }} className="pulse-dot" />
          Integration catalog · connections unavailable
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {integrations.map(group => (
          <div key={group.category}>
            <h2 style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-5)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '12px' }}>
              {group.category}
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
              {group.items.map(item => (
                <div
                  key={item.name}
                  style={{
                    background: 'var(--bg-card)', border: `1px solid ${item.status === 'connected' ? 'rgba(16,185,129,0.22)' : 'var(--border)'}`,
                    borderRadius: '14px', padding: '18px',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '12px' }}>
                    <div style={{
                      width: '40px', height: '40px', borderRadius: '10px', flexShrink: 0,
                      background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px',
                    }}>
                      {item.logo}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                        <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-1)' }}>{item.name}</p>
                        {item.status === 'connected'
                          ? <CheckCircle style={{ width: '13px', height: '13px', color: '#10B981', flexShrink: 0 }} />
                          : <AlertCircle style={{ width: '13px', height: '13px', color: 'var(--text-5)', flexShrink: 0 }} />
                        }
                      </div>
                      <p style={{ fontSize: '11px', color: 'var(--text-5)', lineHeight: 1.4 }}>{item.desc}</p>
                    </div>
                  </div>

                  {item.status === 'connected' && item.lastSync && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '10px' }}>
                      <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10B981' }} className="pulse-dot" />
                      <span style={{ fontSize: '11px', color: '#34D399', fontWeight: 500 }}>Last sync: {item.lastSync}</span>
                    </div>
                  )}

                  <button
                    disabled
                    style={{
                      width: '100%', padding: '8px', borderRadius: '8px',
                      background: item.status === 'connected' ? 'var(--bg-elevated)' : 'rgba(59,130,246,0.10)',
                      border: item.status === 'connected' ? '1px solid var(--border)' : '1px solid rgba(59,130,246,0.22)',
                      color: item.status === 'connected' ? 'var(--text-4)' : 'var(--blue-light)',
                      fontSize: '12px', fontWeight: 700,
                      cursor: item.status === 'connected' ? 'default' : 'pointer',
                      fontFamily: 'inherit',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
                    }}
                  >
                    Not connected · unavailable
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Google Sheets Backend */}
      <div style={{
        background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.20)',
        borderRadius: '16px', padding: '24px',
        display: 'flex', alignItems: 'center', gap: '20px',
      }}>
        <div style={{ fontSize: '36px' }}>📊</div>
        <div style={{ flex: 1 }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-1)', marginBottom: '4px' }}>
            Google Sheets + Apps Script Backend
          </h3>
          <p style={{ fontSize: '13px', color: 'var(--text-4)', lineHeight: 1.6 }}>
            SalesSetu stores application records in backend JSON storage. An optional Apps Script webhook mirrors selected updates.
            A configured webhook does not prove successful sync. OAuth, sending, reply detection, and Calendar sync are unavailable.
          </p>
        </div>
        <button disabled style={{
          padding: '10px 20px', borderRadius: '10px',
          background: '#10B981', border: 'none',
          color: 'white', fontSize: '13px', fontWeight: 700,
          cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
          boxShadow: '0 2px 10px rgba(16,185,129,0.25)',
        }}>
          Spreadsheet access is configured separately
        </button>
      </div>
    </div>
  )
}
