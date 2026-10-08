# SalesSetu deployment and operating contract

## Supported architecture

Create **two Vercel projects** from this repository. `frontend/` is Next.js; `backend/` exports Express from `src/app.ts` as one Vercel Function. Local `npm run dev` and `npm start` still use `src/local-server.ts`. Production uses PostgreSQL; local development retains the existing JSON store when `DATABASE_URL` is absent. No live data is migrated automatically. Prisma remains inactive and Google Sheets stays an optional best-effort mirror. The old `render.yaml` is a legacy blueprint, not this deployment path.

PostgreSQL holds the complete existing collection document in a versioned JSONB row: leads, deals, meetings, MoMs, tasks, outcomes, applications/audit records, outreach, revisions, delivery attempts, sequences and idempotency IDs. Each write uses a row lock and expected version in a transaction; stale concurrent writes fail instead of overwriting records. Gmail token envelopes and one-use OAuth states have separate PostgreSQL tables. Cron uses a time-bounded database lease. This coarse snapshot means unrelated concurrent edits can conflict and require reload; it does not provide multi-user tenancy. Preserve encrypted database backups.

## Vercel frontend project

Current project URL: `https://salessetu-web.vercel.app`. The backend origin for `BACKEND_URL` is `https://sales-setu-seven.vercel.app`.

- Root directory `frontend`; framework **Next.js**; Node.js **22.x**; install `npm ci`; build `npm run build`; default output.
- Set server-only `BACKEND_URL=https://YOUR-BACKEND.vercel.app` (origin only), plus `APP_ACCESS_USER` and `APP_ACCESS_PASSWORD` (24+ characters). The access values must match the backend. Set `NEXT_PUBLIC_DEMO_MODE=false` if you want the UI to label demo sections accordingly. Do not put credentials in `NEXT_PUBLIC_` variables.
- Existing `/api/backend/*` rewrite targets the backend origin. Test authenticated proxy health and a read-only API after deployment. External proxy requests have Vercel's 120-second limit; browser AI requests remain bounded at 60 seconds.
- Production and preview deployments must use separate backend/database/access credentials; do not point public previews at production user records.

## Vercel backend project

Current project URL: `https://sales-setu-seven.vercel.app`. Set `FRONTEND_URL=https://salessetu-web.vercel.app`. The committed `backend/vercel.json` pins the Express preset; `src/app.ts` exports the Vercel app and `src/local-server.ts` is only for local scripts. `package.json` points `main` to `dist/app.js`, while `npm start` still runs the local listener. Do not select `src/server.ts` or `dist/server.js` as a Vercel entry point.

- Root directory `backend`; framework **Express** (or auto-detected Node); Node.js **22.x**; install `npm ci`; build `npm run build`; no custom output directory. Vercel detects the default Express export at `src/app.ts`; it must not run `npm start` or an interval worker. `backend/vercel.json` limits the function to 120 seconds and defines no cron schedule initially.
- Required production environment: `DATABASE_URL` (Neon pooled PostgreSQL connection URL), `FRONTEND_URL=https://YOUR-FRONTEND.vercel.app` (exact origin), `APP_ACCESS_USER`, `APP_ACCESS_PASSWORD` (same as frontend), `GEMINI_API_KEY`, `TAVILY_API_KEY`, and `FOLLOW_UP_SCHEDULER_ENABLED=false`. Vercel sets `NODE_ENV=production`; set it explicitly if your project does not. `PORT`, `DATA_DIR`, and `SINGLE_INSTANCE` are not used by the Vercel function. Do not set a production connection string in the local server process if you intend to retain local JSON mode.
- Optional: `GOOGLE_SHEETS_WEBHOOK_URL`, `GOOGLE_SHEET_ID`, `SALES_SENDER_NAME`, `SALES_SENDER_COMPANY`; leave the webhook unset for isolated verification. Gmail additionally requires `GMAIL_OAUTH_CLIENT_ID`, `GMAIL_OAUTH_CLIENT_SECRET`, `GMAIL_OAUTH_REDIRECT_URI`, and `GMAIL_TOKEN_ENCRYPTION_KEY` (base64 of 32 bytes). Store secrets only in Vercel environment settings.
- `/health` checks that the PostgreSQL snapshot is readable and returns 503 before migration. API paths require the shared Basic credential. Cross-origin writes are refused. The Google OAuth callback is public but guarded by a one-use state stored in PostgreSQL.

## Explicit local-data migration

1. Provision Neon PostgreSQL and keep its pooled `DATABASE_URL` private in `backend/.env` for local migration commands and in the backend Vercel project for deployment. From `backend/`, run `npm ci`, `npm run build`, then `npm run db:prepare-schema`. This command transactionally creates only the five SalesSetu tables and index; a repeat verifies their shape, and a partial/conflicting schema is refused. It imports no records or Gmail tokens. In Neon SQL Editor, confirm counts before importing: `SELECT (SELECT count(*) FROM salesetu_state) AS application_rows, (SELECT count(*) FROM salesetu_gmail_tokens) AS gmail_token_rows, (SELECT count(*) FROM salesetu_migrations) AS import_markers, (SELECT count(*) FROM salesetu_oauth_states) AS oauth_state_rows;`. An empty application store makes production `/health` return 503 until an explicit import.
2. When ready to import, make a private backup outside the repository and record its checksum. In PowerShell from `backend/`:

   ```powershell
   $backupDirectory = Join-Path $env:USERPROFILE 'SalesSetu-private-backups'
   New-Item -ItemType Directory -Path $backupDirectory -Force | Out-Null
   $backupPath = Join-Path $backupDirectory ("sheets_store-{0}.json" -f (Get-Date -Format 'yyyyMMdd-HHmmss'))
   Copy-Item -LiteralPath 'data/sheets_store.json' -Destination $backupPath
   Get-FileHash -LiteralPath $backupPath -Algorithm SHA256
   npm run db:migrate-local -- --source $backupPath
   ```

   The dry run validates the known collections and prints counts/checksum without connecting to the database. Keep the backup private and never commit it.
3. To include an existing encrypted Gmail connection, add `--gmail-token "ABSOLUTE_PATH_TO_GMAIL_OAUTH_ENC"`, set the **existing** `GMAIL_TOKEN_ENCRYPTION_KEY`, and set the production `APP_ACCESS_USER`. The tool decrypts and re-encrypts for that operator without printing tokens. Otherwise reconnect Gmail after deployment.
4. Confirm the selected `DATABASE_URL` points to the intended Neon database, then run `npm run db:migrate-local -- --source $backupPath --apply` from the same PowerShell session. The importer validates the schema and imports the snapshot and optional token in one transaction. It refuses to overwrite an existing store. Repeating the identical source is a no-op; a different checksum is refused. Do not run `--apply` without an operator-reviewed backup and destination.
5. Set the same `DATABASE_URL` in the backend Vercel project and confirm `/health` only after the import. The repository never seeds production leads.

## Scheduled follow-ups

The local interval scheduler remains available through `src/local-server.ts`; Vercel never starts it. Vercel uses `GET /api/cron/follow-ups`, which requires `Authorization: Bearer <CRON_SECRET>` with `CRON_SECRET` at least 32 characters. Keep `FOLLOW_UP_SCHEDULER_ENABLED=false` and leave `crons` absent from `backend/vercel.json` initially. To enable after review, set the flag to `true`, set `CRON_SECRET`, and add a Vercel cron entry for `/api/cron/follow-ups`. On Hobby, the schedule can run **at most once per day**, at any point within the selected hour; this cannot provide precise or frequent follow-up delivery. The endpoint generates saved drafts only and never sends email automatically. Vercel's function duration still limits each run; review results and re-run safely if work remains. `/api/sheets/follow-up-sequences/process-due` stays disabled in production.

## Workflow semantics

- New cadence: days 0, 3, 7, 12. Legacy offsets are preserved. UTC elapsed-day calculation; browser displays local time.
- New Gmail email sequences anchor to the initial message's **confirmed SENT timestamp**. Older sequences without an anchor policy retain the historical DELIVERY_READY scheduling marker, which is never proof of sending. Unknown recipient email cannot be invented.
- Generation creates DRAFT only. New Gmail sequences require a confirmed SENT predecessor; legacy sequences retain their DELIVERY_READY predecessor rule. Paused/terminal sequences cannot generate or advance. Human approval, qualification and NEEDS REVIEW acknowledgement remain required.
- A meeting links a sequence by matching outreach/lead/POC IDs. The user selects explicitly even if only one is compatible. No company-name matching.
- Outcome proposes PAUSED, STOPPED or MEETING_BOOKED; review captures meeting/sequence versions. The user sees a preview and explicitly confirms application. MEETING_BOOKED requires a scheduled meeting. Application is audited/idempotent; stale requests fail. Meeting completion never reactivates a sequence.
- NBA priority: missing/blocked qualification → overdue tasks → draft approvals → upcoming meetings (7 days) → MoM/outcomes awaiting review/application → due eligible cadence → recorded deal next action. Equal priorities sort by stable record ID. Recommendations are suggestions, never executed automatically. Ambiguous task date text has no assumed deadline; date-only values use UTC calendar dates.

## Availability and exclusions

Available: stored lead workflows, Tavily/Gemini research and drafting (subject to provider availability), human approval, local cadence drafts, manual meetings, grounded MoM review/tasks/outcomes, confirmed deal/sequence effects, deterministic NBA.

Available after explicit connection: Gmail sending for an approved, manually confirmed recipient. No real email is sent during automated verification. Unavailable: LinkedIn/WhatsApp sending, automatic reply detection, Calendar OAuth/booking, Meet creation, multi-user data isolation and guaranteed Sheets retry delivery. Dashboard/Analytics and other explicitly labeled demo sections remain demos. Sheets sync is best effort, with bounded requests; PostgreSQL data survives mirror failure.

## Gmail OAuth setup

Enable the Gmail API in Google Cloud and create a **Web application** OAuth client. Add the exact backend callback URI `http://localhost:5000/api/gmail/oauth/callback` for local use, or `https://sales-setu-seven.vercel.app/api/gmail/oauth/callback` for this production backend. Configure the consent screen/test user as required by Google. SalesSetu requests `gmail.send` plus `openid email` to identify the connected sender. [Gmail scope reference](https://developers.google.com/workspace/gmail/api/auth/scopes), [OAuth web-server flow](https://developers.google.com/identity/protocols/oauth2/web-server), [Gmail sending](https://developers.google.com/workspace/gmail/api/guides/sending).

Set backend-only `GMAIL_OAUTH_CLIENT_ID`, `GMAIL_OAUTH_CLIENT_SECRET`, `GMAIL_OAUTH_REDIRECT_URI=https://YOUR-BACKEND.vercel.app/api/gmail/oauth/callback`, and `GMAIL_TOKEN_ENCRYPTION_KEY` (base64 of 32 random bytes). Keep the encryption key stable and backed up separately. The backend encrypts the single-operator OAuth token record in PostgreSQL; never place tokens in the JSON collection document, Git, frontend environment, or logs. Local development still uses `DATA_DIR/gmail_oauth.enc` when `DATABASE_URL` is absent. Optional `SALES_SENDER_NAME` and `SALES_SENDER_COMPANY` supply truthful sender context to AI drafting.

Connect or disconnect under **Integrations** while authenticated as the single operator. Connection status shows the authorized sender. An email address manually entered for a sourced POC is labeled manually confirmed; changing it or message content revokes prior approval. Approval is followed by a separate preview and explicit Gmail send. Provider timeouts or uncertain confirmations leave a locked delivery-unknown state requiring mailbox inspection. Do not blindly retry. For follow-ups, Gmail threading is requested only when the approved subject matches the initial subject and a prior thread/message reference exists. Automatic reply detection is not implemented.

## Checks and release checklist

Backend: `npm run build` then `npm run test:isolated`. The test preloader clears live database, provider, Gmail and Sheets environment values before any `.env` is read; do not run the raw Node test glob against a configured production database.
Frontend: `node node_modules/typescript/bin/tsc --noEmit --incremental false`; run existing `tests/*.test.ts` with the installed backend `tsx` runner; targeted ESLint; `npm run build` with a configured HTTPS backend origin. No provider calls are required by the isolated tests.

Before release verify: unauthenticated frontend/API denied; authenticated read works; cross-origin mutation denied; PostgreSQL migration checksum and backups; scheduler disabled; no local user JSON staged; no secrets/build outputs committed. Then verify the returned Vercel URL and its authenticated proxy health. HTTP 200 alone does not prove the workflow.

Manual sequence: approval → create cadence → review due draft → meeting linked by IDs → notes/MoM review → explicit tasks → reviewed outcome → confirm deal/sequence change → inspect NBA → refresh Pipeline and Meetings. Use a dedicated test store; do not sync test records externally.

## Local runtime

Backend PowerShell: `cd backend`, leave `DATABASE_URL` unset to use the existing local JSON store, set `$env:FOLLOW_UP_SCHEDULER_ENABLED='false'`, then `npm run dev`.
Frontend: `cd frontend`, `npm run dev -- --webpack` if the known Windows/OneDrive Turbopack startup stalls. URLs: `http://localhost:5000`, `http://localhost:3000`. No package reinstall is required when dependencies exist.

Sources: [Vercel Express](https://vercel.com/docs/frameworks/backend/express), [cron management and Hobby limits](https://vercel.com/docs/cron-jobs/manage-cron-jobs), [function duration](https://vercel.com/docs/functions/configuring-functions/duration), [monorepo roots](https://vercel.com/docs/monorepos), [external rewrites](https://vercel.com/docs/routing/rewrites), [proxy limits](https://vercel.com/docs/limits), [environment configuration](https://vercel.com/docs/environment-variables).
