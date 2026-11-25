@AGENTS.md

# Ocean Outdoor Services CRM

A CRM for Ocean Outdoor Services (Robbie), a landscaping and outdoor services business: clients, properties, projects, maintenance agreements, estimates and invoices. It is also meant to become a **template** for similar businesses, so anything company-specific (name, logo, contact details, sender address, service types, numbering, wording) belongs in settings, not in code.

## Stack and commands

- Next.js 16 (App Router, server actions), React 19, Tailwind v4, Supabase (Postgres), Vitest.
- `npm run dev` · `npm test` · `npm run lint` · `npm run build`
- `npm run backup` → `npm run backup:sql` exports a database's data (used for Robbie's handover).
- CI (`.github/workflows/ci.yml`) runs test, lint and build on every PR into `master`. `master` is protected: changes go in through a PR, and that check must pass.

## How work is planned

- Work comes from the client change brief, which lives **outside the repo** at `../Brefis/robbie_CRM_change_brief.md`. Do **one phase at a time**. Don't start the next phase until told.
- At the end of each phase, stop and report: what changed, SQL to run, how to test it in the app, and any open questions.
- Questions for Robbie go through the user. Keep them few: pick sensible defaults for minor points, list those defaults, and only ask what can't be reasonably assumed.

## Database rules

- Never connect to the database or use the Supabase CLI. Every schema change is a new file `supabase/migrations/NNN_description.sql`, which the user runs in the Supabase SQL Editor. Don't assume a migration has run until the user confirms.
- Migrations must be safe to re-run and should fail loudly (and roll back) on unexpected data rather than silently changing it.
- Prefer views for derived values (e.g. Last Contact) over stored columns that need syncing. Create views `with (security_invoker = true)`.
- After a schema change, update `lib/supabase/types.ts` to match.
- Robbie's own database is migrated at handover by running every migration **before** starting the new code, so new code must cope with the state each migration leaves behind.

## Code conventions

- Server actions live in `app/<area>/actions.ts` and call `revalidatePath` after mutations. UI primitives live in `components/ui/`.
- Lists of allowed values live in one shared constant (e.g. `lib/clients/status.ts`) that matches the database `CHECK` constraint.
- Every delete needs a confirmation step in the UI (no `window.confirm`).
- New pure logic (money, dates, scheduling) gets unit tests next to it (`*.test.ts`). See `docs/test-plan.md`.
- Business time zone is America/New_York (`lib/time-zone.ts`).

## Domain terms

- **Projects:** one-off work, numbered `P####` (the estimate and invoice for a project share its number). The code and database currently call these `jobs`; the on-screen rename to "Projects" is planned in the change brief.
- **Maintenance agreements:** recurring work (lawn care, leaf cleanup, etc.) with schedule parts, planned visits and a monthly or per-visit price. The maintenance "estimate" is a contract generated from the agreement. Maintenance invoices are numbered `M#####`.
- **Invoices** are voided or marked uncollectible, never hard-deleted. A project with an invoice is archived, not deleted.
- Estimates, invoices and contracts are rendered as HTML and turned into PDFs, styled after Robbie's V4 documents, with branding from settings.

## Git and pull requests

- One branch and one PR per phase, into `master` on `origin` (`AidanL23/Ocean_Outdoor_Services_CRM`). **Never open PRs against `upstream`** (`mxl6w94/robbie_CRM`); GitHub may default the base to it, so check.
- The user opens PRs in the browser; give a compare link (`https://github.com/AidanL23/Ocean_Outdoor_Services_CRM/compare/master...<branch>?expand=1`).
- Commit, push or merge only when the user asks.
- Before every merge, run `npm test`, `npm run lint` and `npm run build`, and report the results. Never suggest merging on a failure.

## Close the loop and be proactive

Finish work completely and surface problems before they're asked about.

**Before saying a task is done, check:**
- Every step of the plan is done, or is explicitly reported as not done and why.
- Tests, lint and build have been run and their results reported (not assumed).
- Any new migration is listed with "you need to run this", and `lib/supabase/types.ts` matches it.
- The user knows exactly how to check the change in the app.
- Docs that describe the changed behaviour (`docs/test-plan.md`, this file, the change brief) still match. If they don't, update them or say they need updating.
- Nothing is left implied: every open question, assumption and follow-up is written down in the final report.

**Act proactively:**
- When you notice a risk, inconsistency, missing piece or a decision the user will need to make soon, raise it now with a recommendation, rather than waiting for it to cause a problem.
- Think one step ahead: what will the user need next (SQL to run, something to test, a question for Robbie, a handover implication), and give it to them.
- Raising something is not the same as changing it. Mention unrelated issues and propose a fix; don't make the change without agreement (see Surgical changes below).

## Guidelines

### 1. Think before coding

Don't assume. Don't hide confusion. Surface tradeoffs. Before implementing:

- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them; don't pick silently.
- If a simpler approach exists, say so. Push back when warranted, including on the change brief.
- If something is unclear, stop. Name what's confusing. Ask.

### 2. Simplicity first

Minimum code that solves the problem. Nothing speculative.

- No features beyond what was asked or what the current change brief phase names.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

### 3. Surgical changes

Touch only what you must. Clean up only your own mess. When editing existing code:

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it; don't delete it.

When your changes create orphans, remove the imports, variables and functions that your changes made unused. Don't remove pre-existing dead code unless asked.

The test: every changed line should trace directly to the request. (Exception: during an end-of-phase review, fixing comments that no longer match the code is the task.)

### 4. Goal-driven execution

Define success criteria. Loop until verified. Turn tasks into verifiable goals:

- "Add validation" → write tests for invalid inputs, then make them pass.
- "Fix the bug" → write a test that reproduces it, then make it pass.
- "Refactor X" → ensure tests pass before and after.

For multi-step tasks, state a brief plan:

```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Each change brief phase ends with a "Done when" line; that is the success criterion for the phase.
