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
| 01 | HR migration | done | - | opus/medium |
| 02 | HR: Policies & schemes | done | 01 | sonnet/high |
| 03 | HR: Staff packages + outstation | done | 01 | sonnet/high |
| 04 | HR: Sales grades & bonus | done | 01 | sonnet/high |
| 05 | Per-year targets migration | done | 01 | opus/medium |
| 06 | People: targets + Sales teams | done | 05 | sonnet/high |
| 07 | Resignation handover | done | - | opus/medium |
| 08 | Tools: calculators | done | - | sonnet/high |
| 09 | Tools: A4 forms + links | done | - | sonnet/high |
| 10 | Chinese strings + dev seed | in-progress | 02, 03, 04, 06, 07, 08, 09 | sonnet/medium |
| 11 | Parity pass, docs, merge | todo | 01-10 | sonnet/medium |
<!-- status: todo | in-progress | done | blocked: <reason> -->
## Owner actions
- Start only after loop 15 is merged: `/execute-loop docs/loops/16-hr-tools-people`.
- After go-live, tell Vicky (owner sends): accounts types in each person's package and grade.
## Log
<!-- one line per event: YYYY-MM-DD · #NN · result · next -->
2026-11-15 · plan · loop written from drift-new-modules.md (HR, Tools, People) · next: wait for loop 15 merge, then #01
2026-11-15 · #01 · in-progress · worktree ../gq-projects-crm-loops/16-hr-tools-people on loop/16-hr-tools-people (needs pnpm install)
2026-11-15 · #01 · done · check, typecheck, test, guard:migrations pass; migration 20261116100000_hr.sql · next: #02
2026-11-15 · #01 · decision · grade stored per person in staff_hr_records (not per package); #03 reads grade there · demo keeps grade per person, directors have no package
2026-11-15 · #01 · decision · packages are add-only (typo = new row on a new date) · D4 strict
2026-11-15 · #01 · decision · Older is derived from replaces_id; bonus bands are a fixed on-screen reference, no table · D7, D2
2026-11-15 · #01 · decision · demo sample policy and extra rules not seeded here; dev seed (#10) adds them · need a real author
2026-11-15 · #02 · in-progress
2026-11-15 · #02 · done · check, typecheck, test pass (2313); browser parity deferred to #11 · next: #03
2026-11-15 · #02 · decision · policy dialog has a "scheme appendix" checkbox; PDF only, one of file or link · nothing else could flag the first scheme doc
2026-11-15 · #02 · decision · /hr shows 3 tabs; Staff packages and Grades tabs are "Not built yet" placeholders in hr/page.tsx for #03/#04 · tab control belongs to #02
2026-11-15 · #02 · note · shared attachments bucket caps uploads at 1.5 MB; large policy PDFs refused (bucket migration not done); signed upload and Open PDF untested against live storage · check in #11
2026-11-15 · #03 · in-progress
2026-11-15 · #03 · done · check, typecheck, test pass (2332); browser parity and live-DB run deferred to #11 · next: #04
2026-11-15 · #03 · decision · people list from leave_people() + team_directory() (profiles is admin-only) · HR & Accounts need not be admin
2026-11-15 · #03 · decision · confirmation date, offer letter, notes saved to staff_hr_records without touching grade or appendix · #04 owns those
2026-11-15 · #03 · decision · hotel level Auto uses job role and grade only; bd uses the salesperson standard package · demo parity, avoid circularity
2026-11-15 · #04 · in-progress
2026-11-15 · #04 · done · check, typecheck, test pass (2339); browser parity deferred to #11 · next: #05
2026-11-15 · #04 · decision · per-person grade table drops demo's 2026 target/sales so far/bonus columns and per-person basic override · D2; per-year targets come in #05/#06
2026-11-15 · #04 · decision · appendix signed date stamps the current scheme version · demo parity
2026-11-15 · #05 · in-progress
2026-11-15 · #05 · done · check, typecheck, test (2359), guard:migrations pass; migration 20261116110000_yearly_targets.sql · next: #06
2026-11-15 · #05 · decision · table yearly_targets (person, year, sales_target nullable, visit_target); team-lead read via in_my_team · D3 leaves name and team-lead source open
2026-11-15 · #05 · decision · #06 must (a) move People's target edit to yearly_targets and drop the edit grant on profiles.yearly_target, (b) fix the 1 January rollover (yearly_target stale until next change) · gaps reported by #05
2026-11-15 · #06 · in-progress
2026-11-15 · #06 · done · check, typecheck, test (2380), guard:migrations pass; migration 20261116120000_yearly_targets_writes_rollover.sql; browser parity deferred to #11 · next: #07
2026-11-15 · #06 · decision · rollover fixed lazily: refresh_yearly_targets() called by Performance, dashboard and People; edit grant on profiles.yearly_target revoked · smallest durable fix
2026-11-15 · #06 · decision · target fields on person sheet only for MD, Sales Directors, HR & Accounts (DB refuses others); year select = this or next year; visit target = visits per month · D3 policies
2026-11-15 · #06 · note · scripts/example-data/test-users.ts still writes profiles.yearly_target; #10 must write yearly_targets rows · two debt entries added to docs/debt.md
2026-11-15 · #07 · in-progress
2026-11-15 · #07 · done · check, typecheck, test (2389), guard:migrations pass; migration 20261116130000_resignation_handover.sql; browser parity deferred to #11 · next: #08
2026-11-15 · #07 · decision · open projects for handover = every stage except Awarded and Lost (On Hold moves); support-role projects and archived customers also move · stranding them with a leaver is worse
2026-11-15 · #07 · decision · guard_project_write() bypassed via transaction-local gqp.handover set only by hand_over_work, so any admin can run it · PIC change otherwise refused for non-MD admins
2026-11-15 · #08 · in-progress
2026-11-15 · #08 · done · check, typecheck, test pass (2400); browser parity deferred to #11 · next: #09
2026-11-15 · #08 · decision · vinyl layouts A/B recommended by order length and welding rod as in demo (no offcut figure exists) · match demo numbers
2026-11-15 · #08 · decision · tools is built for all roles (sidebar "Tools & Forms" before Leave); /tools?view= tabs, #09 appends to TOOLS_VIEWS in tools-view.ts and updates the Guide sentence "Forms to print come next" · demo parity
2026-11-15 · #09 · in-progress
2026-11-15 · #09 · done · check, typecheck, test (2411), guard:migrations pass; migration 20261116140000_form_links.sql; browser parity and print preview deferred to #11 · next: #10
2026-11-15 · #09 · decision · Best Link pickup row links to /stock until loop 17 Samples exists (PICKUP_FORM_HREF in forms-view.tsx); loop 17 repoints it · module not built
2026-11-15 · #09 · decision · Drive links managed by admin role only (demo: MD or HR & Accounts); widening is one RLS + action change · brief
2026-11-15 · #09 · decision · MOF choices for forms = every MOF except cancelled and closed, newest 80 · no completion date exists
2026-11-15 · #10 · in-progress
