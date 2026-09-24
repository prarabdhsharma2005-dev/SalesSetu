import fs from 'fs'
import path from 'path'

export interface SheetLead {
  id: string
  company: string
  website: string
  industry: string
  country: string
  city: string
  employees: number | string
  intentSignal: string
  leadScore: number
  status: string
  createdAt?: string
}

export interface SheetDeal {
  id: string
  title: string
  company: string
  stage: string
  value: number
  probability: number
  health: string
  nextAction: string
  createdAt?: string
}

export interface SheetMeeting {
  id: string
  title: string
  company: string
  date: string
  attendees: string
  summary: string
  actionItems: string
  sentiment: string
}

export interface SheetOutreach {
  id: string
  prospectName: string
  email: string
  company: string
  subject: string
  body: string
  status: 'PENDING' | 'APPROVED' | 'SENT' | 'REJECTED'
  sentAt?: string
}

const LOCAL_STORAGE_DIR = path.join(__dirname, '../../data')
const LOCAL_STORAGE_FILE = path.join(LOCAL_STORAGE_DIR, 'sheets_store.json')

/**
 * Service to manage SalesSetu data stored directly in Google Sheets,
 * with local caching fallback for immediate usability.
 */
export class GoogleSheetsService {
  private static sheetId = process.env.GOOGLE_SHEET_ID || ''
  private static webhookUrl = process.env.GOOGLE_SHEETS_WEBHOOK_URL || ''

  /**
   * Ensure local file storage exists for fallback / sync
   */
  private static ensureStorage() {
    if (!fs.existsSync(LOCAL_STORAGE_DIR)) {
      fs.mkdirSync(LOCAL_STORAGE_DIR, { recursive: true })
    }
    if (!fs.existsSync(LOCAL_STORAGE_FILE)) {
      const initialData = {
        leads: [
          {
            id: 'lead-1',
            company: 'Zoho Corporation',
            website: 'zoho.com',
            industry: 'SaaS',
            country: 'India',
            city: 'Chennai',
            employees: 15000,
            intentSignal: 'Hiring heavily in BD & AI Expansion',
            leadScore: 72,
            status: 'PROSPECT',
            createdAt: new Date().toISOString(),
          },
          {
            id: 'lead-2',
            company: 'Razorpay',
            website: 'razorpay.com',
            industry: 'FinTech',
            country: 'India',
            city: 'Bangalore',
            employees: 3000,
            intentSignal: 'Launched Capital arm, active partnerships',
            leadScore: 91,
            status: 'CONTACTED',
            createdAt: new Date().toISOString(),
          },
          {
            id: 'lead-3',
            company: 'BrowserStack',
            website: 'browserstack.com',
            industry: 'SaaS',
            country: 'India',
            city: 'Mumbai',
            employees: 1200,
            intentSignal: 'RFP for outbound sales automation tools',
            leadScore: 94,
            status: 'MEETING_SCHEDULED',
            createdAt: new Date().toISOString(),
          },
        ],
        deals: [
          {
            id: 'deal-1',
            title: 'Enterprise AI Suite Expansion',
            company: 'BrowserStack',
            stage: 'PROPOSAL',
            value: 45000,
            probability: 75,
            health: 'STRONG',
            nextAction: 'Send updated SOC2 compliance pack',
            createdAt: new Date().toISOString(),
          },
          {
            id: 'deal-2',
            title: 'Outbound Automation Pilot',
            company: 'Razorpay',
            stage: 'DISCOVERY',
            value: 24000,
            probability: 50,
            health: 'NEEDS_ATTENTION',
            nextAction: 'Follow up with Head of Partnerships',
            createdAt: new Date().toISOString(),
          },
        ],
        meetings: [],
        outreach: [],
      }
      fs.writeFileSync(LOCAL_STORAGE_FILE, JSON.stringify(initialData, null, 2), 'utf-8')
    }
  }

  private static readData() {
    this.ensureStorage()
    try {
      const raw = fs.readFileSync(LOCAL_STORAGE_FILE, 'utf-8')
      return JSON.parse(raw)
    } catch {
      return { leads: [], deals: [], meetings: [], outreach: [] }
    }
  }

  private static writeData(data: unknown) {
    this.ensureStorage()
    fs.writeFileSync(LOCAL_STORAGE_FILE, JSON.stringify(data, null, 2), 'utf-8')
  }

  /**
   * Get current connection status
   */
  static getStatus() {
    return {
      connectedToGoogleSheets: !!(this.sheetId || this.webhookUrl),
      mode: this.webhookUrl ? 'APPS_SCRIPT_WEBHOOK' : this.sheetId ? 'GOOGLE_SHEETS_API' : 'LOCAL_SHEET_CACHE',
      sheetId: this.sheetId || 'Not configured (using local sheet cache)',
      hasWebhook: !!this.webhookUrl,
      tabs: ['Leads', 'Deals', 'Meetings', 'Outreach'],
    }
  }

  /**
   * Send data to Google Sheet via Webhook if configured
   */
  private static async syncToGoogleSheet(action: string, tab: string, payload: unknown) {
    if (!this.webhookUrl) return { synced: false, reason: 'No webhook URL provided' }

    try {
      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, tab, payload, timestamp: new Date().toISOString() }),
      })
      return { synced: true, status: response.status }
    } catch (err) {
      console.warn('[GoogleSheetsService] Webhook push failed, kept in local store:', err)
      return { synced: false, error: String(err) }
    }
  }

  // ─── LEADS ────────────────────────────────────────────────────────────

  static async getLeads(): Promise<SheetLead[]> {
    const data = this.readData()
    return data.leads || []
  }

  static async appendLead(lead: Omit<SheetLead, 'id' | 'createdAt'>): Promise<SheetLead> {
    const data = this.readData()
    const newLead: SheetLead = {
      ...lead,
      id: `lead_${Date.now()}`,
      createdAt: new Date().toISOString(),
    }
    data.leads = [newLead, ...(data.leads || [])]
    this.writeData(data)

    // Trigger sync to Google Sheet
    await this.syncToGoogleSheet('APPEND', 'Leads', newLead)
    return newLead
  }

  static async updateLead(id: string, updates: Partial<SheetLead>): Promise<SheetLead | null> {
    const data = this.readData()
    const index = (data.leads || []).findIndex((l: SheetLead) => l.id === id)
    if (index === -1) return null

    data.leads[index] = { ...data.leads[index], ...updates }
    this.writeData(data)
    await this.syncToGoogleSheet('UPDATE', 'Leads', data.leads[index])
    return data.leads[index]
  }

  // ─── DEALS / PIPELINE ─────────────────────────────────────────────────

  static async getDeals(): Promise<SheetDeal[]> {
    const data = this.readData()
    return data.deals || []
  }

  static async appendDeal(deal: Omit<SheetDeal, 'id' | 'createdAt'>): Promise<SheetDeal> {
    const data = this.readData()
    const newDeal: SheetDeal = {
      ...deal,
      id: `deal_${Date.now()}`,
      createdAt: new Date().toISOString(),
    }
    data.deals = [newDeal, ...(data.deals || [])]
    this.writeData(data)
    await this.syncToGoogleSheet('APPEND', 'Deals', newDeal)
    return newDeal
  }

  static async updateDealStage(id: string, stage: string): Promise<SheetDeal | null> {
    const data = this.readData()
    const index = (data.deals || []).findIndex((d: SheetDeal) => d.id === id)
    if (index === -1) return null

    data.deals[index].stage = stage
    this.writeData(data)
    await this.syncToGoogleSheet('UPDATE', 'Deals', data.deals[index])
    return data.deals[index]
  }

  // ─── MEETINGS ─────────────────────────────────────────────────────────

  static async getMeetings(): Promise<SheetMeeting[]> {
    const data = this.readData()
    return data.meetings || []
  }

  static async appendMeeting(meeting: Omit<SheetMeeting, 'id'>): Promise<SheetMeeting> {
    const data = this.readData()
    const newMeeting: SheetMeeting = {
      ...meeting,
      id: `meeting_${Date.now()}`,
    }
    data.meetings = [newMeeting, ...(data.meetings || [])]
    this.writeData(data)
    await this.syncToGoogleSheet('APPEND', 'Meetings', newMeeting)
    return newMeeting
  }

  // ─── OUTREACH ─────────────────────────────────────────────────────────

  static async getOutreach(): Promise<SheetOutreach[]> {
    const data = this.readData()
    return data.outreach || []
  }

  static async appendOutreach(outreach: Omit<SheetOutreach, 'id'>): Promise<SheetOutreach> {
    const data = this.readData()
    const newOutreach: SheetOutreach = {
      ...outreach,
      id: `outreach_${Date.now()}`,
    }
    data.outreach = [newOutreach, ...(data.outreach || [])]
    this.writeData(data)
    await this.syncToGoogleSheet('APPEND', 'Outreach', newOutreach)
    return newOutreach
  }
}
