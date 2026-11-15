# Loop 15: Tasks & Leave
Orchestrator: sonnet/high
## Goal
Tasks and Leave match Vicky's demo (`docs/mockup/gqp-office-demo.html`, `vTasks` ~3104, `vLeave` ~3206) per
`docs/office-parity/drift-new-modules.md` (roadmap step 3B, first half). Parity checked per
`docs/office-parity/parity.md`. Merged to `main`. Starts after loop 13 is merged; may run in parallel with loop 14.
## Decisions
| ID | Decision | Why | Rejected |
|---|---|---|---|
| D1 | Step 3B splits: 15 Tasks & Leave, 16 HR, Tools & People. Later loops become 17 Site & stock, 18 Claims, 19 Integration; #11 updates the roadmap | ~10 tasks per loop like 12-14 | One ~20-task loop |
| D2 | Leave balances start 1 Jan 2027. Accounts enters each person's carry-forward from 2026 via the per-person entitlement override. No 2026 records | Owner choice; no history exists | Opening "taken in 2026" figures |
| D3 | Task and leave reminders are in-app only (tiles, overdue, escalation computed at read time, no cron). WhatsApp reminders and leave in Sales Calendar / Site Work go to Integration | Scope; same as loop 14 D7 | Scheduled jobs now |
| D4 | Approvers by job role and `reports_to`, never names: sales → team lead (`reports_to`) then md; bd and site → director then md; others → md; accounts also sees MC. Never your own; md's own leave goes to director. Task approval: assigner or md. Assigners: md, director, bd, support, marketing | Demo rules; "Eddie" = `director` job role | Name-based rules |
| D5 | Working days reuse `src/lib/domain/workdays.ts` + `public_holidays`: Mon-Fri, Mon-Sat for job role `site`; half days 0.5 | Reuse | New calendar code |
| D6 | Task files (versions) and MC/hospitalisation slips use loop 11 storage (`src/lib/storage/`) | Reuse | New bucket logic |
| D7 | Leave policy (14 AL, 14 MC, prorate by join month to half day) lives in `app_settings`; per-person per-year overrides (al, carry, mc) in a table | Demo `lvPol`, `leaveEnt` | Hard-coded numbers |
| D8 | One branch `loop/15-tasks-leave` from `main` after loop 13 merges, one commit per task, one PR. Rebase on `main` before merging; rename our migrations if `main` has newer ones. Preflight: none; PR merge deploys as in loops 07-14 | Established path | - |
| D9 | Demo contradictions: follow the more specific rule, log in `docs/decisions.md` | Roadmap rules | Asking each time |
## Tasks
| # | Task | Status | Depends | Model/Effort |
|---|---|---|---|---|
| 01 | Tasks migration | done | - | opus/medium |
| 02 | Task flow rules | done | 01 | opus/medium |
| 03 | Tasks page: tabs + tiles | done | 02 | sonnet/high |
| 04 | Task sheet | done | 02 | sonnet/high |
| 05 | Leave migration | in-progress | - | opus/medium |
| 06 | Leave maths | todo | 05 | opus/medium |
| 07 | Leave approval + slip rules | todo | 05 | opus/medium |
| 08 | Leave page | todo | 06, 07 | sonnet/high |
| 09 | Who is away, holidays, entitlements | todo | 08 | sonnet/high |
| 10 | Chinese strings + dev seed | todo | 03, 04, 08, 09 | sonnet/medium |
| 11 | Parity pass, docs, merge | todo | 01-10 | sonnet/medium |
<!-- status: todo | in-progress | done | blocked: <reason> -->
## Owner actions
- Start only after loop 13 is merged: `/execute-loop docs/loops/15-tasks-leave`.
- After go-live, tell Vicky (owner sends): accounts enters each person's carry-forward from 2026 before January.
## Log
<!-- one line per event: YYYY-MM-DD · #NN · result · next -->
2026-11-15 · plan · loop written from drift-new-modules.md (Tasks, Leave) · next: wait for loop 13 merge, then #01
2026-11-15 · #01 · in-progress · worktree ../gq-projects-crm-loops/15-tasks-leave on loop/15-tasks-leave
2026-11-15 · #01 · done · tasks, co-assignees, log, files tables + RLS + 32 tests; checks pass · next: #02
2026-11-15 · #01 · decision · status rules also enforced by trigger guard_task_write (assignee can't self-complete); #02 task-flow.ts mirrors them; revision comment required in server action · security
2026-11-15 · #01 · decision · slugs for category/priority/status; customer, bring-me-along, appointment link not modelled (Integration) · not in drift field list
2026-11-15 · #02 · in-progress
2026-11-15 · #02 · done · task-flow.ts, tasks/actions.ts + tests; checks pass (1770 tests) · next: #03
2026-11-15 · #02 · decision · reminder/escalation days are calendar days with parameter defaults (no app_settings row); log write is separate from the change (debt row added); canAssignTasks lives in task-flow.ts · listed files only
2026-11-15 · #03 · in-progress · must flip `tasks` to built:true in pages.ts (requirePage 404s until then)
2026-11-15 · #03 · done · tasks page, tiles, workload, new-task dialog; checks pass (1802 tests); visual parity deferred to #11 (needs test copy with migrations) · next: #04
2026-11-15 · #03 · decision · added migration task_people() for role-aware assignee list (team_directory lacks job role); 4 tiles incl. waiting review; dialog not sheet · follows demo/app patterns
2026-11-15 · #04 · done · task sheet, files with versions, review panel, log; checks pass (1821 tests); parity deferred to #11 · next: #05
2026-11-15 · #04 · decision · no edit-task UI (editTask action exists; not in task spec); title-only click; separate Save new date button · DataTable is server component, spec silent
