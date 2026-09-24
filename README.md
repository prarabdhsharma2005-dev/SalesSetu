# SalesSetu — AI Sales Operating System

> **Tagline:** *Bridge every sales opportunity from lead to deal.*

SalesSetu is an end-to-end, AI-powered Sales Operating System designed for founders, sales leaders, BDRs, and SDRs. It automates lead discovery, intent detection, personalized outreach, meeting intelligence (MoM), deal pipelines, and follow-ups.

---

## 📁 Repository Structure

```
SalesSetu/
├── start.ps1                  # 🚀 1-Click launcher script for Frontend + Backend
├── FUTURE_ENHANCEMENTS.md     # Architectural & product roadmap
├── SalesSetu_Antigravity_Prompt.md # Original build specifications
│
├── frontend/                  # Next.js 15 (React 19) Dashboard UI
│   ├── src/app/(dashboard)/   # 14 Integrated sales modules
│   ├── src/components/        # Modern B2B SaaS UI components
│   ├── src/lib/               # Demo datasets & client helpers
│   ├── .env.local             # Frontend environment settings
│   └── package.json           # Dependencies (Pre-installed)
│
└── backend/                   # Node.js + Express + TypeScript API Service
    ├── src/server.ts          # Express API server (Port 5000)
    ├── src/services/          # Google Gemini AI & Google Sheets services
    ├── src/routes/            # API endpoints (/api/ai, /api/sheets, /api/leads, /api/pipeline)
    ├── data/                  # Local Google Sheets fallback store
    ├── google-apps-script.js  # Ready-to-deploy script for Google Sheets sync
    └── .env                   # Backend environment settings
```

---

## ⚡ How to Run the Project

### Option A: 1-Click Launch (Recommended)
Open PowerShell in the `SalesSetu` root folder and run:
```powershell
.\start.ps1
```
*This automatically starts the backend on port 5000 and the frontend on port 3000 in separate windows.*

---

### Option B: Manual Launch (Two Terminals)

#### Terminal 1 — Backend API:
```powershell
cd backend
npm install
npm run dev
```
*Backend runs at: [http://localhost:5000](http://localhost:5000)*
- Health & Storage Check: [http://localhost:5000/health](http://localhost:5000/health)

#### Terminal 2 — Frontend Application:
```powershell
cd frontend
npm run dev
```
*Frontend runs at: [http://localhost:3000](http://localhost:3000)*

---

## 📊 Google Sheets Data Integration

SalesSetu uses **Google Sheets as its primary datastore** without requiring any SQL database:

1. **Out-of-the-Box Mode (Default):**
   SalesSetu automatically saves and reads leads, deals, meetings, and outreach using the local sheets store at `backend/data/sheets_store.json`.

2. **Live Google Sheet Sync (1-Click):**
   - Create a spreadsheet at [sheets.new](https://sheets.new) with 4 tabs: `Leads`, `Deals`, `Meetings`, `Outreach`.
   - Open **Extensions → Apps Script**, paste `backend/google-apps-script.js`, and click **Deploy as Web App**.
   - Paste the Web App URL into `backend/.env` under `GOOGLE_SHEETS_WEBHOOK_URL` (or paste it directly in the **Integrations** tab in the web UI).

---

## 🔑 How to Generate API Keys & Credentials

### 1. Google Gemini API Key (Free)
SalesSetu uses Google's `gemini-2.5-flash` model for outbound email drafting, natural language ICP query parsing, and MoM (Minutes of Meeting) extraction.

1. Go to **[Google AI Studio](https://aistudio.google.com/)**.
2. Sign in with your standard Google account.
3. Click the blue **"Get API key"** button on the left sidebar (or top right).
4. Click **"Create API key"** → select **"Create API key in new project"** (or choose an existing Google Cloud project).
5. Copy the generated key (starts with `AIzaSy...`).
6. **Usage:**
   - **Local development:** Paste into `backend/.env` as `GEMINI_API_KEY="AIzaSy..."`
   - **Render deployment:** Add as an Environment Variable `GEMINI_API_KEY` in the `salessetu-backend` service.

---

### 2. Google Sheets Integration Key / Webhook (No GCP Billing Required)
SalesSetu connects directly to Google Sheets via a Google Apps Script Web App webhook. This requires **no Google Cloud Console billing, no service accounts, and no complex OAuth setup**.

#### Step-by-Step Setup:
1. Open your browser and go to **[sheets.new](https://sheets.new)** to create a new spreadsheet.
2. Rename the spreadsheet to `SalesSetu Datastore`.
3. Create 4 tabs at the bottom with the following exact names:
   - `Leads`
   - `Deals`
   - `Meetings`
   - `Outreach`
4. Add the following header columns to **Row 1** of each tab:
   - **Leads:** `ID` | `Company` | `Website` | `Industry` | `Country` | `City` | `Employees` | `Intent Signal` | `Lead Score` | `Status` | `Created At`
   - **Deals:** `ID` | `Title` | `Company` | `Stage` | `Value` | `Probability` | `Health` | `Next Action` | `Created At`
   - **Meetings:** `ID` | `Title` | `Company` | `Date` | `Attendees` | `Summary` | `Action Items` | `Sentiment`
   - **Outreach:** `ID` | `Prospect Name` | `Email` | `Company` | `Subject` | `Body` | `Status` | `Sent At`
5. In the top menu of Google Sheets, click **Extensions** → **Apps Script**.
6. Delete any existing code in the script editor and paste the full contents of [`backend/google-apps-script.js`](file:///c:/Users/HP/OneDrive/Desktop/SalesSetu/backend/google-apps-script.js).
7. Click the blue **Deploy** button (top right) → **New deployment**.
8. Click the gear icon ⚙️ next to "Select type" and choose **Web app**.
9. Fill in the deployment form:
   - **Description:** `SalesSetu API Webhook`
   - **Execute as:** `Me (your-email@gmail.com)`
   - **Who has access:** `Anyone` *(⚠️ Required so the Render backend can send HTTP POST requests)*
10. Click **Deploy**. When prompted, click **Authorize access**, select your Google account, click **Advanced**, and then click **Go to Untitled project (unsafe)** → **Allow**.
11. Copy the **Web App URL** (looks like: `https://script.google.com/macros/s/AKfycb.../exec`).
12. **Usage:**
    - **Local development:** Paste into `backend/.env` as:
      `GOOGLE_SHEETS_WEBHOOK_URL="https://script.google.com/macros/s/AKfycb.../exec"`
    - **Render deployment:** Add as an Environment Variable `GOOGLE_SHEETS_WEBHOOK_URL` in the `salessetu-backend` service.

*(Optional)* You can also copy the **Spreadsheet ID** from your Google Sheet URL (`https://docs.google.com/spreadsheets/d/`**`YOUR_SHEET_ID_HERE`**`/edit`) and add it as `GOOGLE_SHEET_ID`.

---

### 3. Gmail, Google Calendar & Google Meet Integration

SalesSetu connects with Google Workspace services to automate outbound cold emails (Gmail), schedule prospect demo calls (Google Calendar), and auto-create video conference links with AI transcriptions (Google Meet).

#### Step 1: Create a Google Cloud Project & Enable APIs
1. Go to the **[Google Cloud Console](https://console.cloud.google.com/)**.
2. Click the project dropdown (top left) and click **"New Project"**. Name it `SalesSetu-Workspace`.
3. In the top search bar, enable the following three APIs one by one:
   - **Gmail API** → Click **Enable**.
   - **Google Calendar API** → Click **Enable**.
   - **Google Meet API** → Click **Enable**.

#### Step 2: Configure the OAuth Consent Screen
1. In the left navigation menu, go to **APIs & Services** → **OAuth consent screen**.
2. Choose **External** (or **Internal** if using a Google Workspace company domain) and click **Create**.
3. Fill in:
   - **App name:** `SalesSetu`
   - **User support email:** Your email
   - **Developer contact information:** Your email
4. Click **Save and Continue**.
5. On the **Scopes** page, click **Add or Remove Scopes** and select:
   - `.../auth/gmail.send` *(To dispatch personalized cold emails)*
   - `.../auth/gmail.readonly` *(To track replies and open threads)*
   - `.../auth/calendar` and `.../auth/calendar.events` *(To book demo meetings and read calendars)*
6. Click **Save and Continue**, add your own email as a **Test User**, and finish.

#### Step 3: Create OAuth 2.0 Client ID Credentials
1. Go to **APIs & Services** → **Credentials**.
2. Click **+ Create Credentials** → **OAuth client ID**.
3. Set **Application type:** `Web application`.
4. Name: `SalesSetu Client`.
5. Under **Authorized redirect URIs**, add:
   - For local development: `http://localhost:5000/api/auth/google/callback` and `http://localhost:3000/api/auth/callback/google`
   - For Render deployment: `https://salessetu-backend.onrender.com/api/auth/google/callback` and `https://salessetu-frontend.onrender.com/api/auth/callback/google`
6. Click **Create** and copy your **Client ID** and **Client Secret**.

#### Step 4: Quick Alternative for Gmail Outbound (SMTP App Password)
If you just want SalesSetu to dispatch cold outreach emails directly from your Gmail without OAuth screens:
1. Go to your **[Google Account Security Settings](https://myaccount.google.com/security)**.
2. Ensure **2-Step Verification** is turned ON.
3. Search for **"App passwords"** in the top search bar.
4. Name it `SalesSetu Outreach` and click **Create**.
5. Copy the 16-character password and set in `backend/.env`:
   ```env
   GMAIL_USER="your-email@gmail.com"
   GMAIL_APP_PASSWORD="xxxx xxxx xxxx xxxx"
   ```

#### Step 5: Google Meet Integration
When scheduling calls through the Google Calendar API, SalesSetu automatically creates a Google Meet room by including `conferenceDataVersion: 1` and `conferenceData: { createRequest: { requestId: 'salessetu-' + Date.now(), conferenceSolutionKey: { type: 'hangoutsMeet' } } }`. The generated `meet.google.com/xxx-xxxx-xxx` link is attached directly to the prospect's invite and synced to your `Meetings` sheet tab.

---

## 🐙 Pushing to GitHub

Before deploying to Render, push your project to a GitHub repository:

### Method A: Using Git CLI
1. Open PowerShell in the project root:
   ```powershell
   git init
   git add .
   git commit -m "Initial commit of SalesSetu AI Sales OS"
   git branch -M main
   ```
2. Go to **[github.com/new](https://github.com/new)** and create a new repository named `SalesSetu` (leave it public or private).
3. Link and push your local code:
   ```powershell
   git remote add origin https://github.com/YOUR_USERNAME/SalesSetu.git
   git push -u origin main
   ```

### Method B: Using GitHub Desktop or VS Code / IDE
- **VS Code / Antigravity IDE:** Click the **Source Control** icon on the left sidebar (or press `Ctrl+Shift+G`) → click **"Publish to GitHub"**.
- **GitHub Desktop:** Open GitHub Desktop → **File** → **Add Local Repository** → select `c:\Users\HP\OneDrive\Desktop\SalesSetu` → click **"Publish repository"**.

*(Note: The root `.gitignore` already protects your `.env` secret keys and excludes `node_modules` and build directories from being pushed).*

---

## ☁️ Deploying to Render

SalesSetu can be deployed to Render using either **Render Blueprints (1-Click)** or **Manual Web Services**.

### Option 1: Render Blueprints (Recommended)
1. Push this repository to GitHub.
2. In the [Render Dashboard](https://dashboard.render.com/), click **New +** → **Blueprint**.
3. Connect your repository. Render will automatically read [`render.yaml`](file:///c:/Users/HP/OneDrive/Desktop/SalesSetu/render.yaml) and configure both services.
4. Supply your environment variables (`GEMINI_API_KEY`, `GOOGLE_SHEETS_WEBHOOK_URL`) and click **Apply**.

### Option 2: Manual Web Services on Render

#### Step 1: Deploy Backend (`salessetu-backend`)
- **Type:** Web Service
- **Root Directory:** `backend`
- **Environment:** Node
- **Build Command:** `npm install && npm run build`
- **Start Command:** `npm start`
- **Environment Variables:**
  - `PORT`: `5000` (or leave default assigned by Render)
  - `NODE_VERSION`: `20`
  - `FRONTEND_URL`: `https://salessetu-frontend.onrender.com` (your frontend service URL)
  - `GEMINI_API_KEY`: *(Your Google AI Studio API key)*
  - `GOOGLE_SHEETS_WEBHOOK_URL`: *(Your Google Apps Script Web App URL)*

#### Step 2: Deploy Frontend (`salessetu-frontend`)
- **Type:** Web Service
- **Root Directory:** `frontend`
- **Environment:** Node
- **Build Command:** `npm install && npm run build`
- **Start Command:** `npm start`
- **Environment Variables:**
  - `NODE_VERSION`: `20`
  - `NEXT_PUBLIC_BACKEND_URL`: `https://salessetu-backend.onrender.com` (from Step 1)
  - `NEXT_PUBLIC_DEMO_MODE`: `true`
  - `NEXTAUTH_SECRET`: `salessetu_render_secret_key_98765`
  - `NEXTAUTH_URL`: `https://salessetu-frontend.onrender.com`

