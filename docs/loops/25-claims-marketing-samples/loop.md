# Loop 25: Travel claim, Marketing expense, Custom samples
Orchestrator: frontier
## Goal
Vicky's 16 Nov demo (`assets/gqp-office-demo.html`, change spec `assets/demo-changes.md`) is built on
`loop/25-claims-marketing-samples`. That means the simple monthly travel claim replaces the old monthly claim (old
tables dropped), the new Marketing expense page (log, dashboard, vendors, events, prepaid, give-away, Excel), the new
Custom samples page (loan, 2-step return, give away, overdue reminder), and dashboard reminders. Checks pass, branch
pushed; owner pushes to `main`.

## Decisions
| ID | Decision | Why | Rejected |
|---|---|---|---|
| D1 | New `travel_claims` table; old `monthly_claims`, `monthly_claim_expenses`, `monthly_claim_commissions`, `monthly_claim_log`, their functions, triggers and claim-receipt storage policies are dropped with all old claim code | Demo replaces the model wholesale; reshaping keeps nothing useful. Drop needs the `data-loss-approved` label at go-live | Keep old tables hidden; reshape `monthly_claims` |
| D2 | Commission leaves the claim. Commission page unchanged (MD/accounts record payouts; its own appeal UI stays). Claims "Appeals" tab goes; `commission_appeals` table kept | Demo: "claimed separately on the Commission page", no self-claim there | Salesperson self-claim on Commission page |
| D3 | Release needs the SAME claim month's monthly report Submitted/Reviewed (`tcRep`); "Verified with Vicky" is a soft warning (second tap releases) | Follow demo exactly (owner) | Required tick; previous month's report |
| D4 | Excel import/export with `exceljs` (new dependency, named in the PR) | Real .xlsx as the demo shows; no CDN at runtime | Paste import + CSV |
| D5 | Accounts (Jany) is view-only on Marketing expense and Custom samples; she still releases travel claims and gets the prepaid-low reminder | Demo + app-wide `isReadOnly` rule | Page-level exception |
| D6 | One loop, three slices (claims 02-05, custom samples 06-08, marketing 09-15), reminders 16, docs 17 | One branch, one data-loss approval | Three loops |
| D7 | Cut-off day stays in `app_settings` key `claims` (`cutOffDay`, value kept); other claim settings keys and the settings screen are removed; no cut-off editor | Demo removes the settings view | Keep an editor |
| D8 | Where the demo has a prototype gap, use the app's existing pattern and log it in `docs/decisions.md`: deletes ask to confirm, `tuft`/`mkt` get real sidebar icons, prepaid statement sorts by date then entry, director's tab label is "My travel claim" | Demo bugs, not business rules (`demo-changes.md` §6) | Copy the bugs |
| D9 | Marketing chart is plain SVG/CSS with theme tokens; no chart library | Ladder: no dependency needed for 12 stacked bars | recharts |
| D10 | Installer contacts and HR packages/outstation rules: no work. Already built (loops 16, 18, 24) and unchanged in the demo | Diff shows them byte-identical | Re-check parity |
| D11 | Custom samples photo goes to the existing storage helper (`src/lib/storage/`) as a new area, not a data URL | App stores files in Storage | Data URL in a column |
| D12 | Preflight: push to `main` deploys and applies migrations live (incl. D1 drop); repo denies `git push *:main*`. Owner action | Owner looks before live migrations | Allow rule |
| D13 | Preflight: `pnpm add exceljs` is not allowed. Task 01 adds allow rule `Bash(pnpm add exceljs*)` to `.claude/settings.json` | Owner chose allow rule | Owner installs |
| D14 | Loop runs in a worktree on `loop/25-claims-marketing-samples`; executor merges `main` in, runs checks, pushes the branch, stops | D12 | |

## Tasks
| # | Task | Status | Depends | Tier |
|---|---|---|---|---|
| 01 | exceljs allow rule; adopt new demo; page registry, icons, access defaults | done | | standard |
| 02 | Travel claims schema, RLS, cut-off setting | done | 01 | frontier |
| 03 | My travel claim: form, submit/update, print | done | 02 | standard |
| 04 | All claims list and check/release sheet | done | 03 | standard |
| 05 | Remove the old monthly claim (migration + code) | done | 04 | frontier |
| 06 | Custom samples schema, photo storage, loan-days setting | done | 01 | frontier |
| 07 | Custom samples list, record/edit, borrow, detail | done | 06 | standard |
| 08 | Custom samples return, give away, overdue remind, settings | done | 07 | standard |
| 09 | Marketing expense schema and RLS | done | 01 | frontier |
| 10 | Expense log and categories editor | in-progress | 09 | standard |
| 11 | Marketing dashboard and chart | todo | 10 | standard |
| 12 | Vendors and part-timers | todo | 10 | standard |
| 13 | Events: costs, budget vs actual, print | todo | 10 | standard |
| 14 | Prepaid accounts and sample give-away | todo | 12 | standard |
| 15 | Excel import and export | todo | 11, 12, 13, 14 | standard |
| 16 | Dashboard reminders | todo | 04, 08, 14 | standard |
| 17 | Docs: decisions, features, what's new, debt, roadmap | todo | 01-16 | economy |
<!-- status: todo | in-progress | done | blocked: <reason> -->

## Owner actions
- Before execution: push the loop-25 planning commit on `main` (`git push origin main`); the repo denies it
  for the planner.
- After #17: look over the branch, then from the worktree run `git push origin HEAD:main`. That deploys the app and
  applies migrations live, including #05's drop of the old claim tables: add the `data-loss-approved` label per the
  `deploy` skill. Tell Vicky old claims are gone from the app (she has the paper forms).

## Log
<!-- one line per event: YYYY-MM-DD · #NN · result · next -->
2026-11-17 · plan · loop written from Vicky's 16 Nov demo · next: /execute-loop docs/loops/25-claims-marketing-samples
2026-11-17 · plan · decision · skipped issue #50 and catch-up hook · they target Vicky's laptop, this is the owner's machine
2026-11-17 · exec · decision · worktree branched from local `main` (planning commit unpushed) · keeps the plan in the branch without copying
2026-11-17 · #01 · started · standard
2026-11-17 · #01 · decision · D13 allow rule not added: classifier denied the settings edit; `pnpm add exceljs` ran without it, so it is not needed · owner may add it by hand
2026-11-17 · #01 · decision · migration widens `role_page_access.page_key` check for `tuft`/`mkt`; hrefs `/custom-samples`, `/marketing` (07/10 may change)
2026-11-17 · #01 · done · check, typecheck, 3105 tests pass · next: #02
2026-11-17 · #02 · started · frontier
2026-11-17 · #01 · decision · migration guard flags #01's `drop constraint role_page_access_page_key_check` (re-added wider, no data lost) · covered by the `data-loss-approved` label already needed at go-live (D1)
2026-11-17 · #02 · decision · rules live in trigger `guard_travel_claim_write`; "approved" report also opens release; md/accounts cannot check their own claim; a submitted claim needs one non-zero amount; no delete; old claim settings code left for #05
2026-11-17 · #02 · done · 17 PGlite tests; check, typecheck, 3122 tests pass · next: #03
2026-11-17 · #03 · started · standard
2026-11-17 · exec · decision · `pnpm dev` and parity checks not run in this loop: they need the branch migrations on the shared test copy, which would put #05's drop there before the owner approves it and break Vicky's previews of `main` · owner runs one parity pass before pushing
2026-11-17 · #03 · decision · reuses `monthly-claim.ts` helpers (`claimMonthOf`, `claimPeriod`, `claimCapsOn`), `loadClaimSettings`, `ClaimPrintButton`, `ClaimBanner`: #05 must keep or move them; month outside the 6 offered is refused; report line has no on-time/late text
2026-11-17 · #03 · done · check, typecheck, 3141 tests pass · next: #04
2026-11-17 · #04 · decision · director files no monthly report (`reportKindFor` → null), so #02's release gate would block every director claim; #04 amends the unapplied travel_claims migration so roles with no report skip the gate
2026-11-17 · #04 · started · standard
2026-11-17 · #04 · decision · release gate applies only to job_role sales/bd/site (mirrors `reportKindFor`); Vicky soft warning is client-only; sheet opens from an "Open" button; review actions import `canManageClaims` from `claim-flow.ts` (#05 must move it)
2026-11-17 · #04 · done · check, typecheck, 3157 tests pass · next: #05
2026-11-17 · #05 · started · frontier
2026-11-17 · #05 · retry · first pass removed the Commission page's appeal decide dialog (against D2 and the task text); sent back to restore it with an entry point on the Commission page
2026-11-17 · #05 · decision · appeal decide dialog restored; MD and accounts open it from a Decide button on Commission rows with a pending appeal (no separate list); `claim_people()` kept; leftover `attachments/claims/` receipts logged in debt.md; example travel claims not added; HR policy example text still describes the old claim
2026-11-17 · #05 · decision · `data-loss-approved` label at go-live also covers the claims-setting trim (mileage rate, km/day, travel limit, needReport removed; cutOffDay kept), which the guard does not flag
2026-11-17 · exec · note · full suite hits 30s PGlite hook timeouts under machine load ~21; passes with `--maxWorkers=4` (284 files, 3023 tests)
2026-11-17 · #05 · done · grep clean; check, typecheck, 3023 tests pass · next: #06
2026-11-17 · #06 · started · frontier
2026-11-17 · #06 · decision · read access fixed to everyone but site; "not received" kept as `not_received_on date[]` on the loan; customer/project are free text; photo id chosen before upload; settings key `customSamples`; due date set by the database; details in docs/decisions.md
2026-11-17 · #06 · done · 43 PGlite tests; check, typecheck, 3065 tests pass · next: #07
2026-11-17 · #07 · started · standard
2026-11-17 · #07 · decision · sample opens from its code button; delete asks to confirm; customer suggestions list all companies; MD's borrow picker uses `task_people()` (sales/bd/director only; other `sells` people can self-borrow but are not offered) · #17 logs the picker gap in debt.md
2026-11-17 · #07 · done · check, typecheck, 3094 tests pass · next: #08
2026-11-17 · #08 · started · standard
2026-11-17 · #08 · decision · Remind uses `profiles.whatsapp` (not `site_reminders`), read server-side with the service key for keepers only, borrowers only; no reminder counter stored; sheet stays open after return/give away
2026-11-17 · #08 · done · check, typecheck, 3115 tests pass · next: #09
2026-11-17 · #09 · started · frontier
2026-11-17 · #09 · decision · enum values stored as keys (UI translates); categories/vendors/events linked by id (delete blocked while used, so no "older categories" panel); prepaid balance from view `marketing_prepaid_balances`, never stored; giveaway supplier/given_to free text; UI tasks insert vendor rows themselves (no auto-add); RLS uses fixed role lists like custom samples
2026-11-17 · #09 · done · check, typecheck, 3145 tests pass · next: #10
2026-11-17 · #10 · started · standard
