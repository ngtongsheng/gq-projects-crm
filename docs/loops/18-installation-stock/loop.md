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
| 05 | DO on the job + print + delivery log | done | 04 | sonnet/high |
| 06 | Stock page deltas | done | - | sonnet/medium |
| 07 | Samples migration + rules | done | - | opus/medium |
| 08 | Samples page + pickup form print | done | 07 | sonnet/high |
| 09 | Leftover migration + rules | done | - | opus/medium |
| 10 | Leftover page | done | 09 | sonnet/high |
| 11 | Chinese/BM strings + dev seed | in-progress | 02, 03, 05, 06, 08, 10 | sonnet/medium |
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
2026-11-15 · #05 · done · verified: check, typecheck, test (2696), guard:migrations pass; parity + print preview deferred to #12 (verify on test copy: `delivery_orders` `jobs!inner` embed, nested `mofs(projects(contacts(companies(address))))` embed, `delivery_order_lines` `delivery_orders!inner` filter, rpcs next_do_number/delivered_to_date/replace_delivery_order_lines/issue_do_number/set_next_do_number)
2026-11-15 · #05 · decision · added migration 20261118130000 replace_delivery_order_lines (atomic save); DO items in a dialog on the MOF page not the job form; free-text items input removed (old DOs keep text); only MD can correct an issued number; cancel = postpone job + clear running_no; print never blocks (D3); delivery log not paged (>1000 DOs would be cut by PostgREST limit) · subagent deviations, sensible; log limit as debt in #12
2026-11-15 · #06 · started
2026-11-15 · #06 · done · verified: check, typecheck, test (2712), guard:migrations pass; parity deferred to #12 (check tile labels/order, segment labels, Email suppliers dialog, status-cell notices, segment wrap at 390px)
2026-11-15 · #06 · decision · "Paste from sheet" already existed; kept "Stock items" as 4th segment; migration 20261118140000 (supplier_notice trigger); mailto To empty (supplier emails not stored); Samples segment links /samples, no count yet · subagent deviations, sensible
2026-11-15 · #06 · follow-up · #08 adds (N) to Samples label in stock-tabs.tsx; #10 changes Leftover count to "available after sold allocations" (leftAvail)
2026-11-15 · #07 · started
2026-11-15 · #07 · done · verified: check, typecheck, test (2742), guard:migrations pass; migration only proven in PGlite, test-copy check in #12
2026-11-15 · #07 · decision · pickup row over stock is refused (demo clamped to 0); pickup row must use the sample's unit; pickup forms deletable by sample editors (cancels number, returns samples out); pickup methods stored as keys; added pdf_saved_at; canEditSamples in job-role.ts; qty changes only via sample_moves · subagent deviations, sensible
2026-11-15 · #08 · started
2026-11-15 · #08 · done · verified: check, typecheck, test (2771), guard:migrations pass; parity + print preview deferred to #12 (verify loadSamples/pickup embeds, save_sample_pickup + numbering rpcs, settings update `.eq("id", true)`, receipt title wrap and one-A4 fit)
2026-11-15 · #08 · decision · added migration 20261118160000 import_samples; paste keeps existing unit, default skip existing; explicit Edit button per row; Settings button holds Best Link no/Drive link/next form no; "I saved the PDF" button; pickup-form delete UI not built (DB allows it); app-shell keeps Stock highlighted on /samples · subagent deviations, sensible
2026-11-15 · #08 · follow-up · #12: log debt for unpaged samples list (1000 rows) and `moved_on` default current_date UTC (MYT 00:00-08:00 off by a day) in docs/debt.md, or fix with Asia/Kuala_Lumpur
2026-11-15 · #09 · started
2026-11-15 · #09 · done · verified: check, typecheck, test (2793), guard:migrations pass; migration proven in PGlite only, test-copy check in #12
2026-11-15 · #09 · decision · new status collected_by_supervisor (check re-added, rows kept); transport arranged state derived from transport_by; added received_at/by; allocations add-only (no edit/delete); "+ Add leftover stock" with no MOF not built (mof_id stays required) · subagent deviations, sensible; #12 flag if parity needs it
2026-11-15 · #10 · started
2026-11-16 · #10 · done · verified: check, typecheck, test (2824), guard:migrations pass (subagent saw one resignation-handover PGlite flake under load, reruns clean); parity deferred to #12 (verify leftovers `leftover_allocations(projects)` embed, count query, supervisor RLS update, allocation guard message, "Show sold out" auto-submit, dialogs at 390px)
2026-11-16 · #10 · decision · two tables on /stock/leftover (Best Link list + Returns from site); free-text supplier with datalist; transport via LEFTOVER_TRANSPORTERS; supervisor Mark collected on Site Work MOF page; no transport banner · subagent deviations, sensible
2026-11-16 · #11 · started
