import { GoogleGenAI } from '@google/genai'

const apiKey = process.env.GEMINI_API_KEY || ''
export const ai = apiKey ? new GoogleGenAI({ apiKey }) : null

/**
 * Service to interface with Google Gemini API for sales intelligence workflows
 */
export class SalesGeminiService {
  /**
   * Parse natural language ICP query into structured filter criteria
   */
  static async parseICPQuery(query: string) {
    if (!ai) {
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
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `You are an AI sales strategist. Convert this natural language ICP description into a JSON structure with industries, geography, companySize (min, max), targetPersonas, and painPoints: "${query}". Return valid JSON only.`,
      })
      const text = response.text || '{}'
      return JSON.parse(text.replace(/```json|```/g, '').trim())
    } catch {
      return { error: 'Failed to parse with Gemini, falling back to heuristic parsing', query }
    }
  }

  /**
   * Generate personalized 1-on-1 cold outreach email
   */
  static async draftPersonalizedEmail(prospect: { name: string; title: string; company: string; intentSignal?: string }) {
    if (!ai) {
      return {
        subject: `Quick question regarding ${prospect.company}'s sales pipeline automation`,
        body: `Hi ${prospect.name},\n\nI noticed ${prospect.company} recently had activity around ${prospect.intentSignal || 'scaling sales operations'}.\n\nAt SalesSetu, we help leaders like yourself automate lead research, qualification, and meeting workflows directly with AI.\n\nWould you have 10 minutes this Thursday for a brief chat?\n\nBest regards,\nSalesSetu Team`,
        score: 92,
      }
    }

    const prompt = `Write a high-converting cold email to ${prospect.name}, ${prospect.title} at ${prospect.company}. Context/Intent: ${prospect.intentSignal || 'Scaling B2B outbound'}. Keep it concise, punchy, and value-oriented. Return JSON with 'subject' and 'body'.`

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      })
      const text = response.text || '{}'
      return JSON.parse(text.replace(/```json|```/g, '').trim())
    } catch {
      return { subject: `Connecting with ${prospect.company}`, body: `Hi ${prospect.name}...` }
    }
  }

  /**
   * Extract Minutes of Meeting (MoM) and action items from call notes
   */
  static async extractMoM(transcriptOrNotes: string) {
    if (!ai) {
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
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Analyze these sales meeting notes/transcript and extract JSON with 'summary', 'keyDiscussionPoints' (array), 'actionItems' (array of objects { task, assignee, due }), 'dealHealthScore' (1-100), and 'sentiment' (Positive/Neutral/At Risk):\n\n${transcriptOrNotes}`,
      })
      const text = response.text || '{}'
      return JSON.parse(text.replace(/```json|```/g, '').trim())
    } catch {
      return { error: 'Failed to extract MoM from Gemini' }
    }
  }
}
