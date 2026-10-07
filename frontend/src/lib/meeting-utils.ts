import type { Deal, Lead, Meeting, OutreachItem } from './api'

export function toLocalDateTime(utc: string | null | undefined): string {
  if (!utc) return ''
  const date = new Date(utc)
  if (!Number.isFinite(date.getTime())) return ''
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function toUtcScheduledAt(local: string): string {
  const date = new Date(local)
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local) || !Number.isFinite(date.getTime()) || toLocalDateTime(date.toISOString()) !== local) {
    throw new Error('Choose a valid date and time in your local timezone.')
  }
  return date.toISOString()
}

export function meetingTimeLabel(meeting: Meeting): string {
  return meeting.scheduledAt && Number.isFinite(Date.parse(meeting.scheduledAt))
    ? new Date(meeting.scheduledAt).toLocaleString()
    : meeting.date ? `${meeting.date} (legacy date; timezone unknown)` : 'Schedule unknown'
}

export function meetingAssociations(lead: Lead | undefined, outreach: OutreachItem[], deals: Deal[]) {
  const records = lead ? outreach.filter(item => item.leadId === lead.id && item.company === lead.company) : []
  const sourced = records.filter(item => item.pocId && item.poc?.name && item.poc.sourceUrl)
  return {
    outreach: records,
    pocs: sourced.filter((item, index) => sourced.findIndex(other => other.pocId === item.pocId) === index),
    deals: lead ? deals.filter(item => item.company === lead.company && (!item.leadId || item.leadId === lead.id)) : [],
  }
}
