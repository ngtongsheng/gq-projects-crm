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
| 01 | VO migration | todo | - | opus/medium |
| 02 | VO sales month | todo | 01 | sonnet/high |
| 03 | VO sheet + needs-work reopen | todo | 01 | opus/medium |
| 04 | MOF change history | todo | - | opus/medium |
| 05 | Commission 180-day cut + appeals rules | todo | - | opus/medium |
| 06 | Appeals UI | todo | 05 | sonnet/high |
| 07 | Performance deltas | todo | 02 | sonnet/high |
| 08 | Reports two-step review | todo | - | opus/medium |
| 09 | Report print + BD retitle | todo | 08 | sonnet/medium |
| 10 | Site report restructure | todo | 08 | sonnet/high |
| 11 | Parity pass, docs, merge | todo | 01-10 | sonnet/medium |
<!-- status: todo | in-progress | done | blocked: <reason> -->
## Owner actions
- Start only after loop 12 is merged: `/execute-loop docs/loops/14-mof-money`.
- Tell Vicky one line when it is live, including the 180-day change (message to a person, so the owner sends it).
## Log
<!-- one line per event: YYYY-MM-DD · #NN · result · next -->
2026-11-15 · plan · loop written from drift-money-reports.md · next: wait for loop 12 merge, then #01
