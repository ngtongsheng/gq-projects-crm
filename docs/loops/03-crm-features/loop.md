# Loop 03: CRM features
Orchestrator: opus/medium
## Goal
Every module of Vicky's prototype (`docs/mockup/gq-crm-mockup.html`) works in the app on real database tables with
job-role permissions: customers, activities, pipeline, MOF register, supplier and installer POs, deliveries and
installation, site work, OT, stock and leftover, collection, commission, reports, dashboards, import/export. Each slice
is live on main; a per-role walk-through on localhost against the test copy passes and Vicky has a review checklist.
## Decisions
| ID | Decision | Why | Rejected |
|---|---|---|---|
| D1 | Whole prototype in one loop, 35 thin vertical slices, each merged on its own | Owner choice; small merges keep migrations safe | Sales core only first; one big merge |
| D2 | Keep `admin`/`staff` (manages people) + new `job_role` (md, director, bd, sales, accounts, site, support) and per-person settings (arranges_stock, commission_mode, yearly_target); permissions enforced in RLS via SQL helpers | Prototype permissions depend on job role; least change to loop 01 auth | Replace with 7 roles; admin/staff only |
| D3 | Customers: all staff read all; owners and managers edit; others send ownership requests decided by MD/director | Stops duplicate chasing; matches prototype | Own-only visibility; edit-all |
| D4 | Commission rules stored in `app_settings`, editable by MD; per-person exceptions are profile settings, never names | Rules may be wrong vs. reality; changeable without code | Hard-coded; out of scope |
| D5 | Paste-from-sheet import (companies/contacts, MOFs, stock, leftover) with preview + server re-validation, plus CSV export | Gets existing spreadsheets into the live app through the app, not by hand | Export only; neither |
| D6 | Owner (Tong Sheng) pre-approves merging each slice to main once checks pass, for this loop only; the team does not use the live app yet. Vicky reviews the whole app (#35 checklist) before the team starts | Avoids 35 stalls; CLAUDE.md "her yes before live" applies again after this loop | One long branch; Vicky per slice |
| D7 | Example data only on the test copy (`scripts/seed-example-data.ts`, refuses prod) | Live data changes only through the app | Seeding prod |
| D8 | Reminders/overdue/late flags in-app only, derived on read (no cron) | No email sender (debt.md); fewer moving parts | Email, push, scheduled jobs |
| D9 | Site work, OT, bookings and installation calendar must work at 390px | Site supervisors use phones | Desktop only |
| D10 | Files stay as Drive link text fields | Prototype does the same; no storage setup | Supabase Storage uploads |
| D11 | RM, Malaysia time, Mon-Fri workdays without public holidays; Zoho PO numbers typed in | Matches prototype; no integration | Holiday calendar, Zoho sync |
| D12 | MOF cost in a separate managers-only table; order total changes only through a function that records a reason | Column privacy in RLS needs its own table; prototype requires a reason | Hiding cost in the UI only |
## Tasks
| # | Task | Status | Depends | Model/Effort |
|---|---|---|---|---|
| 01 | Job roles + per-person settings | todo | - | opus/medium |
| 02 | Navigation by job role + page guards | todo | 01 | sonnet/high |
| 03 | Money, date and area helpers | todo | - | sonnet/high |
| 04 | Companies + contacts in the database | todo | 01 | opus/medium |
| 05 | Customer list + add/edit | todo | 02, 03, 04 | sonnet/high |
| 06 | Customer detail + health flags | todo | 05 | sonnet/high |
| 07 | Ownership requests | todo | 05 | sonnet/high |
| 08 | Activities (visits, calls) | todo | 06 | sonnet/high |
| 09 | Sales calendar | todo | 08 | sonnet/high |
| 10 | Projects (pipeline) data + form | todo | 06 | sonnet/high |
| 11 | Pipeline board/list | todo | 10 | sonnet/high |
| 12 | Order register (MOF) data, private cost | todo | 10 | opus/medium |
| 13 | MOF form | todo | 12 | opus/medium |
| 14 | MOF register list + stages | todo | 13 | sonnet/high |
| 15 | Supplier PO tracking | todo | 14 | sonnet/high |
| 16 | Installer POs + claims | todo | 14 | sonnet/high |
| 17 | Delivery + installation jobs, DOs | todo | 14 | sonnet/high |
| 18 | Installation calendar | todo | 09, 17 | sonnet/high |
| 19 | Site supervisor booking | todo | 17 | sonnet/high |
| 20 | Site stage, site log, follow-ups | todo | 17 | sonnet/high |
| 21 | Overtime claims + approval | todo | 20 | sonnet/high |
| 22 | Stock returns / leftover | todo | 20 | sonnet/high |
| 23 | Stock items + reservations | todo | 14 | sonnet/high |
| 24 | Collection (payments, outstanding) | todo | 14 | sonnet/high |
| 25 | Commission settings + calculation | todo | 01, 24 | opus/medium |
| 26 | Commission screen + payouts | todo | 25 | sonnet/high |
| 27 | Monthly reports (sales, BD, site) | todo | 08, 11, 14, 21 | opus/medium |
| 28 | Team + director reports | todo | 27 | sonnet/high |
| 29 | Dashboards per role | todo | 11, 14, 20, 24, 27 | sonnet/high |
| 30 | CSV export | todo | 05, 14, 22, 23 | sonnet/high |
| 31 | Paste import: parser + companies | todo | 04 | opus/medium |
| 32 | Paste import: MOFs, stock, leftover | todo | 31, 13, 22, 23 | sonnet/high |
| 33 | Test-copy example data | todo | 32 | sonnet/high |
| 34 | In-app guide | todo | 29 | haiku/low |
| 35 | Walk-through per role on localhost | todo | 33, 34 | sonnet/high |
<!-- status: todo | in-progress | done | blocked: <reason> -->
## Owner actions
- #33: if no dev secret is available to the executor, Tong Sheng creates `.env.seed.dev` (test copy only) and runs `pnpm seed:example`.
- #35: Tong Sheng sets everyone's job role on the People screen of the live app; Vicky goes through `assets/walkthrough.md` on her laptop preview before the team uses the app.
- After the loop: confirm the prototype's commission, payment (90%) and stock-hold rules with Vicky; adjust in settings.
## Log
<!-- one line per event: YYYY-MM-DD · #NN · result · next -->
2026-11-02 · plan · #33/#35 moved to localhost: preview links are local-only (decisions.md, PR #10)
2026-11-02 · plan · loop written (35 tasks); mockup customers/companies/calendar parts skimmed only, tasks tell executor to read anchors · /execute-loop
