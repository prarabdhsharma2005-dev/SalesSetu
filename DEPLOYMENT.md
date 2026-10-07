# SalesSetu deployment and operating contract

## Supported architecture

Vercel hosts **frontend/** (Next.js). The Express backend runs on **one persistent host, one process, one replica**, with an attached durable filesystem. JSON is the current source of truth; Apps Script is an optional best-effort mirror. Prisma remains inactive. Do not deploy this backend as a Vercel function or use an ephemeral disk.

The existing `render.yaml` is a legacy free-tier blueprint, **not a durable production deployment**. A suitable existing persistent host must be confirmed before release. No paid resource is provisioned by this repository change. Never share the JSON file between replicas/containers. The production process lock protects one OS host, not a distributed filesystem. Use stop-then-start deployment rather than overlapping instances, and maintain encrypted backups outside the container.

## Vercel project

- Root directory: `frontend`; framework: Next.js; Node: 22.x.
- Install: `npm ci`; build: `npm run build`; output: Next.js default.
- Set server-only `BACKEND_URL` to the backend's real HTTPS origin (no path, credentials or query).
- Set `APP_ACCESS_USER` and a random `APP_ACCESS_PASSWORD` of at least 24 characters, identical on frontend and backend. Do not prefix secrets with `NEXT_PUBLIC_`.
- This is a private single-operator deployment protected by HTTP Basic authentication over HTTPS. It is not a multi-user tenant system. Rotate credentials to revoke access. All frontend paths and backend API paths require authentication in production; missing configuration fails closed. Do not share the credential with untrusted users.
- No frontend Gemini/Tavily/Sheets credentials. Configure preview deployments against an isolated backend/store; never point a public preview at production user data.
- The legacy `NEXT_PUBLIC_BACKEND_URL` is accepted for compatibility, but production rejects localhost or HTTP. `BACKEND_URL` takes precedence.
- Existing `/api/backend/*` rewrites preserve the API paths and Authorization header. Verify authentication and backend connectivity after deployment. Responses containing records are private/no-store.
- External rewrite limits are provider-controlled; Vercel documents a 120-second proxy maximum. Client AI requests remain bounded at 60 seconds, and the local Next proxy at 70 seconds. Timeout errors must remain visible; no fabricated fallback is used.

## Persistent backend

From `backend/`: `npm ci`, `npm run build`, then `npm start`. Node 22 is recommended. Install build dependencies during the build. Expose HTTPS through the host reverse proxy; health check: `/health` (contains no records or secret values).

Required production environment:

| Variable | Meaning |
|---|---|
| `NODE_ENV=production` | Enables fail-closed startup/access controls |
| `PORT` | Host-provided listening port |
| `FRONTEND_URL` | Exact HTTPS frontend origin; CORS is not authentication |
| `APP_ACCESS_USER`, `APP_ACCESS_PASSWORD` | Shared single-operator access, as above |
| `DATA_DIR` | Absolute durable mounted directory containing `sheets_store.json` |
| `SINGLE_INSTANCE=true` | Operator acknowledgement of the single-process deployment contract |
| `GEMINI_API_KEY`, `TAVILY_API_KEY` | Real provider credentials, backend only |
| `FOLLOW_UP_SCHEDULER_ENABLED=false` | Keep disabled until persistent deployment and cadence are reviewed |
| `FOLLOW_UP_SCHEDULER_INTERVAL_MS=3600000` | One hour when explicitly enabled |
| `GOOGLE_SHEETS_WEBHOOK_URL` | Optional existing mirror; leave absent for isolated environments |
| `GOOGLE_SHEET_ID` | Optional metadata; not proof of working Sheets OAuth |

Provisioning/migration is an operator action: copy a reviewed backup to the durable mount without committing it. Startup requires valid existing core collections and will not seed production demo leads. Back up and checksum the source/destination. Missing/corrupt stores fail; they are not replaced with empty data. Writes use atomic replacement. The process owns `.salessetu.lock`; a valid live owner blocks another startup. A stale lock is recovered only if its PID no longer exists on the same host. Inspect invalid locks manually.

The scheduler lives in this **same single backend process**, not a second worker accessing the JSON file. It uses the existing per-step claim shared with manual generation, rereads state after provider calls, rejects stale saves, and releases claims on errors. A restart rereads saved drafts; a crash before saving may repeat generation but cannot duplicate a committed step. `/api/sheets/follow-up-sequences/process-due` remains unavailable in production. Shutdown stops the scheduler and waits for in-flight processing within the existing bounded grace period.

## Workflow semantics

- New cadence: days 0, 3, 7, 12. Legacy offsets are preserved. UTC elapsed-day calculation; browser displays local time.
- Anchor is the initial outreach's **manual DELIVERY_READY timestamp**, never proof of sending. Recipient requirements still apply; unknown email/phone cannot be invented to unlock delivery-ready.
- Generation creates DRAFT only. Immediate predecessor must be DELIVERY_READY. Paused/terminal sequences cannot generate or advance. Human approval, qualification and NEEDS REVIEW acknowledgement remain required.
- A meeting links a sequence by matching outreach/lead/POC IDs. The user selects explicitly even if only one is compatible. No company-name matching.
- Outcome proposes PAUSED, STOPPED or MEETING_BOOKED; review captures meeting/sequence versions. The user sees a preview and explicitly confirms application. MEETING_BOOKED requires a scheduled meeting. Application is audited/idempotent; stale requests fail. Meeting completion never reactivates a sequence.
- NBA priority: missing/blocked qualification → overdue tasks → draft approvals → upcoming meetings (7 days) → MoM/outcomes awaiting review/application → due eligible cadence → recorded deal next action. Equal priorities sort by stable record ID. Recommendations are suggestions, never executed automatically. Ambiguous task date text has no assumed deadline; date-only values use UTC calendar dates.

## Availability and exclusions

Available: stored lead workflows, Tavily/Gemini research and drafting (subject to provider availability), human approval, local cadence drafts, manual meetings, grounded MoM review/tasks/outcomes, confirmed deal/sequence effects, deterministic NBA.

Unavailable: external email/LinkedIn/WhatsApp sending, automatic reply detection, Calendar OAuth/booking, Meet creation, multi-user data isolation and guaranteed Sheets retry delivery. Dashboard/Analytics and other explicitly labeled demo sections remain demos. Sheets sync is best effort, with bounded requests; durable local data survives mirror failure. Optional integration cards accurately show unavailable.

## Checks and release checklist

Backend: `npm run build` then `node --test tests/*.test.cjs`.
Frontend: `node node_modules/typescript/bin/tsc --noEmit --incremental false`; run existing `tests/*.test.ts` with the installed backend `tsx` runner; targeted ESLint; `npm run build` with a configured HTTPS backend origin. No provider calls are required by the isolated tests.

Before release verify: unauthenticated frontend/API denied; authenticated read works; cross-origin mutation denied; correct durable mount; one backend process; scheduler disabled; no local user JSON staged; no secrets/build outputs committed. Then verify the returned Vercel URL and its authenticated proxy health. HTTP 200 alone does not prove the workflow.

Manual sequence: approval → create cadence → review due draft → meeting linked by IDs → notes/MoM review → explicit tasks → reviewed outcome → confirm deal/sequence change → inspect NBA → refresh Pipeline and Meetings. Use a dedicated test store; do not sync test records externally.

## Local runtime

Backend PowerShell: `cd backend`, `$env:FOLLOW_UP_SCHEDULER_ENABLED='false'`, `npm run dev`.
Frontend: `cd frontend`, `npm run dev -- --webpack` if the known Windows/OneDrive Turbopack startup stalls. URLs: `http://localhost:5000`, `http://localhost:3000`. No package reinstall is required when dependencies exist.

Sources: [Vercel monorepo roots](https://vercel.com/docs/monorepos), [external rewrites](https://vercel.com/docs/routing/rewrites), [proxy limits](https://vercel.com/docs/limits), [environment configuration](https://vercel.com/docs/environment-variables).
