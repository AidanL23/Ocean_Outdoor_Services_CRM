# Robbie CRM — Test Plan (Phases 1–4)

Status: **stage 1 (unit tests) done** — Vitest is set up (`npm test`), covering `lib/invoices/calc.ts`, `lib/invoices/format.ts`, `lib/clients/status.ts` and (Phase 2) `lib/contact/last-contact.ts`. Gap G1 is recorded as an `it.fails` test in `calc.test.ts`. Stages 3–4 (integration, E2E) not started.

Phase 1 is built. Phases 2–4 are planned in `robbie_CRM_change_brief.md`, so their cases describe intended behaviour and will be refined when each phase is built.

## 1. Goals and what is out of scope

**Protect, in this order:**
1. Client data integrity: nothing is deleted or orphaned by accident (Phase 4).
2. Money: invoice totals, tax and numbering are correct.
3. Rules the client asked for: statuses, Last Contact colours, service agreements.
4. Pages and forms load and submit.

**Out of scope:** Next.js and Supabase internals, Tailwind styling, trivial getters, one-off scripts (`scripts/*.mjs` get a smoke test only), visual design.

## 2. Test layers

| Layer | Tool | Needs | Speed | Target |
|---|---|---|---|---|
| Unit | Vitest | nothing | under 1 s | ≥ 90% line coverage on `lib/**` pure logic; every branch of money and date maths |
| Integration | Vitest + `@supabase/supabase-js` | a **test** Supabase project | seconds | every server action: one happy path and one test per guard or rule; every migration |
| End-to-end | Playwright | running app + test project | tens of seconds | 5 key flows (section 7); no more |

Rule of thumb: if a rule can be tested at a lower layer, test it there. E2E tests only prove the pages are wired to the rules.

## 3. Test environment

- **A second Supabase project, used only for tests.** Never run integration or E2E tests against the personal dev project once it holds real data, and never against Robbie's project.
- Env vars live in `.env.test.local` (git-ignored, like `.env.local`): `TEST_SUPABASE_URL`, `TEST_SUPABASE_SERVICE_ROLE_KEY`. Test code never reads `NEXT_PUBLIC_SUPABASE_URL` from `.env.local`.
- **Safety guard:** a shared setup file refuses to run if `TEST_SUPABASE_URL` is missing, equals the URL in `.env.local`, or its project ref is not on an allow-list in the test config. A wrong key must fail loudly rather than wipe data.
- **Schema:** build the test project from `supabase/schema.sql` once, and apply each new `supabase/migrations/NNN_*.sql` after it. A migration test (section 6) checks the live schema matches what the code expects.
- **Isolation:** each integration test creates its own rows with a unique prefix (`TEST-<random>`) and deletes them in `afterEach`, children before parents, because foreign keys do not cascade (except `invoice_line_items`). A global `afterAll` sweeps any leftover `TEST-` rows.
- Server actions call `redirect()` and `revalidatePath()`. Integration tests mock `next/cache` and treat the thrown redirect as a success signal.
- Scripts to add when built: `npm test` (unit), `npm run test:int`, `npm run test:e2e`.

## 4. Gaps found in the existing code

These are the first things tests should pin down, and some are likely bugs.

| # | Where | Observation | Suggested test or fix |
|---|---|---|---|
| G1 | `lib/invoices/calc.ts` | No rounding to cents. Tax and discounts are floating-point and unrounded. The document shows each line rounded, so displayed lines can add up to a different total than shown. | Unit tests with awkward values (e.g. 3 × 19.99 with 7% tax, 33.33% discount). Decide a rounding rule, then lock it in. |
| G2 | `app/invoices/actions.ts` `createInvoice` | `Number("")` is 0, so a blank tax-rate field silently means 0% tax. A non-number gives NaN. | Integration test: blank and non-numeric tax rate. Expected behaviour must be decided (default 7%, or reject). |
| G3 | `addLineItem` | `qty`, `unit_price`, `discount_pct` are not validated. NaN, negatives and discounts over 100 are accepted. | Tests for each, plus the rejection rule. |
| G4 | `updateInvoiceStatus` | Accepts any string. `invoices.status` has no CHECK constraint. Phase 4 adds `void`. | Test that unknown statuses are rejected. Add a CHECK in the Phase 4 migration. |
| G5 | `deleteLineItem` | Does not check the line belongs to the invoice passed in. | Test: delete with a mismatched invoice id must not delete. |
| G6 | `lib/invoices/generate.ts` | Address split on the first comma. A job with no property gives a blank address. | Unit test `splitAddress` edge cases; integration test an invoice with no job. |
| G7 | Whole app | No authentication. Every server action is reachable by anyone who can reach the app. | Not testable yet. Flagged in brief Phase 6. Add an auth test when auth exists. |

## 5. Unit tests (stage 1)

Pure functions, no database. Extract `splitAddress`, `formatPlain` and the date formatters from `generate.ts` into an importable module so they can be tested without `server-only`.

**`lib/invoices/calc.ts`**
- `lineComputations`: qty 1 × price 100, 0% discount gives gross 100, discount 0, total 100.
- 2 × 50 with 10% discount gives gross 100, discount 10, total 90.
- Zero qty, zero price, 100% discount all give total 0; no negative zero shown.
- `invoiceTotals`: empty list gives all zeros; tax at 0, 0.07, 1 (100%).
- Several lines: `netPrice` is the sum of line totals, `discountTotal` the sum of line discounts, `amountDue` equals `totalPrice`.
- G1 values: sum of displayed lines equals displayed net price.
- `formatCurrency`: 0, 1234.5, 1e6, negatives.

**`lib/clients/status.ts`**
- `isClientStatus` true for the four values; false for `""`, `null`, `inactive`, `Active`, `"lead "`.
- `parseClientStatus` returns the value, and throws on anything else, including null.
- `CLIENT_STATUSES` has unique values, and the default is a member.

**Formatters from `generate.ts`**
- `formatLongDate` / `formatShortDate`: null gives `""`; `2026-01-31` has no timezone drift.
- `splitAddress`: null, no comma, one comma, many commas, surrounding spaces.

**Phase 2 (built):** `lib/contact/last-contact.test.ts`
- `contactLevel`: 0, 14, 15, 30, 31 days map to green, green, yellow, yellow, red; `null` (never contacted) is grey; custom thresholds respected.
- `validateThresholds` / `parseThresholds`: yellow ≤ green, negatives, fractions, blanks and absurd values rejected.
- `daysSince` counts calendar days in the business time zone (America/New_York, `lib/time-zone.ts`): 11 pm yesterday is 1 day; DST change; future is 0.
- "12 days ago" wording for 0, 1, 2, 30, 400 days; never negative.
- Declined and Past clients keep the text but get neutral grey (`tracksLastContact`).
- `parseContactDateTime` (date and time on the note form): blank or untouched default means now; Eastern wall-clock time in standard and daylight time; future rejected; invalid values rejected.
- `sortByLastContact`: never-contacted first when sorting by longest since contact.

**Phase 3:** service-type list is unique; Lawn Care pre-fills season 3–10; season months must be 1–12.

## 6. Integration tests (stage 3, with Phase 4)

Run server actions and queries against the test project.

**Migrations and schema**
- `001_client_status`: on a seeded table with `active`, `inactive`, `Active `, NULL: the run with NULL fails with the listed message and changes nothing; without NULL it maps `inactive` to `past`, sets the default `lead`, NOT NULL, and the CHECK. Inserting `status = 'prospect'` is rejected.
- Schema smoke test: all six tables, the 8 foreign keys, identity on `invoices.invoice_number`, RLS enabled on every table.

**Phase 1**
- `createClient` with no status stores `lead`; with each valid status stores it; with `bogus` throws and inserts nothing.
- `updateClient` changes status; invalid status throws and leaves the row unchanged.
- The clients query with `?status=` returns only that status; the dashboard count includes only `active`.

**Phase 2**
- The Last Contact view returns the newest `contact_date` per client, including notes attached to a job of that client.
- A note with an earlier `contact_date` added after a later one does not move Last Contact backwards.
- Deleting or editing a note recomputes Last Contact; a client with no notes returns null.
- Settings: saving thresholds persists; the single-row table cannot get a second row.
- The index on `activity_logs(client_id, contact_date)` exists.

**Phase 3**
- Create a client with a lawn agreement; add a second; list returns both.
- A `property_id` from another client is rejected, or at least not displayed under the wrong client.

**Phase 4 (highest priority, data-loss rules)**
- Client with invoices: delete is blocked with the "set to Past Client" message; nothing removed.
- Client without invoices: delete removes the client and its properties, jobs, notes and agreements, and no other client's rows.
- Job referenced by an invoice: behaviour matches the approach chosen in Phase 4 (block or unlink), and the invoice survives.
- Invoice void: status becomes `void`, and it is excluded from the dashboard unpaid count. The row remains.
- Invoice hard delete: line items cascade; other invoices are untouched; the next new invoice number continues (gap is allowed, no reuse).
- Invoice edit: header fields update; line item edit recomputes totals.
- Note edit and delete work and trigger Last Contact recompute.
- G3, G4, G5 tests: invalid line values, unknown status, mismatched ids.
- Every delete action tested twice: once on the intended row, once to prove a neighbour row is untouched.

**Invoice document**
- `generateInvoiceDocx` returns a non-empty buffer and `invoice-<n>.docx` for: normal invoice; no job (blank address); zero line items; many lines; special characters (`&`, `<`, apostrophes) in names and descriptions.
- Unzip the result and assert the key numbers and the client name appear in `word/document.xml`, and that no `{placeholder}` text is left.
- Phase 5 (header alignment) is a visual change and cannot be tested automatically. It needs a manual check with a rendered copy.

## 7. End-to-end tests (stage 4, last)

Playwright against `next dev` or a build pointed at the test project. Start each flow from a clean database. Keep to five flows:

1. **Client lifecycle:** create a client (defaults to Lead) → edit status → appears under the right filter chip → refresh keeps the filter.
2. **Filter and dashboard:** with one client per status, each chip shows the right rows and counts; the dashboard card equals the number of active clients.
3. **Job to invoice:** create a property and job → create an invoice with two line items → totals on screen match the expected values → download the `.docx` and check it opens.
4. **Last Contact (Phase 2):** add a note on a client and on a job → the list shows "today" with the right colour → change the thresholds on `/settings` → the colour changes.
5. **Deletes (Phase 4):** blocked client delete shows the message; confirmed delete of a test client removes it; void and delete an invoice, each behind its confirmation.

Plus a **smoke test:** every route returns 200 with an empty database (the `/clients?status=bogus` case falls back to All).

## 8. Manual checks that stay manual

- The look of the invoice header and its centring (Phase 5).
- Colour contrast of the Last Contact cells.
- Anything involving the client's real Supabase project.

## 9. Build order and exit criteria

| Stage | When | Exit criteria |
|---|---|---|
| 1. Unit | next, before Phase 2 | Vitest installed; section 5 tests for existing code pass; G1 rounding decision made |
| 2. Plan upkeep | each phase | This file updated when a phase changes the rules |
| 3. Integration | with Phase 4 (Phase 1 and 2 cases can start earlier) | Test project exists; safety guard in place; every Phase 4 rule has a passing test |
| 4. E2E | last | Five flows and the smoke test pass locally |

Run lint, build and the unit tests before every commit. Run integration tests before merging a phase. E2E before handing a build to Robbie.

**CI (GitHub Actions):** `.github/workflows/ci.yml` runs the unit tests, lint and build on every PR into `master` and every push to `master`. It uses placeholder Supabase env vars, because the build only needs them to exist and never queries the database. When stage 3 lands, add a CI step for `npm run test:int` with the test project's URL and key stored as GitHub repository secrets (never the dev or client project). E2E stays local for now.

## 10. Open items

- Rounding rule for money (G1) and tax-rate validation (G2).
- Which `invoices.status` values are allowed (G4).
- Name and project ref of the second Supabase project, to put in the safety allow-list.
- ~~Whether to run tests automatically on push (GitHub Actions) once the repo is hosted.~~ Decided: yes. Unit tests, lint and build run in CI (see section 9).
