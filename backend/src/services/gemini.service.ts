import 'dotenv/config'
import { GoogleGenAI } from '@google/genai'

// Candidate models in order of priority (handles deprecation/demand spikes)
const CANDIDATE_MODELS = [
  'gemini-3.5-flash-lite',
  'gemini-3.5-flash',
  'gemini-3.8-flash',
  'gemini-3.1-flash-lite',
]

export function getGenAI(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim() || ''
  if (!apiKey) return null
  return new GoogleGenAI({ apiKey })
}

// Backwards compatibility export
export const ai = getGenAI()

/**
 * Service to interface with Google Gemini API for sales intelligence workflows
 */
export class SalesGeminiService {
  /**
   * Helper to execute Gemini generation across candidate models with automatic fallback
   */
  private static async generateContent(contents: string): Promise<{ text: string; model: string }> {
    const client = getGenAI()
    if (!client) {
      throw new Error('GEMINI_API_KEY is not configured')
    }

    let lastError: unknown = null
    for (const model of CANDIDATE_MODELS) {
      try {
        const response = await client.models.generateContent({
          model,
          contents,
        })
        const text = response.text || ''
        return { text, model }
      } catch (err: unknown) {
        lastError = err
        const errMsg = err instanceof Error ? err.message : String(err)
        console.warn(`[GeminiService] Model '${model}' failed: ${errMsg.slice(0, 120)}. Trying next...`)
      }
    }

    throw lastError || new Error('All Gemini candidate models failed')
  }

  /**
   * Test API connectivity and report active model
   */
  static async testConnection() {
    const client = getGenAI()
    if (!client) {
      return {
        connected: false,
        error: 'GEMINI_API_KEY environment variable is missing or empty',
      }
    }

    try {
      const startTime = Date.now()
      const result = await this.generateContent('Confirm connection with: OK')
      const latencyMs = Date.now() - startTime

      return {
        connected: true,
        model: result.model,
        latencyMs,
        response: result.text.trim(),
      }
    } catch (err: unknown) {
      const error = err instanceof Error ? err.message : String(err)
      return {
        connected: false,
        error,
      }
    }
  }

  /**
   * Parse natural language ICP query into structured filter criteria
   */
  static async parseICPQuery(query: string) {
    const client = getGenAI()
    if (!client) {
      return {
        industries: ['B2B SaaS', 'Enterprise Software'],
        geography: { country: 'India', cities: ['Bengaluru', 'Mumbai', 'Delhi-NCR'] },
        companySize: { min: 50, max: 500 },
        targetPersonas: ['VP of Sales', 'Head of Business Development', 'CRO'],
        painPoints: ['High SDR churn', 'Manual lead qualification', 'Low cold email response rate'],
        rawQuery: query,
      }
    }

    try {
      const prompt = `You are an AI sales strategist. Convert this natural language ICP description into a JSON structure with industries, geography, companySize (min, max), targetPersonas, and painPoints: "${query}". Return valid JSON only.`
      const { text } = await this.generateContent(prompt)
      return JSON.parse(text.replace(/```json|```/g, '').trim())
    } catch (err) {
      console.error('[GeminiService] parseICPQuery error:', err)
      return { error: 'Failed to parse with Gemini, falling back to heuristic parsing', query }
    }
  }

  /**
   * Generate personalized 1-on-1 cold outreach email
   */
  static async draftPersonalizedEmail(prospect: { name: string; title: string; company: string; intentSignal?: string }) {
    const client = getGenAI()
    if (!client) {
      return {
        subject: `Quick question regarding ${prospect.company}'s sales pipeline automation`,
        body: `Hi ${prospect.name},\n\nI noticed ${prospect.company} recently had activity around ${prospect.intentSignal || 'scaling sales operations'}.\n\nAt SalesSetu, we help leaders like yourself automate lead research, qualification, and meeting workflows directly with AI.\n\nWould you have 10 minutes this Thursday for a brief chat?\n\nBest regards,\nSalesSetu Team`,
        score: 92,
      }
    }

    const prompt = `Write a high-converting cold email to ${prospect.name}, ${prospect.title} at ${prospect.company}. Context/Intent: ${prospect.intentSignal || 'Scaling B2B outbound'}. Keep it concise, punchy, and value-oriented. Return JSON with 'subject' and 'body'.`

    try {
      const { text } = await this.generateContent(prompt)
      return JSON.parse(text.replace(/```json|```/g, '').trim())
    } catch (err) {
      console.error('[GeminiService] draftPersonalizedEmail error:', err)
      return { subject: `Connecting with ${prospect.company}`, body: `Hi ${prospect.name}...` }
    }
  }

  /**
   * Extract Minutes of Meeting (MoM) and action items from call notes
   */
  static async extractMoM(transcriptOrNotes: string) {
    const client = getGenAI()
    if (!client) {
      return {
        summary: 'Demo of SalesSetu completed. Prospect showed high interest in the automated meeting notes and Gemini SDR workflow.',
        keyDiscussionPoints: [
          'Discussed pricing for a 15-rep SDR team',
          'Current CRM is HubSpot, requires two-way contact sync',
          'Security review required for SOC2 certification',
        ],
        actionItems: [
          { task: 'Send enterprise pricing tier details', assignee: 'Account Executive', due: 'In 2 days' },
          { task: 'Share SOC2 Type II compliance pack', assignee: 'Solutions Engineer', due: 'Tomorrow' },
        ],
        dealHealthScore: 85,
        sentiment: 'Positive',
      }
    }

    try {
      const prompt = `Analyze these sales meeting notes/transcript and extract JSON with 'summary', 'keyDiscussionPoints' (array), 'actionItems' (array of objects { task, assignee, due }), 'dealHealthScore' (1-100), and 'sentiment' (Positive/Neutral/At Risk):\n\n${transcriptOrNotes}`
      const { text } = await this.generateContent(prompt)
      return JSON.parse(text.replace(/```json|```/g, '').trim())
    } catch (err) {
      console.error('[GeminiService] extractMoM error:', err)
      return { error: 'Failed to extract MoM from Gemini' }
    }
  }
}
