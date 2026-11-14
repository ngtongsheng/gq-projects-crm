# Loop 12: Sales parity
Orchestrator: sonnet/high
## Goal
Customers, Sales Calendar and Projects match Vicky's demo (`docs/mockup/gqp-office-demo.html`) for every role that sees
them: Companies view and company sheet, visit outcomes, appointment invitations, Week / Monthly list / Weekly outcomes
views with weekly reports, and site-role project scoping. Parity checked per `docs/office-parity/parity.md`. Merged to
`main`. Runs in parallel with loop 13 Costing (roadmap step 2A, drift doc `docs/office-parity/drift-shell-sales.md`).
## Decisions
| ID | Decision | Why | Rejected |
|---|---|---|---|
| D1 | A company's salespeople are derived from the owners of its contacts (`contact_owners`). The demo's 2-owner limit is shown (first two), not enforced. "Only owners add people" checks that derived list | No new table, no reshaping of ownership data; `/customers/ownership` keeps working | `company_owners` table + backfill + second request flow |
| D2 | Dashboard banners (invitations, outcomes not logged, today's calls), the Sales Calendar nav badge and the on-leave strip go to the Integration loop | Keeps this loop off dashboard and shell files loop 13 touches; leave data comes with People & HR | Building them here |
| D3 | Visits done before go-live count as logged: the migration sets `logged_at` on existing completed activities; only later visits can be "not logged" or "late" | Weekly outcomes start clean | Flagging old visits |
| D4 | Sales screens are English only, as in the demo. This loop does not edit `src/lib/i18n/bm.ts` or `zh.ts` | Demo translates only site screens, Leave and Costing; avoids conflicts with loop 13 | Translating sales screens |
| D5 | Parallel with loop 13: rebase on `main` before merging; if `main` has a migration newer than one of ours, rename ours to a fresh timestamp so Supabase applies in order | Out-of-order migration timestamps fail on push | Fixed timestamp ranges per lane |
| D6 | The weekly report deadline is an `app_settings` row, default Friday; its editing screen comes with Tools & Forms | Demo has a deadline setting; no settings page yet | Hard-coded Friday |
| D7 | One branch `loop/12-sales-parity` in a worktree, one commit per task, one PR, merged once local and PR checks pass | Same as loops 07-11 | Branch per task |
| D8 | Preflight: no new allow rules. Loop docs pushed with `git push` (not `git push origin main`, denied); the PR merge deploys and applies migrations as in loops 07-11 | Established path | - |
| D9 | Demo contradictions: follow the more specific rule and log it in `docs/decisions.md`; data relationships reuse existing tables (roadmap rules) | Roadmap "Rules for every parity loop" | Asking Vicky each time |
## Tasks
| # | Task | Status | Depends | Model/Effort |
|---|---|---|---|---|
| 01 | Company list query + status rules | done | - | sonnet/high |
| 02 | Companies / All people toggle + Companies table | done | 01 | sonnet/high |
| 03 | Company sheet | done | 02 | sonnet/high |
| 04 | Migration: outcomes, invitees, weekly reports, deadline | done | - | opus/medium |
| 05 | Log outcome flow | todo | 04 | opus/medium |
| 06 | Appointment invitations | todo | 04 | sonnet/high |
| 07 | Calendar views, My team filter, Plan a call | todo | 05, 06 | sonnet/high |
| 08 | Weekly outcomes + weekly reports | todo | 05 | opus/medium |
| 09 | Projects: site role scoping | todo | - | opus/medium |
| 10 | Parity pass, docs, merge | todo | 01-09 | sonnet/medium |
<!-- status: todo | in-progress | done | blocked: <reason> -->
## Owner actions
- None planned. Tell Vicky one line when it is live (message to a person, so the owner sends it).
## Log
<!-- one line per event: YYYY-MM-DD · #NN · result · next -->
2026-11-15 · plan · loop written from drift-shell-sales.md after loop 11 merged · next: #01
2026-11-15 · #01 · in-progress · worktree ../gq-projects-crm-loops/12-sales-parity, branch loop/12-sales-parity
2026-11-15 · #01 · decision · pure derivation split into company-rows.ts (+test) instead of company-data.test.ts · company-data.ts imports the server Supabase client
2026-11-15 · #01 · decision · "never visited" is its own status "No visit yet", included in the inactive filter; demo's "Assigned firms" filter dropped · D1 has no company-level owners
2026-11-15 · #01 · done · check, typecheck, test pass (1317 tests) · next: #02
2026-11-15 · #02 · in-progress
2026-11-15 · #02 · decision · role/viewport parity (md, director, bd, sales; 1280 + 390px) deferred to #10 · needs sign-in as each role on the test copy, .env files not in worktree and copying them was denied; owner action listed at finish
2026-11-15 · #02 · decision · Companies is the default view; people list moved to people-table.tsx; Salesperson filter for isManager only (not BD with team); company name is a link, not a whole-row click · DataTable has no row click
2026-11-15 · #02 · done · check, typecheck, test pass (1318 tests) · next: #03
2026-11-15 · #03 · in-progress
2026-11-15 · #03 · decision · added saveCompany (MD / Sales Director only, as the database allows); company-sheet add-person allowed for owners of the company's people, MD, Sales Director, or anyone when the company has no owned people · D1 derived owners, no way to add the first person otherwise
2026-11-15 · #03 · decision · salesperson-assignment fields and Remove not built; header "Add customer" now also refuses non-owner adding to an existing company (visible behaviour change) · D1, Remove is data loss
2026-11-15 · #03 · done · check, typecheck, test pass (1327 tests); sheet UI not seen in a browser, parity in #10 · next: #04
2026-11-15 · #04 · in-progress
2026-11-15 · #04 · decision · migration timestamp 20261115110000 (after main's newest) · D5
2026-11-15 · #04 · decision · DB trigger stamps logged_at / late_logged (client cannot write); lead stored as activities.lead_project_id; existing outcome text stays as learnings; deadline row weekly_report_due = {weekday:5,time:"18:00"}; only sales and bd file weekly reports · demo rules
2026-11-15 · #04 · done · check, typecheck, guard:migrations, test pass (1338 tests, 11 new RLS tests) · next: #05
