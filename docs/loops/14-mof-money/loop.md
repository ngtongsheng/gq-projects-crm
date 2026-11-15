# Loop 14: MOF & money
Orchestrator: sonnet/high
## Goal
MOF, Commission, Performance and Reports match Vicky's demo (`docs/mockup/gqp-office-demo.html`) per
`docs/office-parity/drift-money-reports.md` (roadmap step 3A): variation orders, field-level MOF change history,
180-day late cut and appeals, performance deltas, two-step report review with print, restructured site report.
Parity checked per `docs/office-parity/parity.md`. Merged to `main`. Starts after loop 12 is merged; may run in
parallel with loop 15 People & HR.
## Decisions
| ID | Decision | Why | Rejected |
|---|---|---|---|
| D1 | New `mof_variation_orders` table. Each non-zero `mofs.vo_amount` is backfilled as one VO dated at the MOF's confirmation date. A trigger keeps `mofs.vo_amount` = sum of VOs (column kept, read by commission and RLS SQL). VO cost adds into MOF cost | Owner choice; no value lost, past monthly sales unchanged, no data-loss approval needed | Dropping `vo_amount`; keeping it as a legacy field beside VOs |
| D2 | A VO counts as sales in the month it is confirmed (MOF summary, performance). Commission stays collection-based | Demo `salesPieces` | Counting VOs in the MOF month |
| D3 | Second late cut moves to 180 days: code default and the saved `app_settings` value (only where it still equals 120). Applies to all unpaid commission; paid payouts are never recalculated | Owner choice; salespeople only gain | Only MOFs after go-live |
| D4 | Late-collection appeals live on the Commission page (appeal and decide dialogs, favour pill, Appeals tab). The Claims loop moves the tab. Approved appeal sets that late cut to 0 | Owner choice; Claims comes later | Deferring appeals |
| D5 | Field-level MOF history in a new table; existing `mof_total_changes` rows are copied in; the old table is kept | Demo `mofDiff`; never drop data | Replacing the old table |
| D6 | Reports: team lead (`reports_to`) or md reviews, then md gives the final approval for non-director kinds; director reports go to md only. Reports already reviewed before go-live count as final-approved. "Vicky" in the demo means the `md` role | Demo `vickyOk`; no hard-coded people | Name-based rules |
| D7 | WhatsApp reminders and the VO notice go to the Integration loop; the "additional work" alert is in-app only. Performance chart is plain SVG, no new dependency. Prorated targets use the existing `profiles.yearly_target` with `joined_on`/`left_on` (per-year targets come with People & HR) | Scope; no chart lib in the repo | Adding a chart library |
| D8 | One branch `loop/14-mof-money` from `main` after loop 12 merges, one commit per task, one PR. Rebase on `main` before merging; rename our migrations if `main` has newer ones. Preflight: no new allow rules; PR merge deploys as in loops 07-13 | Established path | - |
| D9 | Demo contradictions: follow the more specific rule, log in `docs/decisions.md` | Roadmap rules | Asking each time |
## Tasks
| # | Task | Status | Depends | Model/Effort |
|---|---|---|---|---|
| 01 | VO migration | done | - | opus/medium |
| 02 | VO sales month | done | 01 | sonnet/high |
| 03 | VO sheet + needs-work reopen | done | 01 | opus/medium |
| 04 | MOF change history | done | - | opus/medium |
| 05 | Commission 180-day cut + appeals rules | done | - | opus/medium |
| 06 | Appeals UI | done | 05 | sonnet/high |
| 07 | Performance deltas | done | 02 | sonnet/high |
| 08 | Reports two-step review | done | - | opus/medium |
| 09 | Report print + BD retitle | done | 08 | sonnet/medium |
| 10 | Site report restructure | done | 08 | sonnet/high |
| 11 | Parity pass, docs, merge | in-progress | 01-10 | sonnet/medium |
<!-- status: todo | in-progress | done | blocked: <reason> -->
## Owner actions
- Start only after loop 12 is merged: `/execute-loop docs/loops/14-mof-money`.
- Tell Vicky one line when it is live, including the 180-day change (message to a person, so the owner sends it).
## Log
<!-- one line per event: YYYY-MM-DD · #NN · result · next -->
2026-11-15 · plan · loop written from drift-money-reports.md · next: wait for loop 12 merge, then #01
2026-11-15 · worktree · ../gq-projects-crm-loops/14-mof-money on loop/14-mof-money · next: #01
2026-11-15 · #01 · done · checks + 1716 tests pass · next: #02, #04, #05, #08 independent; #03 needs 01
2026-11-15 · #01 · decision · VO cost in own table mof_variation_order_costs (RLS can_see_mof_cost) so salespeople never see cost; VO cost added via SQL view mof_cost_totals, mof-totals.ts unchanged; save_mof refuses a differing vo_amount; commission_basis/commission_payable_now and import_mofs redefined in the VO migration (task 05 starts from that version) · why: keep sum and cost rules consistent
2026-11-15 · #02 · done · checks + 1726 tests pass · next: #03
2026-11-15 · #02 · decision · new order-sales.ts rule shared by performance and report-stats; mof-summary.ts unchanged (no monthly view there); report counts and performance margin/count stay by LOA month/year · why: D2 limited to sales value
2026-11-15 · #03 · done · checks + 1750 tests pass (screens not browser-checked; parity pass #11 covers) · next: #04
2026-11-15 · #03 · decision · reopen rule in SQL reopen_for_additional_work; site stage -> installation (80%, no 95%); only a new VO reopens; no VO delete; alert on Site Supervisor dashboard only; saveMof ignores posted VO amount · why: app progress derives from site stage; demo parity
2026-11-15 · #04 · done · checks + 1790 tests pass · next: #05
2026-11-15 · #04 · decision · mof_changes stores raw values, trigger copies every mof_total_changes row in; save_mof gets changes jsonb arg; "job complete" = site_stage completed; diff computed in app (register editors could post a wrong list directly; DB blocks everyone else) · why: demo mofDiff parity, minimal schema
2026-11-15 · #05 · done · checks + 1823 tests pass twice · next: #06
2026-11-15 · #05 · decision · appeals decided by md + accounts; approved waiver covers all late cuts on that person's line for that order; rejected appeal kept, new appeal = new row; saved 120 left alone if first cut starts at 180+ · why: demo parity, keep history, keep cut order valid
2026-11-15 · #05 · decision · vitest testTimeout/hookTimeout 30s: DB tests build from all migrations and passed 5s in full parallel runs (public-holidays and commission-appeals flaked) · why: root cause is migration count growth, not the tests
2026-11-15 · #06 · done · checks + 1829 tests pass; browser parity (sales/md/accounts, 390px) NOT run, moved to #11 · next: #07
2026-11-15 · #06 · decision · Appeals tab md+accounts only; Appeal button only on own line with a cut above 0 and no standing appeal; Decide hidden on own appeal; pill text "Special approval by X", no emoji · why: demo parity + DB rules
2026-11-15 · #07 · done · checks + 1849 tests pass; browser parity + rendered chart NOT checked, moved to #11 · next: #08
2026-11-15 · #07 · decision · proration over actual year days (leap-aware); hidden-director rule covers Sales + Marketing Director; best month ties go to earliest; team panel omits visits/new customers/pipeline; dark-mode chart tokens fail lightness/chroma validator, tokens left alone (debt) · why: scope, existing tokens
2026-11-15 · #08 · done · checks + 1864 tests pass (resumed after usage limit) · next: #09
2026-11-15 · #08 · decision · new status approved; MD review = approval; site reports stay with Sales Director (demo contradicts itself, D9); salesperson with no lead: MD only; BD director reports go to md only · why: loop 11 team rule, DB enforces each step
2026-11-15 · #08 · decision · Marketing Director (bd) may review team sales reports in DB but has no Team Reports page; logged in debt.md, not widened · why: page access is a scope/role decision outside this loop
2026-11-15 · #09 · done · checks + 1864 tests pass; Chrome print preview NOT checked, moved to #11 · next: #10
2026-11-15 · #09 · decision · print sheet hidden-on-screen (print:hidden on screen content) not a separate overlay; PrintSignatureRow got optional 3-column prop; no "Printed" date stamp · why: simplest reuse of print-layout
2026-11-15 · #10 · done · checks + 1872 tests pass; browser/print not checked, moved to #11 · next: #11
2026-11-15 · #10 · decision · OT table + activity summary removed from report screen/print only, frozen otHours kept (site dashboard uses it); itinerary live from logs + confirmed bookings; remarks reuse existing issues/support text · why: smallest change, no data change
