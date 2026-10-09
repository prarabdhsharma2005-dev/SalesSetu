# Phase 1 checkpoint

- Start: `314319b` on `main`; work branch: `codex/phase1-public-workspaces`.
- Existing deployment remains on single-operator Basic access and its `primary` PostgreSQL snapshot. No production data, credentials, or settings have been changed.
- Auth choice: existing `next-auth` v5 Google provider for OIDC identity (`openid email profile`); Gmail send authorization stays in the separate existing flow. Google `sub`, not email, is the workspace identity.
- Transition: Google workspace mode is explicitly gated. A signed server-to-server assertion carries the authenticated workspace to Express while Basic access remains the internal service gate. The backend never trusts a browser-supplied workspace header.
- Storage: workspace snapshots use separate PostgreSQL state rows, preserving IDs and all JSON collections. Existing `primary` data is assigned to an explicitly named owner only by a repeat-safe offline migration. New accounts receive empty snapshots.
- Ownership inventory: leads, research/POC evidence, qualification, ICP-related record state, outreach/approvals/delivery attempts, follow-ups, meetings/MoM/outcomes/tasks, deals, recommendations, and audit collections all require the request workspace. Gmail tokens, OAuth state, caches, proof signatures, idempotency, send reservations, quotas, and account deletion require the same identity.
- Safety: keep the scheduler disabled in workspace mode until a workspace-aware processor is verified. No live AI, sending, external sync, production migration, or deployment in this phase.

## Progress and verification

- [x] Relevant repository, Next.js 16, Auth.js, PostgreSQL, Gmail, proxy, and access flows inspected.
- [x] Public homepage and identity sign-in behind the workspace flag; live Google consent awaits credentials.
- [x] Workspace snapshots, local private files, Gmail token/state binding, POC proofs/caches, in-process claims, and scheduler fail-closed path.
- [x] PostgreSQL daily quotas, explicit owner migration with private backup, reauthenticated account deletion.
- [x] Removed demo substitution from private workspace views; ICP is stored in the workspace snapshot and qualification reads it server-side.
- [x] Isolated tests: 86 backend and 21 frontend passed; backend TypeScript and frontend TypeScript passed.
- [x] Frontend production build passed with the workspace flag and isolated dummy credentials using Webpack. Turbopack hit a Windows/OneDrive cache-file error; Webpack is the verified build path.
- [x] Targeted frontend lint passed with no errors (existing unused-import warnings in Leads and Pipeline). `git diff --check` passed.
- [x] Reviewed authorization boundaries and corrected legacy-only UI fallbacks so the existing single-operator experience remains unchanged while new private accounts never see demo substitutions.
- [ ] Live Google login, two-browser isolation, and mobile/desktop browser review require a configured Google OAuth client; none was added to repository settings. The existing local servers respond on ports 3000 and 5000 in legacy mode and were left running.
- [ ] Explicit owner migration and production enablement are pending operator review; no production database or OAuth changes occurred.
