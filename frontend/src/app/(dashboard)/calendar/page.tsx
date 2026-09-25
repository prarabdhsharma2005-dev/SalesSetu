import { DEMO_MEETINGS, DEMO_COMPANIES } from '@/lib/demo-data'
import { Calendar, Clock, CheckCircle2, ExternalLink, Plus } from 'lucide-react'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const today = new Date()
const month = today.toLocaleString('en-IN', { month: 'long', year: 'numeric' })

export default function CalendarPage() {
  const meetings = DEMO_MEETINGS
  const todayStr = today.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 900, color: 'var(--text-1)', letterSpacing: '-0.03em' }}>
            Sales Calendar
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--text-4)', marginTop: '6px' }}>{todayStr}</p>
        </div>
        <button style={{
          display: 'flex', alignItems: 'center', gap: '7px',
          padding: '10px 18px', borderRadius: '10px',
          background: 'var(--blue)', border: 'none',
          color: 'white', fontSize: '13px', fontWeight: 700,
          cursor: 'pointer', fontFamily: 'inherit',
          boxShadow: '0 2px 12px rgba(59,130,246,0.30)',
        }}>
          <Plus style={{ width: '15px', height: '15px' }} /> Schedule Meeting
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '20px', alignItems: 'start' }}>
        {/* Calendar grid */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-1)' }}>{month}</h2>
          </div>
          {/* Day headers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: '4px', marginBottom: '8px' }}>
            {DAYS.map(d => (
              <div key={d} style={{ textAlign: 'center', fontSize: '11px', fontWeight: 700, color: 'var(--text-5)', letterSpacing: '0.06em', padding: '8px 0' }}>
                {d}
              </div>
            ))}
          </div>
          {/* Calendar days */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: '4px' }}>
            {Array.from({ length: 35 }, (_, i) => {
              const dayNum = i - 3 + 1 // offset for September starting on Monday
              const isToday = dayNum === today.getDate()
              const hasMeeting = meetings.some(m => new Date(m.scheduledAt).getDate() === dayNum && dayNum > 0 && dayNum <= 30)
              const valid = dayNum > 0 && dayNum <= 30

              return (
                <div
                  key={i}
                  style={{
                    aspectRatio: '1', display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    borderRadius: '9px', cursor: valid ? 'pointer' : 'default',
                    background: isToday ? 'var(--blue)' : hasMeeting ? 'rgba(59,130,246,0.10)' : 'transparent',
                    border: isToday ? '1px solid var(--blue)' : hasMeeting ? '1px solid rgba(59,130,246,0.25)' : '1px solid transparent',
                    transition: 'all 0.15s ease',
                    position: 'relative',
                  }}
                >
                  {valid && (
                    <>
                      <span style={{ fontSize: '13px', fontWeight: isToday ? 800 : 500, color: isToday ? 'white' : 'var(--text-3)' }}>
                        {dayNum}
                      </span>
                      {hasMeeting && !isToday && (
                        <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--blue)', marginTop: '3px' }} />
                      )}
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Upcoming meetings */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '20px' }}>
          <h2 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-1)', marginBottom: '16px' }}>
            Upcoming Meetings
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {meetings.map(mtg => {
              const company = DEMO_COMPANIES.find(c => c.id === mtg.companyId)
              const timeStr = new Date(mtg.scheduledAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
              const dateStr = new Date(mtg.scheduledAt).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })
              return (
                <div key={mtg.id} style={{ padding: '14px', borderRadius: '12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--blue)', flexShrink: 0 }} />
                    <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-1)' }}>{company?.name}</p>
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--text-4)', marginBottom: '8px' }}>{mtg.title}</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '8px' }}>
                    <Clock style={{ width: '11px', height: '11px', color: 'var(--text-5)' }} />
                    <span style={{ fontSize: '11px', color: 'var(--text-5)' }}>{dateStr} · {timeStr} · {mtg.duration}min</span>
                  </div>
                  <a href={mtg.meetLink} target="_blank" rel="noopener noreferrer" style={{
                    display: 'flex', alignItems: 'center', gap: '5px',
                    fontSize: '12px', fontWeight: 600, color: 'var(--blue-light)', textDecoration: 'none',
                  }}>
                    <CheckCircle2 style={{ width: '12px', height: '12px' }} /> Join Google Meet
                    <ExternalLink style={{ width: '10px', height: '10px', opacity: 0.6 }} />
                  </a>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
