# Loop 16: HR, Tools & People
Orchestrator: sonnet/high
## Goal
HR, Tools & Forms and the People leftovers match Vicky's demo (`docs/mockup/gqp-office-demo.html`, `vHR` ~4437,
`vTools` ~4105, `vPeople` ~4995) per `docs/office-parity/drift-new-modules.md` (roadmap step 3B, second half).
Parity checked per `docs/office-parity/parity.md`. Merged to `main`. Starts after loop 15 is merged (same lane).
## Decisions
| ID | Decision | Why | Rejected |
|---|---|---|---|
| D1 | HR data (policies, packages, grades, outstation rules) is readable and writable only by job roles `md` and `accounts`, in RLS. The `admin` role alone grants nothing; View as cannot reveal it | Owner choice; demo "Only Vicky and Jany" | Admins also see salaries |
| D2 | Bonus bands are a reference table in HR; the app does not compute bonuses | Owner choice; demo excludes bonus from packages | Per-person bonus calc |
| D3 | New per-year targets table (person, year, sales target, visit target). Effective target = person's row, else their grade's annual target. Backfill the current year from `profiles.yearly_target`; a trigger keeps `yearly_target` = current year's effective target so loop 14 Performance keeps working | Owner choice; no value lost, no reader breaks | Dropping `yearly_target` |
| D4 | Staff packages start empty; accounts types them in. Dated history: a new row per change, never overwritten | Owner choice | CSV import |
| D5 | Resignation handover moves the leaver's customers and open projects to a chosen person and writes a handover list. Commission on their MOFs stays with the leaver; nothing is recalculated | Owner choice | Moving unpaid commission |
| D6 | Grades J1-M2 seeded from demo `HR_GRADES` ~4368, editable. `vTeam` approval limits are not built (drift doc: unreachable) | Demo | Building vTeam |
| D7 | Policy documents: PDF via loop 11 storage or a link; "Replaces" marks the older one Older. Forms print with the loop 11 print layout | Reuse | New upload or print code |
| D8 | One branch `loop/16-hr-tools-people` from `main` after loop 15 merges, one commit per task, one PR. Rebase on `main` before merging; rename our migrations if `main` has newer ones. Preflight: none; PR merge deploys as in loops 07-15 | Established path | - |
| D9 | Demo contradictions: follow the more specific rule, log in `docs/decisions.md` | Roadmap rules | Asking each time |
## Tasks
| # | Task | Status | Depends | Model/Effort |
|---|---|---|---|---|
| 01 | HR migration | todo | - | opus/medium |
| 02 | HR: Policies & schemes | todo | 01 | sonnet/high |
| 03 | HR: Staff packages + outstation | todo | 01 | sonnet/high |
| 04 | HR: Sales grades & bonus | todo | 01 | sonnet/high |
| 05 | Per-year targets migration | todo | 01 | opus/medium |
| 06 | People: targets + Sales teams | todo | 05 | sonnet/high |
| 07 | Resignation handover | todo | - | opus/medium |
| 08 | Tools: calculators | todo | - | sonnet/high |
| 09 | Tools: A4 forms + links | todo | - | sonnet/high |
| 10 | Chinese strings + dev seed | todo | 02, 03, 04, 06, 07, 08, 09 | sonnet/medium |
| 11 | Parity pass, docs, merge | todo | 01-10 | sonnet/medium |
<!-- status: todo | in-progress | done | blocked: <reason> -->
## Owner actions
- Start only after loop 15 is merged: `/execute-loop docs/loops/16-hr-tools-people`.
- After go-live, tell Vicky (owner sends): accounts types in each person's package and grade.
## Log
<!-- one line per event: YYYY-MM-DD · #NN · result · next -->
2026-11-15 · plan · loop written from drift-new-modules.md (HR, Tools, People) · next: wait for loop 15 merge, then #01
