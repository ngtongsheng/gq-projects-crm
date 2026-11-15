# Loop 18: Installation & stock
Orchestrator: sonnet/high
## Goal
Installation (installer directory, supervisor bookings, DO numbering, lines, print, delivery log), Stock, Samples and
Leftover match Vicky's demo (`vInst` ~3802, `vSamples` ~3452, `vLeftover` ~3565) per
`docs/office-parity/drift-site-stock.md` (roadmap step 4B, second half). Parity per `docs/office-parity/parity.md`.
Merged to `main`. Starts after loop 17 merges.
## Decisions
| ID | Decision | Why | Rejected |
|---|---|---|---|
| D1 | New `installers` table backfilled from distinct trimmed names in `jobs.installer` (and `installer_pos`/`installer_claims` names); jobs get an `installer_id`. Text columns are kept (no data loss); dropping them is a later approved step | Owner choice | Dropping text now |
| D2 | DO numbers issued by the app: next = max(used, voided) + 1, seed 5541, shown as MOF no + 4 digits. Deleted numbers go to a void list, never reused. md, purchasing (`support`) or accounts set the next number once, must exceed the last used. Issuing is a DB function (no race) | Demo `nextDO()` | Client-side numbering |
| D3 | "Done" on a job is blocked until it has a DO number; DO print warns (not blocks) when MOF payment check or DO pre-approval is unticked | Demo | Hard block on print |
| D4 | Samples SR-0001 numbering same pattern as D2; saving a pickup form deducts sample stock. Best Link number + Drive folder are settings. Sample edit: purchasing, stock arrangers, accounts, marketing | Demo | - |
| D5 | Leftover adds "Collected by supervisor", keep-why, transport, credit note and `sold` allocations to other projects; existing statuses keep their rows | Extend, keep values | Rebuilding leftover |
| D6 | Supplier emails: "Email suppliers (N)" opens `mailto:` drafts; no sending service | No email provider in the repo | Adding one |
| D7 | One branch `loop/18-installation-stock` from `main` after loop 17 merges, one commit per task, one PR. Rebase before merging. Preflight: none; PR merge deploys as in loops 07-17. Demo contradictions: specific rule wins, logged | Established path | - |
## Tasks
| # | Task | Status | Depends | Model/Effort |
|---|---|---|---|---|
| 01 | Installers migration + backfill | done | - | opus/medium |
| 02 | Installer directory + calendar views | done | 01 | sonnet/high |
| 03 | Supervisor bookings + job form extras | done | 01 | sonnet/high |
| 04 | DO numbering + lines migration | done | - | opus/medium |
| 05 | DO on the job + print + delivery log | in-progress | 04 | sonnet/high |
| 06 | Stock page deltas | todo | - | sonnet/medium |
| 07 | Samples migration + rules | todo | - | opus/medium |
| 08 | Samples page + pickup form print | todo | 07 | sonnet/high |
| 09 | Leftover migration + rules | todo | - | opus/medium |
| 10 | Leftover page | todo | 09 | sonnet/high |
| 11 | Chinese/BM strings + dev seed | todo | 02, 03, 05, 06, 08, 10 | sonnet/medium |
| 12 | Parity pass, docs, merge | todo | 01-11 | sonnet/medium |
<!-- status: todo | in-progress | done | blocked: <reason> -->
## Owner actions
- Start only after loop 17 is merged: `/execute-loop docs/loops/18-installation-stock`.
- After go-live, tell Vicky (owner sends): set the next DO number once in Installation settings.
## Log
<!-- one line per event: YYYY-MM-DD · #NN · result · next -->
2026-11-15 · plan · loop written from drift-site-stock.md (Installation, Stock, Samples, Leftover) · next: wait for loop 17 merge, then #01
2026-11-15 · #01 · started in worktree ../gq-projects-crm-loops/18-installation-stock · next: verify
2026-11-15 · #01 · done, verified (check, typecheck, test, guard:migrations) · next: #02
2026-11-15 · #01 · decision · added installers.description, backfilled mofs.installer_name too, link_job_installer sync trigger keeps text+installer_id in step · subagent deviation, sensible
2026-11-15 · #02 · started
2026-11-15 · #02 · done · verified: check, typecheck, test (2626) pass; parity deferred to #12 (migration not on test copy; also verify `delivery_orders` `jobs!inner` embed with `.eq("jobs.status","done")` and paged `jobs` read)
2026-11-15 · #02 · decision · no "Coming up" table, no Team size, text WhatsApp link, phone required on save; Site supervisors tab comes in #03 · subagent deviations, sensible
2026-11-15 · #02 · decision · renaming an installer does not rewrite old job text (RLS blocks editors from jobs); calendar filters by installer_id · fix in #12 via a trigger on installers, or log as debt
2026-11-15 · #03 · started
2026-11-15 · #03 · done · verified: check, typecheck, test (2644), guard:migrations pass; parity deferred to #12 (also verify `salespeople()` RPC, grouped Select, `supervisor_only` in JOB_COLUMNS queries)
2026-11-15 · #03 · decision · supervisors tab uses day-by-day week list not 7-col grid; reply saved only on decline (DB check); booking list shows today..+365d incl. Declined; no Cancel (no cancelled status); added migration 20261118110000 (supervisor_only, salespeople()) · subagent deviations, sensible
2026-11-15 · #04 · started
2026-11-15 · #04 · done · verified: check, typecheck, test (2660), guard:migrations pass; concurrency proven by row lock (`for update` on numbering row) + unique running_no, PGlite is single-connection
2026-11-15 · #04 · decision · no cancel function: number is voided automatically when running_no is changed/cleared/DO deleted (task 05 cancels by postponing job + clearing number); next-number in own one-row table not app_settings (so "must exceed last used" can't be bypassed); issue_do_number limited to md/director/support; void-list FKs cascade (example-data reset) · subagent deviations, sensible
2026-11-15 · #01 · decision · added missing "left people: no access" restrictive policy to installers migration (subagent #04 spotted it; branch unmerged so edited in place) · security fix
2026-11-15 · #05 · started
