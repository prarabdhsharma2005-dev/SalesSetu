# SalesSetu — Agent Safety & Development Rules

## Project Status

SalesSetu is an existing, partially functional application.

The project is already implemented and pushed to GitHub.

Do NOT rebuild the project from scratch.

The existing codebase is the source of truth.

## Primary Objective

Improve and complete the existing SalesSetu application while preserving working functionality.

Priority:
1. Testing
2. Bug fixing
3. Completing broken functionality
4. Frontend/backend integration
5. Data persistence
6. Gemini functionality
7. Google integrations
8. Reliability and error handling
9. UI/UX improvements only when explicitly requested

## Hard Safety Rules

Before modifying code:
- Inspect the relevant existing implementation.
- Understand the current data flow.
- Identify the root cause.
- Make the smallest reasonable change.

NEVER:
- Rebuild the application from scratch.
- Replace the existing architecture without explicit approval.
- Delete working features.
- Replace real functionality with mock/demo functionality.
- Rewrite large sections unnecessarily.
- Change database schema without explaining why first.
- Change API contracts unnecessarily.
- Remove integrations.
- Replace Gemini with another AI provider.
- Remove Google Sheets functionality.
- Remove demo mode.
- Modify deployment configuration unless explicitly requested.
- Install unnecessary dependencies.
- Commit secrets, API keys, .env files, OAuth credentials, or tokens.

## Change Scope

Only modify files necessary for the requested task.

Avoid unrelated refactoring.

If a task requires a major architectural change, STOP and explain the proposed change before implementing it.

## Testing

For every functional change:
1. Reproduce or inspect the problem.
2. Identify the root cause.
3. Make the smallest fix.
4. Run the relevant test/check.
5. Verify the affected functionality.
6. Check related functionality for regressions.

Do not repeatedly run the complete 22-area audit unless explicitly requested.

Prefer targeted testing.

## Git Safety

Before major changes:
- Check git status.
- Preserve the current working state.

Never:
- git reset --hard
- git clean -fd
- git push --force
- mass file deletion

unless explicitly authorized.

## Communication

Keep responses concise.

For completed tasks report:
- What changed
- Root cause
- Files changed
- Tests/checks performed
- Result
- Remaining issues

If requirements are ambiguous and the change could affect architecture or existing functionality, ask before making the change.

## SalesSetu Core Workflow

ICP
→ Lead Discovery
→ Intent Detection
→ Company Research
→ POC Discovery
→ Qualification
→ Outreach
→ Follow-up
→ Meeting
→ MoM
→ Deal Pipeline
→ Next Best Action

Preserve this workflow unless explicitly instructed otherwise.

## Current Testing State

A systematic 22-area testing audit has already been performed.

Do not repeat the complete audit unless explicitly requested.

Use the existing testing audit as a starting point.

Do not assume every audit finding is a bug. Validate it against the SalesSetu requirements before changing behavior.

## Token Efficiency

Read only files relevant to the current task.

Do not repeatedly scan the entire repository for small tasks.

Work in small batches.

Default maximum: 3 related issues per task.

After completing the requested batch, stop and report the result.

## Final Rule

When uncertain between:
A) a small targeted change that preserves the existing system
and
B) a large rewrite,

choose A.

If A is not technically safe, explain why before proceeding with B.
