Testing audit was previously generated in the Antigravity conversation but has not yet been exported into the repository.

## Confirmed Implementation Gaps

### 1. Integrations are presented as connected without working connections
- **Issue:** The integrations page displays integrations as connected, but the inspected page does not implement connection or management actions.
- **Evidence:** Integration statuses and last-sync labels are hard-coded; Connect/Manage buttons do not invoke integration APIs. The Google Sheets panel's Open Spreadsheet button has no action.
- **Relevant files:** `frontend/src/app/(dashboard)/integrations/page.tsx`
- **Specification requirement affected:** Integrations should support connection, status, sync controls, and working relevant actions; simulated integrations should be clearly labeled as demo data.

### 2. Google Sheets persistence and reliability do not meet the specification
- **Issue:** The Sheets integration lacks the specified operational mirror behavior and sync reliability controls.
- **Evidence:** The service persists records to `backend/data/sheets_store.json`, optionally sends webhook `APPEND`/`UPDATE` requests, and logs webhook failures without queuing or retrying them. It handles only Leads, Deals, Meetings, and Outreach; the specified record tabs, stable-ID upserts, and sync status controls are not implemented in this service.
- **Relevant files:** `backend/src/services/sheets.service.ts`, `backend/src/routes/sheets.routes.ts`, `backend/data/sheets_store.json`, `frontend/src/app/(dashboard)/integrations/page.tsx`
- **Specification requirement affected:** PostgreSQL remains application source of truth while Sheets is a synchronized mirror; the specification also requires the listed tabs, stable-ID upserts, queued retries, sync controls, and status.

### 3. Lead Discovery query behavior (previous gap resolved)
- **Status:** The stale finding that Lead Discovery was disconnected from live search is resolved.
- **Current behavior:** `GET /api/leads` supports the existing filters. Supported natural-language-style terms are parsed into industry, city, and `HOT`/`WARM`/`COLD` intent filters; unrecognized terms remain literal search text.
- **Verification:** `SaaS companies in Bangalore` was verified in the browser to return a matching stored lead. `raising funds` is not currently interpreted as a funding signal and remains a literal search term.
- **Relevant files:** `backend/src/routes/leads.routes.ts`, `backend/src/services/lead-search.service.ts`, `frontend/src/app/(dashboard)/leads/page.tsx`, `frontend/src/lib/api.ts`
- **Specification requirement affected:** Lead Discovery should support the specified filters and return search results with company, intent evidence, scores, POCs, and recommended actions.

### 4. Missing Gemini credentials produce canned output without clear demo/live labeling
- **Issue:** AI endpoints return preset results when `GEMINI_API_KEY` is missing, without those responses being clearly labeled as simulated.
- **Evidence:** `parseICPQuery`, `draftPersonalizedEmail`, and `extractMoM` return canned data in their no-key branches. The AI route responses do not add a demo/live indicator.
- **Relevant files:** `backend/src/services/gemini.service.ts`, `backend/src/routes/ai.routes.ts`
- **Specification requirement affected:** Demo mode must be clearly distinguished from live data; information must not be fabricated or presented as verified.

### 5. PostgreSQL is declared but is not the application's active source of truth
- **Issue:** PostgreSQL/Prisma is declared in the repository, but the inspected active API persistence path uses the local JSON Sheets service.
- **Evidence:** The Sheets routes call `GoogleSheetsService`; that service reads and writes `backend/data/sheets_store.json`. The inspected server does not initialize or call Prisma. The backend schema declares a PostgreSQL datasource, but that schema is not used by these routes.
- **Relevant files:** `backend/src/server.ts`, `backend/src/routes/sheets.routes.ts`, `backend/src/services/sheets.service.ts`, `backend/prisma/schema.prisma`
- **Specification requirement affected:** PostgreSQL is specified as the application source of truth, with Google Sheets as a user-accessible mirror/export layer rather than the only application datastore.
