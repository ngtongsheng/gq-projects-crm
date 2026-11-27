# Code audit, round 3 (2026-11-27)

Scope: branch `loop/26-code-audit` at `730b739` (loop 25 plus loop 26 tasks 01-04). Section A goes deep on
code changed since `132f454` (loops 23-25: 366 files under `src`, `scripts` and `supabase`, +27.7k/-10.4k lines).
Section B is the repo-wide sweep (task 06). Report only: no source file was changed. Rounds 1-2 findings and
`docs/debt.md` items are not reported again.

Tags: `fix: 07|08|09` means the finding can be fixed without changing behavior (loop D3) in that task. `debt` means
the fix changes behavior, schema or UI, so it goes to `docs/debt.md`.

## Baseline checks (2026-11-27, at `730b739`)

| Check | Result |
|---|---|
| `pnpm check` | pass (1497 files, no fixes) |
| `pnpm typecheck` | pass |
| `pnpm test` | pass (307 files, 3328 tests) |
| `pnpm build` | pass |

## A. Delta deep review (loops 23-25)

Headline: **one real data-loss path (A1)**. Marketing reads stop at 1000 rows without an error, so once a table
passes 1000 lines the Excel export leaves rows out, and importing that file with Replace deletes them. Everything
else is low severity. The new code is strict: no `any`, no `ts-ignore`, no new lint disables, no stray logs or
commented-out code, zod at every action boundary, and `logServerError` on most error paths.

### Marketing expense

| ID | Finding | Evidence | Impact | Tag |
|---|---|---|---|---|
| A1 | **Silent 1000-row cap, which leads to data loss on export then Replace import.** Every marketing loader reads with no paging, and PostgREST stops at `max_rows = 1000` without an error. The export route uses those loaders, but the Replace import pages through **all** ids (`allIds`) and deletes them. With 1000+ expenses (likely after importing years of the Excel history): export, edit, then Replace import deletes every expense the export missed. Dashboard and log totals are also short with no warning | `marketing/marketing-data.ts:93-99`, `marketing-prepaid-data.ts:89-95`, `marketing-giveaway-data.ts:20-26`, `marketing/export/route.ts:20-28` vs `marketing-excel-store.ts:33-48,167,241`; `supabase/config.toml:18` | High once a table passes 1000 rows; money figures wrong before that point is noticed | fix: 09 (page every loader the export uses; do it before the history import); fixed in fd1300e |
| A2 | Dashboard, expense log and events view each send every expense of every year to the browser and filter there. The payload grows forever, and A1 cuts it at 1000 | `marketing/page.tsx:124,176,250`; `marketing-data.ts:92` | Low now, grows yearly | debt |
| A3 | The page awaits `loadMarketingCategories()` before the view's own `Promise.all` starts, so every marketing view makes two round trips in series | `marketing/page.tsx:55` | Low (one extra round trip per view) | debt (09 cap); was fix: 09 |
| A4 | A workbook that fails to parse is swallowed with `.catch(() => null)` and not logged. A parser bug looks the same as "not an xlsx file" | `marketing/marketing-excel-actions.ts:69-75` | Low (no trace for a real bug) | debt (09 cap); was fix: 09 |
| A5 | Saving categories deletes first, then upserts, in two writes. A failed upsert (for example 23505 on a name swap, since `lower(name)` is a non-deferrable unique index) leaves the deletes done and the renames not saved | `marketing/marketing-category-actions.ts:44-71`; migration `20261121140000_marketing_expense.sql:42` | Low (half-saved list; swapping two names always fails with "Two categories have the same name") | debt |
| A6 | The import rollback undoes only the inserted lines. New categories, new vendors, new events and event detail updates stay after a failure. The doc comment says a failure "leaves the old data in place" | `marketing/marketing-excel-store.ts:135-138,171-179` | Low (leftover categories/vendors after a failed import) | debt |
| A7 | `parseMarketingWorkbook` is one function of about 300 lines (expenses, events, prepaid and give-aways read in one body) in a 452-line file | `marketing/marketing-excel-import.ts:122-419` | Maintainability: hard for an agent to change one sheet safely | fix: 08 (split per sheet kind, move code unchanged); fixed in 81e2819 |
| A8 | Marketing imports a customers loader from the custom-samples feature (`loadCustomerNames` reads `companies`) | `marketing/page.tsx:8`; `custom-samples/custom-samples-data.ts:123-134` | Layering: a change to custom samples can break marketing | fix: 07 (move to `customers/`); fixed in e0f8cef |

Done well: money stays in `numeric`, balances are computed in a database view, every FK and unique violation maps
to a plain message, Replace-import inserts before it deletes, and exceljs stays on the server (no client bundle cost).
Not new: the seven action files repeat the same save/delete skeleton (another case of round 1 R1/R3, already in debt).

### Custom samples

| ID | Finding | Evidence | Impact | Tag |
|---|---|---|---|---|
| A9 | Every page load signs each photo with its own storage request (`createSignedUrl` per row inside `Promise.all`). supabase-js has `createSignedUrls(paths, expiresIn)` for one batch call | `custom-samples/custom-samples-data.ts:64-70`; `lib/storage/signed-url.ts:30-40` | Low-med: N storage calls per view, growing with the sample library | fix: 09 (batch signer in `lib/storage`, same links); fixed in fd1300e |
| A10 | `void openCustomSamplePhoto(id).then(...)` has no rejection handler, so a failed or redirected server action becomes an unhandled rejection in the browser | `custom-samples/custom-sample-sheet.tsx:199-201` | Low | debt (09 cap); was fix: 09 |
| A11 | `NOT_FOUND`, `TRY_AGAIN` and `sampleId` are declared identically in two action files (`NOT_FOUND` also in the input file). The feature already has `custom-sample-refusal.ts` for shared refusals | `custom-sample-actions.ts:28-31`, `custom-sample-loan-actions.ts:15-19`, `custom-sample-input.ts:5` | Low (drift risk) | fix: 07; fixed in e0f8cef |
| A12 | The next `TS-###` code is `max()+1` with no lock. Two samples recorded at once collide on `code unique`, and the second gets "That code is already used." (retry works). Same pattern as round 2 D7 | migration `20261121130000_custom_samples.sql:169-173`; `custom-sample-actions.ts:98-99` | Low | debt |
| A13 | Replacing a sample's photo keeps the old file in storage. List thumbnails (44 px) download the full photo (`unoptimized`) | `custom-sample-actions.ts:84`; `custom-samples/custom-sample-photo.tsx:12-19` | Low (storage and phone data) | debt |

Done well: the return flow is one guarded update per step with idempotent filters, the database words its own
refusals (`plainRefusal`), and the sheet refreshes the 5-minute photo link when it opens.

### Travel claims

| ID | Finding | Evidence | Impact | Tag |
|---|---|---|---|---|
| A14 | `submitTravelClaim` error paths: after a 23505 race the second `find()` error goes unlogged, and a zero-row update logs `saved.error` while it is `null` | `claims/travel-claim-actions.ts:87-90,98-104` | Low (failures with no useful log line) | debt (09 cap); was fix: 09 |
| A15 | Settings load and the claim lookup run in series, though they are independent | `claims/travel-claim-actions.ts:39,63` | Low | debt (09 cap); was fix: 09 |
| A16 | Every 42501 on update shows "This claim is released", but the guard raises 42501 for five other reasons (overtime for non-site staff, not the owner, ...). Refusal mapping also differs by feature: custom samples pass the database message through `plainRefusal`, and claim review matches `message.includes(NO_REPORT)` | `claims/travel-claim-actions.ts:99`; migration `20261121110000_travel_claims.sql:103-165`; `claims/travel-claim-review-actions.ts:110-115`; `custom-samples/custom-sample-refusal.ts` | Low (misleading message) | debt (message change; promote `plainRefusal` to `lib`) |
| A17 | `countClaimsReadyToRelease` (MD and HR home reminders) waits for the claims query before it starts `loadClaimPeople()`, which does not depend on it. It also reads every monthly report ever filed by those people, when only the months of submitted claims are needed | `claims/ready-to-release-data.ts:20-32` | Low, grows by 12 rows per person per year | debt (09 cap); was fix: 09 (parallelise; filter `.in("month", ...)`, same result) |

Done well: one-update review with a status precondition (no half-saved check), a database guard that mirrors
`reportKindFor`, and cents comparison for the final amount.

### Home reminders

No new findings. The plan loads only what the role acts on, all in parallel. Note: `officeSamples` hard-codes a
third role list next to `custom-sample-access.ts` (`dashboard/home-reminders.ts:40`). That is another case of round 1
C2, already in debt.

### Loops 23-24 changes (auth, headers, logging, agent scripts)

| ID | Finding | Evidence | Impact | Tag |
|---|---|---|---|---|
| A18 | **Session-sync drops the git result when `gh` fails.** If either issue list fails (offline, gh logged out, 8 s timeout), `main` replaces the whole sync with zeros. A pull that changed CLAUDE.md or the skills then prints no "Rules updated" line, and "behind origin/main" is hidden | `scripts/agent/session-sync.mjs:328-341` | Medium for Vicky's agent: it keeps working on stale rules after an update | fix: 09 (`{ instructions: [], replies: [], ...git, catchUpDue }`, plus a regression test); fixed in fd1300e |
| A19 | Dead dictionary entries: "Nothing here yet." (marketing) and "Keep this under 300 characters." (travel claim) are in zh and bm, but no code uses them | `lib/i18n/zh-marketing.ts:52`, `bm-marketing.ts:61`, `zh-travel-claim.ts:60`, `bm-travel-claim.ts:65` | Trivial | fix: 07 (remove both pairs; parity stays); fixed in e0f8cef |

Done well: the CSP and headers are a pure, tested function. `logServerError` copies only code, message and details.
`closeImpersonationLog` closes round 2 S4. The missing service key now throws (round 2 S3). `global-error.tsx`
matches the Next 16 `retry` API. Not new: new `console.error` calls in `sign-out.ts:23`, `current-profile.ts`,
`middleware.ts` and `auth/callback` are covered by debt "Error logs on other paths lack context" (O4).

### Fix-task load

- `fix: 07`: A8, A11, A19 (about 7 files)
- `fix: 08`: A7 (1 file plus the split files)
- `fix: 09`: A1, A18, A9, A17, A3, A14, A15, A4, A10 (about 8 files), in rank order
- `debt`: A2, A5, A6, A12, A13, A16

## B. Repo-wide sweep

Headline: **the repo is clean of dead code and noise; the cost is repeated UI blocks.** knip finds one dead file and
12 dead types, no unused dependency. No commented-out code anywhere in `src` or `scripts`. Duplication is 4.6% of
lines (jscpd, 394 clones at 10+ lines), but most of it is import blocks and test mocks (round 1 Q2, in debt); the real
clones are the four below.

Tools, run once with `pnpm dlx` at the same commit: knip 6.48.0 (default config), jscpd (`src scripts --min-lines 10`).
Every row below was checked by grep or by reading the code.

### Dead code, duplication and size

| ID | Finding | Evidence | Impact | Tag |
|---|---|---|---|---|
| B1 | **Dead file.** `sales-target.ts` holds one type, `YearlyTarget`, that nothing imports. Loop 23 removed `effectiveSalesTarget` from it (`cb3160d`) and left the file | `src/lib/domain/sales-target.ts:1-7`; `grep -rnw YearlyTarget src scripts` hits only its own line | Trivial; an agent may think it is the target rule | fix: 07 (delete the file); fixed in e0f8cef |
| B2 | The delete-confirm footer (Save, then Delete, then "Yes, delete" / "Keep") is copied in 8 dialogs, 36 identical lines each. No shared component exists; round 1 R1 (`FormDialog`/`useSubmit`) covers the open/submit state, not this footer | `custom-samples/record-sample-dialog.tsx:262-297`, `marketing/marketing-event-cost-dialog.tsx:219-254`, `marketing-event-dialog.tsx:169-204`, `marketing-expense-dialog.tsx:323-358`, `marketing-giveaway-dialog.tsx:198-233`, `marketing-prepaid-entry-dialog.tsx:315-350`, `marketing-vendor-dialog.tsx:316-351`, `samples/sample-dialog.tsx:281-316` | Medium for the team: a wording or style change to delete has to be made 8 times | debt (8 files plus a new `components/app/delete-confirm.tsx`; over the 07 cap) |
| B3 | `installer-forms.tsx` mixes three dialogs (installer PO, claim, payment) with the shared `FormDialog` and `useSubmit` that round 1 R1 names as the seed of a shared dialog | `mofs/[id]/installer-forms.tsx:50-94` (shared), `104-239` (PO), `240-398` (claim), `399-489` (payment); one importer, `installer-claims.tsx:27` | Maintainability: 489 lines, three unrelated forms in one file | fix: 08 (one file per dialog plus `form-dialog.tsx` beside them, code moved unchanged); fixed in 81e2819 |
| B4 | MOF register columns are copied across four pages: the "MOF no." link and the "Company / project" cell, and the "A + B" salesperson join is built in three places | Columns: `collection/page.tsx:74-99`, `mofs/page.tsx:165-202`, `mofs/summary/page.tsx:156-185`, `commission/page.tsx:150-170`. Join: `mofs/mof-data.ts:96-103`, `mofs/summary/summary-data.ts:138-145`, `collection/page.tsx:101-104` | Low-med: a change to how an MOF is shown in lists drifts between pages | debt (a `mofs/mof-columns.tsx` column factory and a `mofPeople` helper; 6 files) |
| B5 | The "projects not lost, labelled name · company" picker loader exists three times, differing only in the own-projects filter | `tasks/task-data.ts:93-107`, `installation/booking-data.ts:111-129`, `stock/stock-data.ts:145-163` | Low: a picker label change is made three times | debt (one `projects/project-options-data.ts` with an optional owner filter; 4 files) |
| B6 | 12 exported types are declared and used nowhere, not even in their own file (knip, then one grep hit each): `ActivityForm`, `RecordSampleInput`, `ContactForm`, `VendorInput`, `MofTotalChange`, `MofCost`, `ProjectForm`, `SampleInput`, `PickupFormInput`, `DoLineInput`, `SalesGrade`, `InstallerSkill` | `activities/schemas.ts:62`, `custom-samples/custom-sample-input.ts:51`, `customers/schemas.ts:94`, `marketing/marketing-input.ts:157`, `mofs/schemas.ts:190,198`, `projects/schemas.ts:132`, `samples/sample-schemas.ts:36,98`, `lib/domain/delivery-order.ts:61`, `lib/domain/hr-scheme.ts:52`, `lib/domain/installer.ts:17` | Trivial (one-line deletes, no runtime effect) | fix: 07 (one-line deletes in 10 files; needed for 07 knip acceptance); fixed in e0f8cef |
| B7 | Two costing components are one function each of 330-380 lines: `QuoteEditor` and `ItemRow`. Splitting them needs new props between parts, not a plain move | `costing/[id]/quote-editor.tsx:36-416`, `costing/[id]/item-row.tsx:132-466` | Maintainability: the costing screen is the hardest one to change safely | debt (add to the round 1 C1 list of 500-line files) |

Size check, not findings: `tasks/actions.ts` (472), `mof-import.ts` (460), `lib/auth/pages.ts` (453, the page
registry), `staff-package-dialog.tsx` (429), `catch-up.mjs` (417) and `vo-sheet.tsx` (414) each keep one
responsibility. `mof-form`, `pickup-form-dialog`, `job-form`, `quote-view` and `report-data` are round 1 C1 (debt),
`marketing-excel-import` is A7. `key-parity-known-gaps.ts` (1615 lines) is live: `key-parity.test.ts` reads it.
`scripts/example-data/*` are seed data.

### Comments

No finding. Zero commented-out code (grep for commented `const`/`import`/`return`/calls/JSX in `src` and `scripts`).
599 line comments in `src`; the files with the most (`people/schemas.ts` 9, `customers/actions.ts` 8,
`mofs/actions.ts` 7, `people/actions.ts` 7, `tasks/actions.ts` 6) were read: all state a business rule, RLS reason or
workaround. The 297 comments that cite "the demo" (in 215 files, for example `tasks/task-view.ts:103` "demo tkSort")
resolve to `docs/mockup/gqp-office-demo.html`, so they are traceability, not noise.

### Error handling

| ID | Finding | Evidence | Impact | Tag |
|---|---|---|---|---|
| B8 | Loop 24 D6 put `logServerError` on claims, collection, commission, leave, HR and overtime, but the MOF money writes were left on raw `console.error`: installer claims and payments, supplier and installer POs, VOs, the MOF save and costing approval (no user or record id in the log) | `mofs/installer-actions.ts:112,178,231,270,322`, `mofs/supplier-po-actions.ts:99`, `mofs/[id]/vo-actions.ts:81`, `mofs/actions.ts:191`, `mofs/change-stage.ts:43,61`, `costing/[id]/approval-actions.ts:33,46`, `costing/use-as-project-value-action.ts:48,61` | Low-med: an installer payment dispute has no traceable log line. Narrows debt O4 ("other paths") to the money paths first | debt (09 is full; add to the O4 entry as the first files to switch) |
| B9 | The marketing import rollback swallows a failed clean-up (`.catch(() => undefined)`) with no log, so a half-rolled-back import leaves no trace. Related to A6 (what the rollback covers), separate from it (whether a failure is seen) | `marketing/marketing-excel-store.ts:245-248` | Low | debt (09 is full; `logServerError` in the catch, same result for the user) |

Checked, by design: `attach-file.ts:25` turns any throw into the upload-failed message so the button never sticks
(round 2 O6 fix). Clipboard catches (`copy-tsv-button.tsx:16`, `invite-share.tsx:14`) show a toast. Parse guards
(`mofs/actions.ts:64`, `impersonation.ts:83`, `security-headers.ts:19`) return null or a refusal. Storage catches in
`theme-provider.tsx` and `app-shell.tsx` carry why-comments. `session-sync.mjs:346` is round 2 O8 (debt).

### knip results that are not findings

- `docs/mockup/tokens.css`: the design source `globals.css:72` and `docs/design-system.md:3` name.
- `scripts/seed-admin.ts`, `scripts/agent/upload-dev-keys.mjs`: run by hand, documented in `docs/environments.md:63,103`.
- `netstat` (unlisted binary): the Windows system tool `free-port.mjs` calls.
- 69 "unused exports" and 34 of the 46 "unused exported types": used inside their own file, so only the `export`
  keyword is extra; shadcn `components/ui` exports are vendored. No unused dependency or devDependency.

### Fix-task load from section B

- `fix: 07`: B1 (1 file) and B6 (10 one-line deletes), on top of A8, A11, A19, so knip shows no confirmed item.
- `fix: 08`: B3 (1 file plus 4 new files), on top of A7.
- `fix: 09`: none (at its cap with section A).
- `debt`: B2, B4, B5, B7, B8, B9.

## Dependencies

State after tasks 02-04 (`pnpm outdated`, `pnpm audit` on 2026-11-27: no known vulnerabilities).

| Package | Before loop 26 | Now | Latest | Action |
|---|---|---|---|---|
| `@supabase/supabase-js` | ^2.118.0 | ^2.119.2 | 2.119.2 | 02: minor bump |
| `react`, `react-dom` | 19.3.0 | 19.3.1 | 19.3.1 | 02: patch |
| `lucide-react` | ^1.66.0 | ^1.81.0 | 1.81.0 | 02: minor |
| `cn` | ^0.5.1 | ^0.5.2 | 0.5.2 | 02: patch |
| `@types/react`, `@types/react-dom`, `tailwindcss`, `@tailwindcss/turbopack`, `vitest`, `typescript` (5.x) | open ranges | pinned to current minor | same | 02: floors raised to installed versions |
| `shadcn` (dev) | ^4.23.0 | ^4.23.1 | 4.23.1 | 02: clears the minimatch advisory (GHSA-g3hv-75wg-m249) |
| `uuid` (via exceljs) | 8.3.2 | 11.1.1 | 11.1.1 | 02: `exceljs>uuid` override for GHSA-w5hq-g745-h8pq |
| `@biomejs/biome` (dev) | 2.4.2 | 2.6.9 | 2.6.9 | 03: upgraded, markdown formatter kept off |
| `@electric-sql/pglite` (dev) | ^0.5.14 | 0.6.0 | 0.6.0 | 04: upgraded, pinned exact |
| `supabase` CLI (dev) | ^2.122.0 | ^2.122.1 | 3.4.0 | 04: deferred. v3 `db push --yes` targets local without `--remote` and `--db-url` is deprecated |
| `typescript` (dev) | ^5 | ^5.9.3 | 7.0.2 | deferred (loop D4): to debt, a compiler major |
| `@types/node` (dev) | ^24.19.2 | ^24.19.4 | 26.6.11 | kept on 24 to match Node 24 in `mise.toml` (loop D4) |
| `next` | 16.4.6 | 16.4.6 | 16.4.6 | current (upgraded before the loop, `3e807c2`) |

## Loop 26 outcome

Every A and B finding is either fixed or in `docs/debt.md`. Fixed changes are behaviour-preserving (D3).

### Fixed

| Task | Commit | IDs |
|---|---|---|
| 07 dead code and duplication | e0f8cef | A8, A11, A19, B1, B6 |
| 08 comments and oversized files | 81e2819 | A7, B3 |
| 09 performance, robustness, error handling | fd1300e | A1, A9, A18 |

### Deferred to debt.md

| IDs | Debt section |
|---|---|
| A2 | Marketing and installer lists still read past the 1000-row cap |
| A3, A4, A14, A15, A17 | Serial reads and unlogged failures on marketing, travel claims and reminders |
| A5, A6, B9 | Marketing saves and import are not atomic |
| A10, A12, A13 | Custom sample codes, photos and error handling |
| A16 | Travel claim lock message is generic |
| B2, B4, B5 | Repeated dialog footer, MOF columns and project picker |
| B7 | Costing editor components are one function each |
| B8 | Money-path server errors have no record id |

Dependencies deferred (loop 26 D4): supabase CLI 3 (reverted in task 04), TypeScript 7, `@types/node` 26.

Count: section A has 19 findings (7 fixed, 12 deferred); section B has 9 (3 fixed, 6 deferred).
