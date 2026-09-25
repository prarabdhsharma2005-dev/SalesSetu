'use client'

import { useState } from 'react'
import { Settings, User, Bell, Shield, Zap, Save, ChevronRight } from 'lucide-react'

const settingsSections = ['Profile', 'Notifications', 'AI Configuration', 'Security', 'Team']

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState('Profile')
  const [dailyLimit, setDailyLimit]       = useState('50')
  const [autoApprove, setAutoApprove]     = useState(false)
  const [notifEmail, setNotifEmail]       = useState(true)
  const [notifSlack, setNotifSlack]       = useState(true)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      <div>
        <h1 style={{ fontSize: '28px', fontWeight: 900, color: 'var(--text-1)', letterSpacing: '-0.03em' }}>Settings</h1>
        <p style={{ fontSize: '14px', color: 'var(--text-4)', marginTop: '6px' }}>Manage your SalesSetu account and AI agent preferences</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: '20px', alignItems: 'start' }}>
        {/* Sidebar nav */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '14px', overflow: 'hidden' }}>
          {settingsSections.map(s => (
            <button
              key={s}
              onClick={() => setActiveSection(s)}
              style={{
                width: '100%', padding: '13px 16px', textAlign: 'left',
                background: activeSection === s ? 'rgba(59,130,246,0.10)' : 'transparent',
                border: 'none',
                borderLeft: activeSection === s ? '3px solid var(--blue)' : '3px solid transparent',
                color: activeSection === s ? 'var(--blue-light)' : 'var(--text-4)',
                fontSize: '13px', fontWeight: activeSection === s ? 700 : 500,
                cursor: 'pointer', fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                transition: 'all 0.15s ease',
              }}
            >
              {s}
              {activeSection === s && <ChevronRight style={{ width: '13px', height: '13px' }} />}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '14px', padding: '28px' }}>
          {activeSection === 'Profile' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <h2 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-1)', marginBottom: '4px' }}>Profile</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', paddingBottom: '20px', borderBottom: '1px solid var(--border)' }}>
                <div style={{
                  width: '64px', height: '64px', borderRadius: '50%',
                  background: 'linear-gradient(135deg, var(--blue) 0%, var(--purple) 100%)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '24px', fontWeight: 900, color: 'white',
                }}>P</div>
                <div>
                  <p style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-1)' }}>Prarabdh Sharma</p>
                  <p style={{ fontSize: '13px', color: 'var(--text-4)' }}>Founder & Owner · prarabdh@salessetu.ai</p>
                </div>
              </div>
              {[
                { label: 'Full Name',       value: 'Prarabdh Sharma',      type: 'text' },
                { label: 'Email',           value: 'prarabdh@salessetu.ai', type: 'email' },
                { label: 'Company',         value: 'SalesSetu',             type: 'text' },
                { label: 'Role',            value: 'Founder & Owner',       type: 'text' },
              ].map(f => (
                <div key={f.label}>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-4)', display: 'block', marginBottom: '7px', letterSpacing: '0.04em' }}>
                    {f.label}
                  </label>
                  <input
                    type={f.type}
                    defaultValue={f.value}
                    style={{
                      width: '100%', padding: '10px 14px', borderRadius: '10px',
                      background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                      color: 'var(--text-2)', fontSize: '14px', fontFamily: 'inherit', outline: 'none',
                    }}
                  />
                </div>
              ))}
            </div>
          )}

          {activeSection === 'AI Configuration' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <h2 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-1)' }}>AI Agent Configuration</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-4)', display: 'block', marginBottom: '7px' }}>Daily Outbound Email Limit</label>
                  <input
                    type="number"
                    value={dailyLimit}
                    onChange={e => setDailyLimit(e.target.value)}
                    max="200"
                    style={{ width: '120px', padding: '10px 14px', borderRadius: '10px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-2)', fontSize: '14px', fontFamily: 'inherit', outline: 'none' }}
                  />
                  <p style={{ fontSize: '11px', color: 'var(--text-5)', marginTop: '5px' }}>Recommended: 40–60 for cold email deliverability</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', borderRadius: '12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                  <div>
                    <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-1)', marginBottom: '3px' }}>Auto-Approve Outreach</p>
                    <p style={{ fontSize: '12px', color: 'var(--text-5)' }}>Skip human approval for high-confidence (≥95%) drafts</p>
                  </div>
                  <div
                    onClick={() => setAutoApprove(!autoApprove)}
                    style={{
                      width: '44px', height: '24px', borderRadius: '12px',
                      background: autoApprove ? 'var(--blue)' : 'rgba(255,255,255,0.10)',
                      border: '1px solid var(--border)',
                      position: 'relative', cursor: 'pointer', transition: 'background 0.2s ease', flexShrink: 0,
                    }}
                  >
                    <div style={{
                      width: '18px', height: '18px', borderRadius: '50%', background: 'white',
                      position: 'absolute', top: '2px',
                      left: autoApprove ? '22px' : '2px',
                      transition: 'left 0.2s ease',
                      boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
                    }} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {(activeSection === 'Notifications' || activeSection === 'Security' || activeSection === 'Team') && (
            <div>
              <h2 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-1)', marginBottom: '16px' }}>{activeSection}</h2>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 0', color: 'var(--text-5)' }}>
                <Settings style={{ width: '32px', height: '32px', marginBottom: '12px', opacity: 0.5 }} />
                <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-4)' }}>{activeSection} settings</p>
                <p style={{ fontSize: '12px', marginTop: '4px' }}>Available in production build</p>
              </div>
            </div>
          )}

          <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid var(--border)', display: 'flex', gap: '10px' }}>
            <button style={{
              display: 'flex', alignItems: 'center', gap: '7px',
              padding: '10px 20px', borderRadius: '10px',
              background: 'var(--blue)', border: 'none',
              color: 'white', fontSize: '13px', fontWeight: 700,
              cursor: 'pointer', fontFamily: 'inherit',
              boxShadow: '0 2px 10px rgba(59,130,246,0.25)',
            }}>
              <Save style={{ width: '14px', height: '14px' }} /> Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
