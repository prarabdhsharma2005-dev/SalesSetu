# SalesSetu — Antigravity Build Prompt

Build **SalesSetu**, a polished, functional AI Sales Operating System for SDRs, BDRs, sales executives, founders, and business-development teams.

**Tagline:** *Bridge every sales opportunity from lead to deal.*

## 1. Core Product

SalesSetu should automate and assist the complete workflow:

**ICP → Lead Discovery → Intent Detection → Company Research → POC Discovery → Qualification → Outreach → Follow-up → Meeting → MoM → Deal Pipeline → Next Best Action**

This must be a real interconnected product, not a collection of static screens or a generic chatbot.

Use **Google Gemini API** as the primary AI engine.

---

## 2. Main Navigation

Create:

- Dashboard
- AI Sales Agent
- ICP Builder
- Lead Discovery
- Companies
- Contacts / POCs
- Outreach
- Approval Inbox
- Follow-ups
- Meetings
- Pipeline / Deals
- Analytics
- Calendar
- Integrations
- Settings

Use a premium, modern B2B SaaS UI: clean, professional, responsive, information-dense, strong hierarchy, excellent loading/empty/error states.

---

## 3. Onboarding + ICP Builder

Capture:

- User/company information
- Product/service
- Value proposition
- Target industries
- Geography
- Company size
- Buyer personas
- Typical deal size
- Sales objectives

Allow natural-language ICP creation.

Example:

> "Find Indian B2B SaaS companies with 50–500 employees that may need AI sales automation."

Convert this into structured filters and allow the user to edit them.

---

## 4. Lead Discovery

Support filters for:

### Geography
Country → State → City

### Industry
SaaS, FinTech, EdTech, HealthTech, E-commerce, Manufacturing, Logistics, Healthcare, Real Estate, IT, Consulting, BFSI, etc.

### Company
- Employee count
- Revenue
- Funding stage
- Founded year
- Business model
- Growth stage
- Technology

### Intent
- Partnership
- Collaboration
- Buying signal
- Hiring signal
- Expansion
- Funding
- Product launch
- RFP/procurement
- Technology adoption
- Cold outbound

Search results must show:

- Company
- Industry
- Location
- Website
- Company size
- Lead score
- Intent status
- Why Now score
- Intent evidence
- Relevant POCs
- Recommended next action

---

## 5. Intent Intelligence

Classify companies as:

**HOT** — strong recent evidence of active intent  
**WARM** — relevant signals but intent is not explicit  
**COLD** — ICP fit without active intent  
**INACTIVE** — insufficient current opportunity evidence

Every intent signal must show:

- Signal
- Source
- Date
- Evidence
- Confidence

Never fabricate intent.

Clearly distinguish:

**Verified information / AI inference / Unknown**

---

## 6. Lead Scoring + Why Now

Create explainable scores.

### Lead Score
Based on:

- ICP fit
- Industry
- Geography
- Company size
- Intent
- Recency
- Technology fit
- POC relevance
- Engagement

### Why Now Score

Explain why the company should be contacted now.

Example:

> Expansion +20  
> Relevant hiring +15  
> Active partnership signal +25

Every score must be explainable.

---

## 7. Signal → Action

Every important signal should generate a recommended action.

Example:

**Signal:** Company expanding into a new market  
**Why it matters:** Expansion may create new sales/partnership requirements  
**Recommended action:** Contact Head of Partnerships  
**Action:** Generate personalized outreach

This is a key SalesSetu differentiator.

---

## 8. Company Intelligence

Company profile should contain:

- Overview
- Products/services
- Industry
- Location
- Employees
- Recent developments
- Hiring
- Funding
- Partnerships
- Expansion
- Relevant technologies
- Intent signals
- Recommended sales angle
- POCs
- Relationship status
- Complete activity timeline

Timeline example:

> Lead discovered → Intent detected → POC identified → Outreach drafted → Outreach sent → Reply → Meeting booked → Meeting completed → MoM → Proposal → Deal update

This becomes the company's **Sales Memory**.

---

## 9. POC Intelligence

Identify multiple relevant contacts per company.

Group by:

- Partnerships
- Sales
- Business Development
- Marketing
- Technology
- Procurement
- Leadership

For each POC show:

- Name
- Role
- Department
- Seniority
- Profile
- Verified email status
- Location
- Why they are relevant
- Source
- Confidence

Never invent contact information.

---

## 10. AI Outreach

For every qualified lead generate:

- Email
- LinkedIn-style message
- Business message
- Call script
- Follow-up

Personalize using verified company/role/context.

Include:

- Subject
- Personalized opening
- Business relevance
- Value proposition
- CTA

Actions:

- Regenerate
- Shorten
- Formalize
- Make conversational
- Change CTA
- Copy
- Send

---

## 11. Personalization Quality Check

Before sending, AI should verify:

- Company reference
- POC relevance
- Business problem
- Value proposition
- CTA
- Unsupported claims
- Generic language

Show a quality score and warnings.

---

## 12. Human Approval

AI may research, score, draft, summarize and recommend automatically.

User approval is required before:

- Sending external communication
- Booking external meetings
- Making important deal-stage changes
- Sharing meeting notes externally

Create an **Approval Inbox** containing pending AI actions.

Actions:

**Approve / Edit / Reject**

---

## 13. Outreach Sequences

Allow multi-step sequences:

Example:

Day 0 — Initial outreach  
Day 3 — Follow-up  
Day 7 — Value-add message  
Day 12 — Final follow-up

Stop automatically when the prospect replies.

---

## 14. Gmail Integration

Prepare Gmail OAuth integration for:

- Sending
- Receiving
- Reply detection
- Contact/company association
- Meeting-intent detection
- Follow-up recommendations

If unavailable, use a realistic mock provider.

Clearly distinguish Demo Data from Live Data.

---

## 15. Google Calendar + Google Meet

Integrate Google Calendar.

AI should:

1. Detect meeting interest
2. Check availability
3. Suggest slots
4. Get user approval
5. Create Calendar event
6. Add attendees
7. Generate Google Meet link
8. Update company/contact/deal timeline

Meeting page should show:

- Company
- POC
- Date/time
- Duration
- Meet link
- Agenda
- Notes
- Status

---

## 16. Meeting Preparation

Before every meeting provide **Prepare Me**.

Generate:

- Company summary
- POC summary
- Previous interactions
- Why they agreed to meet
- Likely requirements
- Relevant product capabilities
- Discovery questions
- Potential objections
- Suggested next step

---

## 17. Post-Meeting Workflow

After the meeting ask:

- How did it go?
- What was discussed?
- Main customer requirement?
- Pain points?
- Objections?
- What did they request?
- What is the next step?
- Deal status?
- Follow-up date?

Deal status:

- Won
- Strong opportunity
- Follow-up required
- Proposal required
- Negotiation
- Lost
- Not qualified

---

## 18. AI MoM

Generate:

- Meeting details
- Objective
- Executive summary
- Key discussion points
- Customer requirements
- Pain points
- Objections
- Decisions
- Commercial discussion
- Action items
- Owners
- Deadlines
- Next steps
- Deal status
- Follow-up date

Actions:

**Edit / Regenerate / Copy / Export / Email / Save**

---

## 19. Pipeline

Create Kanban stages:

**New Lead → Qualified → Contacted → Engaged → Meeting Scheduled → Meeting Completed → Proposal → Negotiation → Won/Lost → Nurture**

Each deal shows:

- Company
- POC
- Value
- Probability
- Stage
- Last activity
- Next action
- Follow-up date
- Owner

Support drag-and-drop.

---

## 20. Deal Intelligence

For every deal show:

### Deal Health
Healthy / Needs Attention / At Risk / Stale

### Why

Example:

> "No activity recorded for 12 days."

### Next Best Action

Every deal must have one clear recommended next action.

Examples:

- Contact POC
- Send follow-up
- Schedule meeting
- Send proposal
- Ask for decision
- Move to nurture

---

## 21. AI Sales Copilot

Provide a persistent AI assistant.

Example commands:

> "Find SaaS companies in Bangalore with active partnership intent."

> "Research this company."

> "Find the right POC."

> "Draft outreach."

> "Prepare me for today's meetings."

> "Which deals need attention?"

> "What should I do today?"

> "Generate follow-ups."

> "Summarize my pipeline."

The AI should use SalesSetu's structured data and relationship history as context.

---

## 22. AI Daily Brief

Dashboard should show:

- Today's meetings
- Priority follow-ups
- High-intent leads
- At-risk deals
- Overdue tasks
- Recommended outreach
- Top 5 actions for today

Also provide an end-of-day summary.

---

## 23. Follow-up Engine

Detect:

- No-response prospects
- Meetings needing follow-up
- Proposals awaiting response
- Stale deals
- Overdue tasks

AI recommends:

- What to send
- When to send it
- Why
- Channel

---

## 24. Feedback Loop

After lead/outreach/meeting/deal outcomes capture:

- Was lead relevant?
- Was POC correct?
- Was outreach useful?
- Was intent accurate?
- Was meeting productive?
- Was deal won/lost?

Use this feedback to improve future recommendations inside the application.

---

## 25. Analytics

Show:

- Leads generated
- Qualified leads
- Qualification rate
- Outreach sent
- Response rate
- Positive response rate
- Meetings
- Meeting conversion
- Proposals
- Win rate
- Sales cycle
- Pipeline value
- Revenue
- Intent distribution

AI insights must be based on actual application data.

---

## 26. Additional Features

Include where practical:

- Global search
- Saved searches
- Duplicate detection
- CSV export
- Tasks
- Objection library
- Sales playbooks
- Outreach templates
- Meeting templates
- Recurring lead searches
- Company relationship history
- AI recommendations
- Notifications

---

## 27. Agent Architecture

Do not build one giant AI prompt.

Create modular agents/services:

- Lead Research Agent
- Intent Agent
- Contact Intelligence Agent
- Qualification Agent
- Outreach Agent
- Follow-up Agent
- Meeting Agent
- Meeting Intelligence Agent
- Deal Intelligence Agent
- Sales Copilot

Use a shared AI service layer.

---

## 28. Gemini Architecture

Create an AI provider abstraction.

Functions:

- researchCompany()
- detectIntent()
- qualifyLead()
- identifyPOC()
- generateOutreach()
- generateFollowUp()
- generateMeetingBrief()
- generateMoM()
- analyzeDeal()
- generateNextBestAction()
- generateSalesInsights()

Keep `GEMINI_API_KEY` server-side.

---

## 29. Data Architecture

Use PostgreSQL + Prisma or equivalent.

Core entities:

- User
- SalesContext
- ICP
- Company
- Contact
- Lead
- IntentSignal
- Outreach
- OutreachSequence
- Email
- Meeting
- MeetingNote
- MeetingMoM
- Deal
- Task
- Activity
- CalendarEvent
- Approval
- AIRecommendation
- Integration
- SavedSearch
- Feedback
- SalesPlaybook

---

## 30. Provider Abstraction

Create interfaces for:

- LeadProvider
- ContactProvider
- CompanyResearchProvider
- EmailProvider
- CalendarProvider
- MeetingProvider
- AIProvider

Implement both:

- Mock providers
- Real providers

The entire demo must work without external API credentials.

---

## 31. Demo Mode

Seed realistic synthetic data:

- 30+ companies
- 60+ contacts
- Multiple Indian cities
- Multiple industries
- Different intent levels
- Leads
- Emails
- Meetings
- Deals
- Tasks
- Follow-ups
- Activity timelines

Clearly label simulated data.

---

## 32. Core Demo Journey

The complete 5–10 minute demo should work:

1. User defines ICP.
2. User searches for SaaS companies in Bangalore.
3. AI finds and scores companies.
4. Results show intent + Why Now + evidence.
5. User opens a company.
6. AI recommends the right POC.
7. AI generates personalized outreach.
8. Personalization checker validates it.
9. User approves.
10. Demo simulates a positive response.
11. AI detects meeting intent.
12. AI proposes Calendar slots.
13. User approves.
14. Calendar + Google Meet event is created.
15. AI generates meeting preparation.
16. User enters meeting notes.
17. AI generates MoM.
18. Deal stage updates.
19. AI recommends the Next Best Action.

The entire flow must update the company/contact/deal timeline.

---



---

## 29. GOOGLE SHEETS INTEGRATION

Integrate **Google Sheets API** as a persistent operational data/export layer.

Do not use Google Sheets as the only application database. SalesSetu should continue using PostgreSQL for application state, while important sales records are synchronized to the user's connected Google Sheet.

### Connection

Create:

**Settings → Integrations → Google Sheets**

Support:

- Google OAuth
- Connect Google account
- Select an existing spreadsheet
- Create a new SalesSetu spreadsheet
- Disconnect/reconnect
- Show connection status
- Show last successful sync

Never expose OAuth credentials or access tokens to the frontend.

### Default Spreadsheet Structure

When a new SalesSetu spreadsheet is created, automatically create these tabs:

1. `Companies`
2. `Contacts`
3. `Leads`
4. `Intent Signals`
5. `Outreach`
6. `Meetings`
7. `Meeting MoM`
8. `Deals`
9. `Tasks`
10. `Activity Log`

Use consistent headers and stable unique IDs.

### Companies Sheet

Columns:

- Company ID
- Company Name
- Website
- Industry
- Country
- State
- City
- Employee Count
- Revenue
- Funding Stage
- Lead Score
- Why Now Score
- Intent Status
- Relationship Status
- Recommended Action
- Source
- Last Updated

### Contacts Sheet

Columns:

- Contact ID
- Company ID
- Company
- Name
- Designation
- Department
- Seniority
- Email
- Email Verification
- Phone
- Profile
- Relevance Reason
- Confidence
- Source
- Last Updated

### Leads Sheet

Columns:

- Lead ID
- Company ID
- Contact ID
- Company
- Contact
- Lead Score
- Why Now Score
- Intent
- Lead Status
- Current Stage
- Next Best Action
- Follow-up Date
- Owner
- Created At
- Updated At

### Intent Signals Sheet

Columns:

- Signal ID
- Company ID
- Company
- Signal Type
- Description
- Source
- Source URL where available
- Detected Date
- Confidence
- Status
- Created At

### Outreach Sheet

Columns:

- Outreach ID
- Company ID
- Contact ID
- Company
- Contact
- Channel
- Subject
- Message
- Sequence
- Step
- Status
- Approval Status
- Sent At
- Response Status
- Next Follow-up
- Created At

### Meetings Sheet

Columns:

- Meeting ID
- Company ID
- Contact ID
- Company
- Contact
- Date
- Time
- Duration
- Calendar Event ID
- Google Meet Link
- Agenda
- Status
- Outcome
- Follow-up Date
- Created At

### Meeting MoM Sheet

Columns:

- MoM ID
- Meeting ID
- Company
- Contact
- Date
- Objective
- Summary
- Requirements
- Pain Points
- Objections
- Decisions
- Action Items
- Next Steps
- Deal Status
- Follow-up Date
- Created At

### Deals Sheet

Columns:

- Deal ID
- Company ID
- Contact ID
- Company
- Contact
- Deal Name
- Deal Value
- Probability
- Stage
- Deal Health
- Risk Reason
- Next Best Action
- Next Follow-up
- Owner
- Created At
- Updated At

### Tasks Sheet

Columns:

- Task ID
- Title
- Company
- Contact
- Deal
- Priority
- Due Date
- Status
- Owner
- Created At
- Completed At

### Activity Log Sheet

Record major SalesSetu events:

- Activity ID
- Timestamp
- Company
- Contact
- Deal
- Activity Type
- Description
- Source
- User/AI
- Related Record ID

Examples:

- Lead discovered
- Intent detected
- POC identified
- Outreach drafted
- Outreach approved
- Email sent
- Reply received
- Meeting booked
- Meeting completed
- MoM generated
- Deal stage changed
- Follow-up created

### Synchronization

Implement a Google Sheets service/provider abstraction:

`GoogleSheetsProvider`

with functions such as:

- connect()
- createSpreadsheet()
- createSheets()
- initializeHeaders()
- upsertCompany()
- upsertContact()
- upsertLead()
- upsertIntentSignal()
- upsertOutreach()
- upsertMeeting()
- upsertMoM()
- upsertDeal()
- upsertTask()
- appendActivity()
- syncAll()
- importLeads()
- getSyncStatus()

Use stable record IDs to perform **upserts rather than blindly appending rows**.

This prevents duplicate records.

### Sync Behavior

Important SalesSetu actions should automatically sync to Google Sheets.

Examples:

**Lead discovered**
→ Add/update Lead + Company

**POC identified**
→ Add/update Contact

**Intent signal detected**
→ Add Intent Signal

**Outreach approved/sent**
→ Update Outreach

**Meeting booked**
→ Update Meeting

**Meeting completed**
→ Update Meeting + MoM

**Deal stage changed**
→ Update Deal

**Task created/completed**
→ Update Task

Every record should retain its SalesSetu ID so changes can be reconciled.

### Sync Controls

Add:

**Sync Now**

**Auto Sync: ON/OFF**

**Last Synced: timestamp**

**Sync Status: Connected / Syncing / Synced / Error**

If synchronization fails, do not lose the SalesSetu data. Queue the update and retry.

### Google Sheets → SalesSetu

Allow optional lead import from a Google Sheet.

Example:

User connects an existing sheet containing:

- Company
- Website
- Industry
- Location
- Contact
- Email

SalesSetu should import those rows and run:

**Enrichment → Intent Detection → Lead Scoring → POC Verification → Recommended Action**

Do not overwrite existing records without confirmation.

### Spreadsheet Actions

On relevant pages provide:

- Export to Google Sheets
- Open in Google Sheets
- Sync Now
- Import from Google Sheets

### Demo Mode

If Google OAuth is unavailable, provide a mock Google Sheets provider.

The demo should simulate:

> "20 leads synced to Google Sheets"

and show the expected spreadsheet structure inside the application.

Clearly label this as **Demo Mode**.

### Important Architecture Principle

Use:

**PostgreSQL = application source of truth**

**Google Sheets = user-accessible operational mirror / export / lightweight collaboration layer**

Do not make the application dependent on Google Sheets being available.


## 34. Technical Requirements

Suggested stack:

- Next.js
- React
- TypeScript
- Tailwind CSS
- PostgreSQL
- Prisma
- Google Gemini API
- Google Calendar API
- Gmail API
- Google Workspace / Meet
- Secure OAuth

Suggested structure:

`/app /components /features /services /agents /integrations /db /types /api`

Keep UI, business logic, agents, integrations and data access modular.

---

## 35. Security + Reliability

- Never expose API keys or OAuth secrets.
- Scope data to the authenticated account.
- Handle API failures gracefully.
- Provide loading, empty and error states.
- Never fabricate contacts, intent, company information or sources.
- Clearly distinguish live vs demo data.
- Do not expose hidden chain-of-thought; only show concise evidence and user-facing rationale.

---

## 36. Build Priority

Prioritize this workflow above everything else:

**Lead Discovery → Intent → Company → POC → Outreach → Approval → Meeting → MoM → Deal → Next Best Action**

Do not build disconnected placeholder screens.

Every major button should work.

The final result should feel like a real SaaS MVP that can be demonstrated to a recruiter or product manager in 5–10 minutes.

## Final Positioning

**SalesSetu**  
### AI Sales Operating System

> **Find the right prospects. Reach the right people. Move every opportunity forward.**
