import { Router } from 'express'
import { GoogleSheetsService } from '../services/sheets.service'

export const sheetsRouter = Router()

// Get connection status
sheetsRouter.get('/status', (_req, res) => {
  res.json(GoogleSheetsService.getStatus())
})

// Leads from Google Sheets
sheetsRouter.get('/leads', async (_req, res) => {
  const leads = await GoogleSheetsService.getLeads()
  res.json({ total: leads.length, leads })
})

sheetsRouter.post('/leads', async (req, res) => {
  try {
    const lead = await GoogleSheetsService.appendLead(req.body)
    res.status(201).json(lead)
  } catch (err) {
    res.status(500).json({ error: 'Failed to append lead to sheets', details: String(err) })
  }
})

// Deals from Google Sheets
sheetsRouter.get('/deals', async (_req, res) => {
  const deals = await GoogleSheetsService.getDeals()
  const totalPipelineValue = deals.reduce((acc, d) => acc + (Number(d.value) || 0), 0)
  res.json({ totalPipelineValue, deals })
})

sheetsRouter.post('/deals', async (req, res) => {
  try {
    const deal = await GoogleSheetsService.appendDeal(req.body)
    res.status(201).json(deal)
  } catch (err) {
    res.status(500).json({ error: 'Failed to append deal to sheets', details: String(err) })
  }
})

// Meetings from Google Sheets
sheetsRouter.get('/meetings', async (_req, res) => {
  const meetings = await GoogleSheetsService.getMeetings()
  res.json({ total: meetings.length, meetings })
})

sheetsRouter.post('/meetings', async (req, res) => {
  try {
    const meeting = await GoogleSheetsService.appendMeeting(req.body)
    res.status(201).json(meeting)
  } catch (err) {
    res.status(500).json({ error: 'Failed to append meeting to sheets', details: String(err) })
  }
})

// Outreach from Google Sheets
sheetsRouter.get('/outreach', async (_req, res) => {
  const outreach = await GoogleSheetsService.getOutreach()
  res.json({ total: outreach.length, outreach })
})

sheetsRouter.post('/outreach', async (req, res) => {
  try {
    const item = await GoogleSheetsService.appendOutreach(req.body)
    res.status(201).json(item)
  } catch (err) {
    res.status(500).json({ error: 'Failed to append outreach to sheets', details: String(err) })
  }
})
