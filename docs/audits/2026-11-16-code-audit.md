# Code audit — 2026-11-16

Scope: `main` at `132f454`, 943 TS files (~89k lines) in `src/`, plus `supabase/migrations` and `scripts/`.
Dimensions: performance, reusability, complexity, bugs, code quality. Report only — nothing was changed.

Baseline: `pnpm check`, `pnpm typecheck` and ~3,000 tests all pass at audit time.

## Performance

| # | Finding | Evidence | Impact |
|---|---|---|---|
| P1 | App layout pays 2–3 serial DB round trips on every page: `countPendingOwnershipRequests()`, `loadAccessOverrides()`, `isViewingAs()` are independent but awaited one after another | `src/app/(app)/layout.tsx:16-34` | High (hot path) |
| P2 | `customer_last_activity` view fetched 2–3× per page, uncached and unlimited. Sales dashboard loads it twice; customers page with `?company=` three times. The `React cache()` pattern already used for holidays/team directory is missing here | `activities/last-activity.ts:25`, `dashboard/customer-data.ts:24`, `customers/company-detail.ts:72` | Medium |
| P3 | Manager dashboard runs ~4 queries per salesperson: `loadTeamSnapshot` fans out `loadSalesStats` per filer, each including team-wide MOF/order scans. ~24 queries per MD dashboard view; DB load grows with team size | `dashboard/report-snapshot.ts:78-98`, `reports/report-data.ts:205-279` | Medium |
| P4 | MOF detail page: three sequential query rounds after the main `Promise.all` (installer POs → DO lines → per-job delivered), all depending only on already-resolved ids | `mofs/[id]/page.tsx:224-243` | Medium |
| P5 | Company detail pulls a contact's entire activity history and slices to 10 in JS — payload grows forever with the relationship | `customers/company-detail.ts:96-106` | Medium, grows |
| P6 | List pages load every row ever and filter in JS, no pagination: MOF register, Tasks, Collection orders | `mofs/mof-data.ts:65`, `tasks/task-data.ts:36`, `collection/collection-data.ts:59` | Low now, high in 2–3 yrs |
| P7 | Write RPC on the dashboard read path: every dashboard view runs `refresh_yearly_targets()` (an UPDATE across profiles) before reading; also a stampede on 1 Jan | `src/lib/yearly-targets.ts:9-22` | Low-med |
| P8 | Missing index `mof_variation_orders(confirmed_on)` (report range-filters it per salesperson); team-wide "today" diary cannot use the composite `(owner_id, starts_at)` index | migration `20261115210000`, `dashboard/todays-activities.tsx:37-40` | Low |

Done well: no `select('*')` anywhere, zero client-side fetch waterfalls, `React cache()` dedupe for profile/holidays/team, middleware verifies the JWT locally via `getClaims()`, RLS uses the initplan pattern.

## Reusability

| # | Finding | Evidence |
|---|---|---|
| R1 | Copy-pasted dialog/action lifecycle: the same `useState` + `useTransition` + `startTransition(async …)` block is re-declared in ~99 files. `installer-forms.tsx:53-90` already extracted a local `FormDialog`/`useSubmit` but it stays file-private | `update-leftover-dialog.tsx:91-99`, `payments-dialog.tsx:53-58`, +97 more; ~600–900 duplicated lines |
| R2 | Commission rules implemented twice: TS `calculateCommission` (margin tiers, late cuts, splits, cents rounding) mirrored line-for-line by SQL `commission_payable_now`/`commission_basis` | `src/lib/domain/commission.ts:238-334` ↔ migration `20261115210000` |
| R3 | Ad-hoc data layer at scale: 65 per-feature `*-data.ts` (7.3k lines) + 11 `actions.ts` (10.7k lines), 406 `.from()` calls, no shared helpers — 13× duplicated team fetch, 13× `.order("created_at")`, every file hand-writes a snake_case zod schema + camelCase transform | `report-data.ts:59-95` et al. |
| R4 | Money-format bypasses of `lib/format/money.ts`: inline `toFixed(2)` / `toLocaleString("en-MY")` in ~9 sites | `costing/quote-tsv.ts:8`, `mofs/summary/page.tsx:283`, `team-comparison-chart.tsx:47-48` |
| R5 | Components importing route code (layering inversion) | `components/app/dev-role-panel.tsx:9`, `components/app/view-as-banner.tsx:2` |
| R6 | i18n dictionary drift risk: zh/bm keys split across 6+ per-feature files; `t()` falls back to English silently, so a missing pair fails quiet, and no key-parity test exists | `lib/i18n/t.ts:12` |

Done well: auth matrix in one place (`lib/auth/pages.ts`, gating all 116 entry points, not bypassed); shared `DataTable` (56 files), `PrintLayout`, `StatusBadge` (81 files); ~70 tested rule modules in `lib/domain`.

## Complexity

| # | Finding | Evidence |
|---|---|---|
| C1 | 500-line mixed-concern files: `mofs/mof-form.tsx` (570 — draft state + money calc + 6 JSX sections), `samples/pickup-form-dialog.tsx` (513 — 13 `useState` hooks), `installation/job-form.tsx` (509), `costing/quote-view.ts` (508), `reports/report-data.ts` (506); `ui/sidebar.tsx` (701) is shadcn-generated | |
| C2 | 47 `jobRole ===` string comparisons scattered outside `lib/auth`, worst a nested ternary for a label | `lib/auth/pages.ts:151-156` |

Depth is fine — no deep logic nesting; it is breadth in the big files. The existing split pattern (`mof-form-fields.tsx`, `mof-lines-editor.tsx`) is the right continuation.

## Bugs

The classes the parity sweep fixed (embed-null 500s, unfiltered UPDATEs, wizard Promise effect, SECURITY DEFINER hygiene) are closed — sibling code was verified to carry the fixes. What remains:

| # | Finding | Severity |
|---|---|---|
| B1 | Concurrent leave-entitlement save shows the wrong error: update-then-insert instead of upsert; two editors racing on a person+year with no row → second insert hits the PK, 23505 unmapped → generic "Could not save. Try again." PK prevents corruption | Low |
| B2 | "Late" flag is judged retroactively by today's due time: `isLate` reads current `app_settings.dueTime`; change the setting and past reports' late flags flip. Due time is not stored at submission | Low (business-rule suspicion) |
| B3 | Dead `SidebarMenuSkeleton` seeds `useState(() => Math.random())` — unused anywhere; would hydrate-mismatch if ever used | Low (dead code) |
| B4 | Clock-dependent initial state in ActivityForm: near-midnight the planned/completed default can flip; only safe because it is client-mounted today | Suspicion, unverified |
| B5 | View-as RPC allowlist trap: a future read-only RPC not added to `READ_ONLY_FUNCTIONS` fails with the misleading "View only – not saved." message | Low |
| B6 | One bare `.then` without `.catch` — rejection flows into the surrounding `Promise.all` like siblings; consistent, info only | Info |

Done well: DB constraints backstop every read-then-write, with SQL errcodes mapped to plain messages; `scripts/migrations-update-where.test.ts` permanently guards the unfiltered-UPDATE bug class.

## Code quality

| # | Finding | Evidence |
|---|---|---|
| Q1 | ~36 component files render raw English without `t()` out of ~229 UI files — silently shows English to BM/Chinese users | `customers/company-edit-dialog.tsx:74,127`, `mof-form.tsx`, `booking-form.tsx` |
| Q2 | Supabase test mock copy-pasted across ~53–63 test files — no shared fake in `src/lib/supabase/`; `people/actions.test.ts` alone is 698 lines | |
| Q3 | Dead exports kept alive by their own tests: `sqftToM`, `landedPerM`, `lineAreaM`, `totalAreaM`, `effectiveSalesTarget` — zero production callers | |
| Q4 | `shadcn` CLI in `dependencies` (should be dev or removed); `cn` npm package wrapped by a one-line `src/lib/utils.ts` | `package.json:32` |
| Q5 | `noUncheckedIndexedAccess` off in tsconfig despite `strict: true`; `src/components/ui` excluded from Biome, so hand-edits there escape all checks | `biome.json:17` |
| Q6 | One data-rewriting backfill migration without a rollback note | `20261106110000_company_rating.sql` |

Done well: suppression-free — 0 `as any`, 0 `@ts-ignore`, 0 `console.log`, 0 TODO/FIXME, 0 `.only/.skip`; all 46 pages are server components with `"use client"` only at leaves; zod at every boundary; ~80 behavior tests over domain logic.

## If you act on anything

Ranked by payoff: **P1** (one `Promise.all` in the layout), **R1** (promote the file-private `FormDialog`/`useSubmit`), **Q1/R6** (i18n sweep + a zh/bm key-parity test), **P2/P3** (dashboard query consolidation), **R2** (pick an authoritative commission engine). Nothing here blocks the loop 22 handoff.

## Verification (2026-11-16)

Checked against `main` at `ffc1ee0` when loop 23 was planned (loop.md D2). Corrections to the text above:

- Q3 holds for `effectiveSalesTarget` only. `sqftToM2`, `landedPerM2`, `lineAreaM2` and `totalAreaM2` have production callers.
- Q4: the `cn` wrapper claim is wrong. UI files import the `cn` package directly.
- P7 runs on the sales dashboard, `/people` and `/performance`, not on every dashboard.
- Q1: the count of about 36 files was not reproduced; start with a `grep` before sweeping.

Fixed in loop 23: P1, P2, P4, B1, B3, Q3, Q4, R6.

Every other finding is logged in `docs/debt.md` (loop 23 #07 entries: P3, P5, P6, P7, P8, R1, R2, R3, R4, R5, C1, C2, Q1, Q2, Q5, Q6, B2, B4, B5). Q1 links to the dictionary-gap entry from loop 23 #06.
