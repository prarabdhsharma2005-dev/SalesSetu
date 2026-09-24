import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { aiRouter } from './routes/ai.routes'
import { leadsRouter } from './routes/leads.routes'
import { pipelineRouter } from './routes/pipeline.routes'
import { sheetsRouter } from './routes/sheets.routes'
import { GoogleSheetsService } from './services/sheets.service'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 5000

const allowedOrigin = process.env.FRONTEND_URL ? process.env.FRONTEND_URL.replace(/\/$/, '') : 'http://localhost:3000'

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true)
    if (
      origin === allowedOrigin ||
      origin === 'http://localhost:3000' ||
      origin.endsWith('.onrender.com') ||
      process.env.NODE_ENV !== 'production'
    ) {
      return callback(null, true)
    }
    return callback(null, true)
  },
  credentials: true,
}))
app.use(express.json())

// Root welcome endpoint
app.get('/', (_req, res) => {
  res.json({
    name: 'SalesSetu Backend API',
    status: 'online',
    frontend: process.env.FRONTEND_URL || 'http://localhost:3000',
    endpoints: {
      health: '/health',
      leads: '/api/leads',
      pipeline: '/api/pipeline',
      ai: '/api/ai',
      sheets: '/api/sheets',
    },
  })
})

// Health check
app.get('/health', (_req, res) => {
  res.json({
    status: 'healthy',
    service: 'SalesSetu Backend API',
    timestamp: new Date().toISOString(),
    geminiConfigured: !!process.env.GEMINI_API_KEY,
    storage: GoogleSheetsService.getStatus(),
  })
})

// API Routes
app.use('/api/ai', aiRouter)
app.use('/api/leads', leadsRouter)
app.use('/api/pipeline', pipelineRouter)
app.use('/api/sheets', sheetsRouter)

app.listen(PORT, () => {
  console.log(`[SalesSetu API] Server running on http://localhost:${PORT}`)
  console.log(`[SalesSetu Storage] Primary Store: Google Sheets (Mode: ${GoogleSheetsService.getStatus().mode})`)
})
