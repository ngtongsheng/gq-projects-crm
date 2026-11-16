# Debt

| What | Why | When to fix |
|---|---|---|
| Vercel Hobby plan for a business app | Hobby is non-commercial only; accepted during evaluation | At handover: Vercel Pro on Vicky's billing |
| Supabase Free (no built-in backups; pauses after 7 idle days) | Evaluation, $0. Mitigated: nightly and pre-migration prod dumps (`backup.yml`, encrypted, 30 days, in the repo's Actions) and a weekly keep-awake query (`health.yml`). The test copy is not backed up | At handover: Supabase Pro (daily backups, no pausing) |
| Invites by copied link, no email | No company domain for an email sender | When a domain exists: custom SMTP (e.g. Resend) |
| Google OAuth client lives in the owner's own GCP project, not Vicky's Workspace org | Moving it now would block on her (loop 11, D2) | At handover: migrate the GCP project, see `docs/handover-migration.md` |
| Prod migration and Vercel prod build run in parallel on merge | Migrations are additive by default (the guard enforces it), so old code keeps working until the new build lands | If a migration ever needs to land before or after the deploy: make `migrate-prod` gate the deploy or split the change into two PRs |
| Dev database shared by all PRs and by Vicky's laptop (`pnpm db:test-copy`) | One `gq-crm-dev` project; a migration applied from a PR or laptop that never reaches `main` stays applied, and later PRs then fail `db push` on a mismatched history | When it bites: repair the history with `supabase migration repair`, or add Supabase branching at handover |
| No branch protection or auto-merge on `main` | GitHub Free private repos do not support them (HTTP 403); checks are advisory | At handover: GitHub Pro or org plan, then run the command in `docs/environments.md` "After first merge" |
| Monthly report "quotations" counts projects added that month that got past lead | Projects store no quotation date | When quotations need exact counts: add `quoted_on` to projects (set when the stage first leaves lead) and count by it in `report-stats.ts` |
| Monthly report figures are worked out by the app and sent at submit | Keeps the maths in one tested TypeScript file; the database checks who and when, not the numbers, so a person could send altered figures through the API | If reports feed pay or targets: compute the snapshot in a SQL function on submit |
| Stock reservations table scrolls sideways inside its card on a phone (Purchasing and sales screens, not a Site Supervisor screen) | Walk-through found it readable but cramped; the shared DataTable has no stacked layout | If Purchasing starts using phones: add a stacked row layout to `DataTable` or a card list for reservations |
| MOF register lacks the prototype's tiles, month filter and extra tabs; Collection lacks its salesperson summary and tiles; team dashboard lacks Ready to reallocate, On site this week, New MOFs this week and Possible duplicate projects | Findings 52, 53, 56. Each figure exists elsewhere (dashboards, per-MOF page); built list-first in loop 03 | When the team asks for them, one at a time, starting with the My Sales month filter and the Collection "Outstanding by salesperson" table |
| Calendar has no appointment sheet (no activity detail view, so no re-invite or change of answer); payment dialog does not pre-fill the amount or preview the percent; no Excel / Copy list on the Monthly list and Weekly outcomes | Finding 58 and loop 12 scope; the customer page does the same jobs, a click further | If salespeople ask for them |
| Installation calendar lacks the prototype's extra lists (Coming up, unsigned DOs, supervisors-only view, busy warning, cancel own booking) | Finding 65. Availability and cancelling are loop 03 #19 decisions; the unsigned-DO flag is on the MOF page | If Purchasing or Sales ask: add the unsigned-DO list first, then the busy warning |
| Site Work and Leftover lack the prototype's cross-job views (site log, measurements, photos and videos, actions needed, first-visit banner, on-going filter, use leftover for a project) | Finding 66. Everything exists per job; the cross-job lists need new queries and screens | If site supervisors or Purchasing lose track of open actions across jobs: build Actions needed first, then the leftover use step |
| Test copy migration history drifted from `main` (`migrate-dev` fails on every migration PR until fixed) | Dev already held migrations 150000-190000 from the open draft PR 31 when PRs 21, 23, 25 and 27 merged, so `db push` refuses; prod is unaffected. PR 31 stays open because its 5 migrations have no screens and 150000 rewrites `decide_ownership_request` | Owner decides soon: ship PR 31, or run `supabase migration repair --status reverted` for 150000-190000 on dev and drop those objects |
| Windows setup and the Windows agent scripts are untested on a real PC | Built and reviewed as `win32` on a Mac (`SETUP.md` Windows path, Node hook scripts, `free-port`, `copy-env`) and never run on a real Windows PC | First time Vicky pastes the setup link on her Windows PC: watch it, fix what breaks, then remove this row |
| Repo is public | Kept public until Vercel Pro is in place; backups are encrypted because Actions artifacts of a public repo are readable by any signed-in GitHub user | When Vercel Pro and GitHub Pro (or an org plan) are in place: make the repo private |
| Logging a visit outcome is three separate database calls (lead project, activity update, follow-up), not one transaction | A transaction needs a database function in a new migration; if a later call fails the earlier ones stay (an unlinked lead, or an outcome without its follow-up) and she sees a message (loop 12 #05) | If partial saves show up in practice: move the three writes into one SQL function called from `logOutcome`. Also: the edit form status select and `setActivityStatus(..., "completed")` can still complete a visit without a result |
| Cost columns of `quote_items` are readable through the Supabase API by anyone who can read the quote, including a director without the margin flag; D3 stripping hides them only in the app | Loop 13 #02: hiding them in the database needs cost columns in a separate table readable by owner and margin-flag holders, which changes D1 | Before giving Costing to anyone who must not see cost, or when the margin flag is used to restrict a director |
| Costing read access is by job role, not the `cost` page access matrix | Loop 13 #02: if the MD grants the Costing page to another role, that person sees an empty page | When the access matrix is made editable for Costing |
| Saving a costing, adding an option and removing one run as several database writes, not one transaction | Loop 13 #05: the Supabase client has no multi-table transaction and a SQL function would move the line rules out of `revision-input.ts` (D2 keeps logic in TypeScript). A failure midway shows "Reload the page" and the saved part stays | If a half-saved costing is ever reported: move the save into one SQL function called with the whole payload |
| FOB enquiry reply columns (currency, FOB, rate, shipping, notes) are writable by a salesperson through the API; only the app limits replies to md, director, support and accounts | Loop 13 #02 followed the demo's `canEditEnq` in RLS; loop 13 #07 enforces the purchasing-only reply in the action | If a salesperson tampering with a FOB reply becomes a concern: split the reply columns by role in a trigger |
| Chinese: dialogs and toasts render outside the language wrapper (no CJK webfont there); server messages with values and page metadata titles are English only; the client quote sheet stays English | Loop 13 #10: `lang` is set on a wrapper div, not on `<html>`; the demo's customer-facing sheet is English | When a Chinese-reading person reports a missing translation: set `lang` on `<html>` and translate the value-bearing messages
| Test copy row for GQ5156 still has the history note "Lowest margin 24% is under 30%", visible to the salesperson (margin leak) | The seed file is fixed (`scripts/example-data/quotes.ts`) but the test copy was seeded before; service credentials are not kept | Next `pnpm seed:example` reset of the test copy |
| Client quote toolbar title is truncated ("Client quote · GQ...") when the toolbar buttons fill the A4 width | Shared `PrintLayout` title is `flex-1 truncate`; loop 13 left the shared component alone | When another printable form needs the same toolbar |
| Task changes and their log line are two writes, not one | Loop 15 #02 server actions update `tasks` then insert into `task_log_entries`; a failed log insert is only logged on the server, so a change can lack its history line | If the team finds history gaps: move each task change into a SQL function that writes the row and its log in one transaction |
| Editing public holidays does not recount leave already saved; there is no edit-task screen (the action exists); server-action error messages and calendar month and weekday names are English only | Loop 15: days are counted in SQL when the request is saved (#05); no edit-task UI in the task spec (#04); Chinese scope (#10) | If holidays change after leave is booked: recount in a SQL function. When people ask: add the edit form. With the next Chinese pass |

## Invitee list shows people who have left (loop 12)
- What: the Add activity invitee picker lists everyone in `team_directory()`, including people marked left.
- Why: the function returns no active flag; filtering needs a new migration.
- When to fix: with the next change to `team_directory` (People & HR loop).

## Dark-mode chart tokens (loop 14 #07)
- What: the team comparison chart uses theme tokens chart-1..5; in dark mode they pass contrast and colour-blind checks but fail the dataviz lightness band and chroma floor.
- Why: changing shared theme tokens is outside the performance task.
- When to fix: next time the theme tokens are revised, or if Vicky finds the dark chart hard to read.

## Marketing Director cannot open Team Reports (loop 14 #08)
- What: the database lets the Marketing Director (bd) review their team's sales reports, but `bd` has no `rep` page in `src/lib/auth/pages.ts`, so the app cannot reach them and `reviewReport` refuses.
- Why: giving a role a new page is a access decision outside the reports review task.
- When to fix: when Vicky says the Marketing Director should review reports; add `rep` for `bd` and a test.

## Visit targets are saved but not read (loop 16 #06)
- What: People saves a visits-per-month target per person per year in `yearly_targets.visit_target`, but the reports, dashboards and Performance still use the company default of 50 (`report-stats.ts`).
- Why: reading it needs a per-person lookup in every report snapshot; the task only asked for entering it.
- When to fix: when someone's visit target differs from 50 and a report should show it; read it where `targets.salesVisits` is built.

## Yearly target copy on profiles (loop 16 #06)
- What: `profiles.yearly_target` stays as a copy of this year's effective target. The database keeps it in step on every change, and Performance, the sales dashboard and People call `refresh_yearly_targets()` first so it is right on 1 January. Other readers of the copy (the signed-in profile) can be stale until one of those pages loads.
- Why: dropping the column (D3 rejected) would touch every reader.
- When to fix: if a new page reads `profiles.yearly_target` directly, call `refreshYearlyTargets()` first, or move readers to the per-year table and drop the column.

## Unpaged lists (loop 18)
- What: the delivery log (MOF Register), the samples list, and the per-installer job counts read
  everything in one query. PostgREST cuts a read at 1000 rows without an error, so a longer list would silently lose rows.
- Why: the team has far fewer rows today; paging was outside the screens' tasks.
- When to fix: when a list passes about 800 rows (the delivery log first, about 1000 DOs): page it or move the count into SQL.

## Sample pickup date uses UTC (loop 18 #08)
- What: `moved_on` defaults to `current_date` in `save_sample_pickup`, which is UTC. Between 00:00 and 08:00 Malaysia
  time a move is dated the day before.
- Why: the default is in the database; the screens pass no date.
- When to fix: next migration that touches samples: use `(now() at time zone 'Asia/Kuala_Lumpur')::date`.

## Installer rename does not update old jobs (loop 18 #02)
- What: renaming an installer changes the directory only. Old jobs keep the name text they were saved with (the calendar
  and counts use `installer_id`, so they still match).
- Why: RLS stops installer editors writing to `jobs`; a trigger on `installers` could do it as the owner.
- When to fix: if people complain about stale names in the job list or exports: add a `security definer` trigger on
  `installers` that rewrites `jobs.installer`, or drop the text columns in an approved step.

## Supplier emails are not stored (loop 18 #06)
- What: "Email suppliers (N)" opens a `mailto:` draft with To empty, because suppliers have no stored address.
- Why: no supplier table or email provider (D6).
- When to fix: when Integration picks a sender: add supplier contacts and send from the app.

## No pickup form delete button (loop 18 #08)
- What: the database lets people who edit samples delete a pickup form (the number is cancelled and the samples return),
  but no screen offers it.
- Why: not in the task; a wrong form is rare.
- When to fix: when someone needs to undo a form: add Delete to the pickup forms table.

## A hand-keyed DO number typo cancels the old number (loop 18 #04)
- What: changing a DO's number by hand voids the old number for good, so a typo burns a number. Only the MD can correct
  an issued number.
- Why: the void rule has to cover every change of `running_no`; there is no separate cancel function.
- When to fix: if numbers are burned often: add a confirm step before changing an issued number.
