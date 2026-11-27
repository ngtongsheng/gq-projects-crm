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
| A1 | **Silent 1000-row cap, which leads to data loss on export then Replace import.** Every marketing loader reads with no paging, and PostgREST stops at `max_rows = 1000` without an error. The export route uses those loaders, but the Replace import pages through **all** ids (`allIds`) and deletes them. With 1000+ expenses (likely after importing years of the Excel history): export, edit, then Replace import deletes every expense the export missed. Dashboard and log totals are also short with no warning | `marketing/marketing-data.ts:93-99`, `marketing-prepaid-data.ts:89-95`, `marketing-giveaway-data.ts:20-26`, `marketing/export/route.ts:20-28` vs `marketing-excel-store.ts:33-48,167,241`; `supabase/config.toml:18` | High once a table passes 1000 rows; money figures wrong before that point is noticed | fix: 09 (page every loader the export uses; do it before the history import) |
| A2 | Dashboard, expense log and events view each send every expense of every year to the browser and filter there. The payload grows forever, and A1 cuts it at 1000 | `marketing/page.tsx:124,176,250`; `marketing-data.ts:92` | Low now, grows yearly | debt |
| A3 | The page awaits `loadMarketingCategories()` before the view's own `Promise.all` starts, so every marketing view makes two round trips in series | `marketing/page.tsx:55` | Low (one extra round trip per view) | fix: 09 |
| A4 | A workbook that fails to parse is swallowed with `.catch(() => null)` and not logged. A parser bug looks the same as "not an xlsx file" | `marketing/marketing-excel-actions.ts:69-75` | Low (no trace for a real bug) | fix: 09 |
| A5 | Saving categories deletes first, then upserts, in two writes. A failed upsert (for example 23505 on a name swap, since `lower(name)` is a non-deferrable unique index) leaves the deletes done and the renames not saved | `marketing/marketing-category-actions.ts:44-71`; migration `20261121140000_marketing_expense.sql:42` | Low (half-saved list; swapping two names always fails with "Two categories have the same name") | debt |
| A6 | The import rollback undoes only the inserted lines. New categories, new vendors, new events and event detail updates stay after a failure. The doc comment says a failure "leaves the old data in place" | `marketing/marketing-excel-store.ts:135-138,171-179` | Low (leftover categories/vendors after a failed import) | debt |
| A7 | `parseMarketingWorkbook` is one function of about 300 lines (expenses, events, prepaid and give-aways read in one body) in a 452-line file | `marketing/marketing-excel-import.ts:122-419` | Maintainability: hard for an agent to change one sheet safely | fix: 08 (split per sheet kind, move code unchanged) |
| A8 | Marketing imports a customers loader from the custom-samples feature (`loadCustomerNames` reads `companies`) | `marketing/page.tsx:8`; `custom-samples/custom-samples-data.ts:123-134` | Layering: a change to custom samples can break marketing | fix: 07 (move to `customers/`) |

Done well: money stays in `numeric`, balances are computed in a database view, every FK and unique violation maps
to a plain message, Replace-import inserts before it deletes, and exceljs stays on the server (no client bundle cost).
Not new: the seven action files repeat the same save/delete skeleton (another case of round 1 R1/R3, already in debt).

### Custom samples

| ID | Finding | Evidence | Impact | Tag |
|---|---|---|---|---|
| A9 | Every page load signs each photo with its own storage request (`createSignedUrl` per row inside `Promise.all`). supabase-js has `createSignedUrls(paths, expiresIn)` for one batch call | `custom-samples/custom-samples-data.ts:64-70`; `lib/storage/signed-url.ts:30-40` | Low-med: N storage calls per view, growing with the sample library | fix: 09 (batch signer in `lib/storage`, same links) |
| A10 | `void openCustomSamplePhoto(id).then(...)` has no rejection handler, so a failed or redirected server action becomes an unhandled rejection in the browser | `custom-samples/custom-sample-sheet.tsx:199-201` | Low | fix: 09 |
| A11 | `NOT_FOUND`, `TRY_AGAIN` and `sampleId` are declared identically in two action files (`NOT_FOUND` also in the input file). The feature already has `custom-sample-refusal.ts` for shared refusals | `custom-sample-actions.ts:28-31`, `custom-sample-loan-actions.ts:15-19`, `custom-sample-input.ts:5` | Low (drift risk) | fix: 07 |
| A12 | The next `TS-###` code is `max()+1` with no lock. Two samples recorded at once collide on `code unique`, and the second gets "That code is already used." (retry works). Same pattern as round 2 D7 | migration `20261121130000_custom_samples.sql:169-173`; `custom-sample-actions.ts:98-99` | Low | debt |
| A13 | Replacing a sample's photo keeps the old file in storage. List thumbnails (44 px) download the full photo (`unoptimized`) | `custom-sample-actions.ts:84`; `custom-samples/custom-sample-photo.tsx:12-19` | Low (storage and phone data) | debt |

Done well: the return flow is one guarded update per step with idempotent filters, the database words its own
refusals (`plainRefusal`), and the sheet refreshes the 5-minute photo link when it opens.

### Travel claims

| ID | Finding | Evidence | Impact | Tag |
|---|---|---|---|---|
| A14 | `submitTravelClaim` error paths: after a 23505 race the second `find()` error goes unlogged, and a zero-row update logs `saved.error` while it is `null` | `claims/travel-claim-actions.ts:87-90,98-104` | Low (failures with no useful log line) | fix: 09 |
| A15 | Settings load and the claim lookup run in series, though they are independent | `claims/travel-claim-actions.ts:39,63` | Low | fix: 09 |
| A16 | Every 42501 on update shows "This claim is released", but the guard raises 42501 for five other reasons (overtime for non-site staff, not the owner, ...). Refusal mapping also differs by feature: custom samples pass the database message through `plainRefusal`, and claim review matches `message.includes(NO_REPORT)` | `claims/travel-claim-actions.ts:99`; migration `20261121110000_travel_claims.sql:103-165`; `claims/travel-claim-review-actions.ts:110-115`; `custom-samples/custom-sample-refusal.ts` | Low (misleading message) | debt (message change; promote `plainRefusal` to `lib`) |
| A17 | `countClaimsReadyToRelease` (MD and HR home reminders) waits for the claims query before it starts `loadClaimPeople()`, which does not depend on it. It also reads every monthly report ever filed by those people, when only the months of submitted claims are needed | `claims/ready-to-release-data.ts:20-32` | Low, grows by 12 rows per person per year | fix: 09 (parallelise; filter `.in("month", ...)`, same result) |

Done well: one-update review with a status precondition (no half-saved check), a database guard that mirrors
`reportKindFor`, and cents comparison for the final amount.

### Home reminders

No new findings. The plan loads only what the role acts on, all in parallel. Note: `officeSamples` hard-codes a
third role list next to `custom-sample-access.ts` (`dashboard/home-reminders.ts:40`). That is another case of round 1
C2, already in debt.

### Loops 23-24 changes (auth, headers, logging, agent scripts)

| ID | Finding | Evidence | Impact | Tag |
|---|---|---|---|---|
| A18 | **Session-sync drops the git result when `gh` fails.** If either issue list fails (offline, gh logged out, 8 s timeout), `main` replaces the whole sync with zeros. A pull that changed CLAUDE.md or the skills then prints no "Rules updated" line, and "behind origin/main" is hidden | `scripts/agent/session-sync.mjs:328-341` | Medium for Vicky's agent: it keeps working on stale rules after an update | fix: 09 (`{ instructions: [], replies: [], ...git, catchUpDue }`, plus a regression test) |
| A19 | Dead dictionary entries: "Nothing here yet." (marketing) and "Keep this under 300 characters." (travel claim) are in zh and bm, but no code uses them | `lib/i18n/zh-marketing.ts:52`, `bm-marketing.ts:61`, `zh-travel-claim.ts:60`, `bm-travel-claim.ts:65` | Trivial | fix: 07 (remove both pairs; parity stays) |

Done well: the CSP and headers are a pure, tested function. `logServerError` copies only code, message and details.
`closeImpersonationLog` closes round 2 S4. The missing service key now throws (round 2 S3). `global-error.tsx`
matches the Next 16 `retry` API. Not new: new `console.error` calls in `sign-out.ts:23`, `current-profile.ts`,
`middleware.ts` and `auth/callback` are covered by debt "Error logs on other paths lack context" (O4).

### Fix-task load

- `fix: 07`: A8, A11, A19 (about 7 files)
- `fix: 08`: A7 (1 file plus the split files)
- `fix: 09`: A1, A18, A9, A17, A3, A14, A15, A4, A10 (about 8 files), in rank order
- `debt`: A2, A5, A6, A12, A13, A16
