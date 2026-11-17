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
| 01 | exceljs allow rule; adopt new demo; page registry, icons, access defaults | todo | | standard |
| 02 | Travel claims schema, RLS, cut-off setting | todo | 01 | frontier |
| 03 | My travel claim: form, submit/update, print | todo | 02 | standard |
| 04 | All claims list and check/release sheet | todo | 03 | standard |
| 05 | Remove the old monthly claim (migration + code) | todo | 04 | frontier |
| 06 | Custom samples schema, photo storage, loan-days setting | todo | 01 | frontier |
| 07 | Custom samples list, record/edit, borrow, detail | todo | 06 | standard |
| 08 | Custom samples return, give away, overdue remind, settings | todo | 07 | standard |
| 09 | Marketing expense schema and RLS | todo | 01 | frontier |
| 10 | Expense log and categories editor | todo | 09 | standard |
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
