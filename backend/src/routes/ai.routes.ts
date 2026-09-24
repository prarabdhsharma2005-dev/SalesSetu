import { Router } from 'express'
import { SalesGeminiService } from '../services/gemini.service'

export const aiRouter = Router()

aiRouter.post('/icp-parse', async (req, res) => {
  const { query } = req.body
  if (!query) {
    return res.status(400).json({ error: 'Query is required' })
  }
  const result = await SalesGeminiService.parseICPQuery(query)
  return res.json(result)
})

aiRouter.post('/draft-email', async (req, res) => {
  const { prospect } = req.body
  if (!prospect) {
    return res.status(400).json({ error: 'Prospect data is required' })
  }
  const result = await SalesGeminiService.draftPersonalizedEmail(prospect)
  return res.json(result)
})

aiRouter.post('/extract-mom', async (req, res) => {
  const { transcript } = req.body
  if (!transcript) {
    return res.status(400).json({ error: 'Transcript or notes are required' })
  }
  const result = await SalesGeminiService.extractMoM(transcript)
  return res.json(result)
})
