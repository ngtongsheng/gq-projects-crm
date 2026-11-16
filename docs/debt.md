# Debt

| What | Why | When to fix |
|---|---|---|
| Vercel Hobby plan for a business app | Hobby is non-commercial only (loop 22 D11); accepted during evaluation. It is also why the CRM repo stays public: Hobby cannot deploy a private repo's commits from other people | At handover: Vercel Pro on Vicky's billing |
| Supabase Free (no built-in backups; pauses after 7 idle days) | Evaluation, $0. Mitigated: nightly and pre-migration prod dumps (`backup.yml`, encrypted, 30 days, in the repo's Actions) and a weekly keep-awake query (`health.yml`). The test copy is not backed up | At handover: Supabase Pro (daily backups, no pausing) |
| Vicky has write access to the private dev repo `gq-dev-private`, and dev keys sit in a file there | GitHub personal repos cannot invite a read-only collaborator (HTTP 422, loop 22 #02); the repo holds test copy values only, so the worst case is a changed test copy key file | At handover: move the repo to an org and give Vicky read access, or drop it when the test copy has its own secret store |
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
| Windows setup and the Windows agent scripts are untested on a real PC | Built and reviewed as `win32` on a Mac (`SETUP.md` Windows path, Node hook scripts, `free-port`, `copy-env`, `catch-up` with its key fetch and archive steps; loop 22 rehearsal ran on a Mac only) and never run on a real Windows PC | First time Vicky pastes the setup link on her Windows PC: watch it, fix what breaks, then remove this row |
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

## Dates default to UTC (loop 18 #08, loop 24 #08)
- What: `moved_on` defaults to `current_date` in `save_sample_pickup`, which is UTC. `samples.form_date` and `samples.moved_on`
  (`20261118150000_samples.sql`) and `variation_orders.vo_date` (`20261115210000_variation_orders.sql`) do the same. Between
  00:00 and 08:00 Malaysia time these are dated the day before.
- Why: the default is in the database; the screens pass no date.
- When to fix: next migration that touches samples or variation orders: use `(now() at time zone 'Asia/Kuala_Lumpur')::date`, as tasks and FOB enquiries already do.

## Installer rename does not update old jobs (loop 18 #02, audit D3)
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

## Claimant page reads HR packages with the service role (loop 19 #04)
- What: the My claim page reads the person's caps and meal rates with `createAdminClient`, because packages are readable
  only by md and accounts. Salary is not sent to the page.
- Why: avoided a new migration.
- When to fix: add a `security definer` RPC that returns only the caps and rates for the signed-in person, then drop the
  service-role read (it also fails on a laptop without the service key).

## Claims BM and Chinese wording unreviewed (loop 19 #08)
- What: the translations are the agent's own; the demo has no text for them.
- Why: no source text.
- When to fix: before staff use BM or Chinese: Vicky or a native reader reviews `src/lib/i18n` claims strings.

## Late-collection cut settings are md-only (loop 19 #05)
- What: late1/late2 stay in the `commission` settings key and are edited on `/commission/settings`, so accounts cannot
  change them from Claims settings (the demo lets them).
- Why: `app_settings` policy for that key is md only; no migration in the loop.
- When to fix: if accounts need it: move the two values to the `claims` key or widen the policy.

## Old appeals link not redirected (loop 19 #06)
- What: `/commission?tab=appeals` is not redirected to Claims.
- Why: nothing links to it.
- When to fix: if a bookmark or WhatsApp link breaks, add a redirect.

## No helper to repair the test copy's migration history (loop 22 #06)
- What: `docs/laptop.md` situation 6 gives her agent a `node -e` one-liner for `supabase migration repair` and `db reset` on the test copy; there is no script, so no guard checks the connection string is the test copy's.
- Why: needed only when another draft's database change reaches the shared test copy; `.env.local` holds only the test copy's string, and a script was out of scope for the playbook.
- When to fix: the first time situation 6 happens, or at the next change to `scripts/db-test-copy.ts`: add `pnpm db:repair-test-copy` reusing `assertDevDbUrl`.

## Chinese and Malay dictionaries are far from matching (loop 23 #06)
- What: 1315 phrases are translated in Chinese but not Malay, and 327 the other way round; `t()` shows English for them.
  The exact lists are in `src/lib/i18n/key-parity-known-gaps.ts`, and `key-parity.test.ts` fails on any new gap.
- Why: translations need a native-speaker pass; the loop adds none.
- When to fix: next i18n sweep (audit Q1); shrink the lists as phrases are translated.

## Dashboard query fan-out (audit P3, P5)
- What: `loadSalesStats` runs per salesperson, about 24 queries per MD dashboard view. Company detail loads a contact's full activity history and slices it to 10 in JS.
- Why: not broken today; the fix touches the report snapshot and its tests, and the audit rates it medium.
- When to fix: when the team grows or the dashboard feels slow: fetch team-wide stats once, and limit the contact history in SQL.

## Unpaginated lists and a missing index (audit P6, P8)
- What: the MOF register, Tasks and Collection orders load every row and filter in JS. `mof_variation_orders(confirmed_on)` has no index.
- Why: row counts are low; PostgREST also cuts reads at 1000 rows silently (see "Unpaged lists", loop 18).
- When to fix: when a list takes about 1 s to load or reaches about 2,000 rows: page it and add the index in a new migration.

## Yearly target refresh runs on read (audit P7)
- What: `refresh_yearly_targets()` runs before reads on the sales dashboard, `/people` and `/performance`. It writes to every profile row on each view.
- Why: the refresh keeps the profile copy right on each view, so 1 January is the only known risk today (see "Yearly target copy on profiles", loop 16).
- When to fix: if contention shows up on 1 January, or move the refresh to a scheduled job.

## Repeated dialog, data-layer and test-mock code (audit R1, R3, Q2)
- What: about 99 files re-declare the dialog `useState` and `useTransition` block. The data layer has no shared helpers. The Supabase test mock is copied across about 53 test files. There is no component test harness (no jsdom or testing-library), so the upload button is tested through `attachFile` only (loop 24 #09).
- Why: each copy works on its own; extracting shared code is a wide change with little payoff per file. `FormDialog` and `useSubmit` in `installer-forms.tsx` are the starting point.
- When to fix: during the next change that touches many dialogs or tests: promote `FormDialog`/`useSubmit` to a shared file and add a shared Supabase fake under `src/lib/supabase/`. A component harness needs a new dependency: ask first.

## Commission rules are written twice (audit R2, D9)
- What: `calculateCommission` in TypeScript and `commission_payable_now` / `commission_basis` in SQL both implement the margin tiers, late cuts, splits and rounding. They must be kept in step by hand. The engine also exists in 4-5 SQL copies (D9), with only the parity test between them.
- Why: the app and the database both need the figure; picking one authority is a design change.
- When to fix: at the next commission rule change: pick one authority and have the other read from it.

## Small consistency items (audit R4, R5, C1, C2, Q5, Q6)
- What: 9 raw money formats bypass `lib/format/money.ts`. Two components import route code. Five files are over 500 lines: `mof-form.tsx`, `pickup-form-dialog.tsx`, `job-form.tsx`, `quote-view.ts`, `report-data.ts`. 47 `jobRole ===` checks sit outside `lib/auth`. `noUncheckedIndexedAccess` is off, and `src/components/ui` is excluded from Biome. One backfill migration has no rollback note.
- Why: each is small and none is broken; fixing them is cosmetic for the team.
- When to fix: when the file or area is next changed. Enable `noUncheckedIndexedAccess` in one pass with its fixes.

## Raw English in component files (audit Q1)
- What: component files render English without `t()`, so a Chinese or Malay user sees English on those screens. `global-error.tsx` is English only, because no language provider exists above the root layout (loop 24 #09). The audit's count (about 36 of 229 UI files) was not reproduced in verification.
- Why: the sweep needs a grep-based inventory first; the dictionary gaps are a separate item (see "Chinese and Malay dictionaries are far from matching", loop 23 #06).
- When to fix: next i18n sweep: start with `grep` for JSX text without `t()`, then translate the screens Chinese or Malay users reach.

## Monthly "late" is judged by today's due time (audit B2)
- What: `isLate` reads the current `app_settings.dueTime`. Changing the setting flips the late flag on past monthly reports. Weekly reports store `late` at submit; monthly reports do not.
- Why: a stored due time at submit needs a migration and a business-rule decision from Vicky.
- When to fix: when she changes the due time or asks for a stable late record: store the due time at submit.

## Minor: ActivityForm clock state and view-as allowlist (audit B4, B5)
- What: `ActivityForm` sets its planned/completed default from the clock on first render. It is safe only because it mounts on the client; the audit did not reproduce a bad case. A new read-only RPC that is not in `READ_ONLY_FUNCTIONS` (`src/lib/supabase/view-only-fetch.ts`) shows "View only – not saved." in view-as.
- Why: both are latent; no current screen triggers them.
- When to fix: B5 when adding a read-only RPC: add it to `READ_ONLY_FUNCTIONS`. B4 if the default is ever computed on the server.

## Security lows and by-design notes (audit S2, S5, S6, S-DB4, S-DB5)
- What: `.env.development` (test-copy URL and publishable key) is still tracked in git (S2). `requestOrigin()` trusts `x-forwarded-host` for OAuth redirects (S5). No app-side rate limiting on server actions (S6). `grant update (key)` on `app_settings` lets the MD's update policy rename a settings key and orphan its readers (S-DB4). `mof_lines` read-all is `using (true)` on purpose, since lines hold no money columns (S-DB5).
- Why: none is exploitable today. The key is public, Vercel sets the host header, RLS makes blind id iteration harmless, and the last two are accepted design. Loop 24 D2 skipped untracking the env file.
- When to fix: S2 when the test copy stops being shared or the repo goes private. S5 if the app is ever self-hosted. S6 when rate limits are needed. S-DB4 when the settings key policy changes.

## Schema lows: auth delete and DO numbers (audit D5, D8)
- What: deleting an auth user hits about 120 foreign keys with NO ACTION (D5). The DO number stops at 9999 with a cryptic CHECK message instead of "extend to 5 digits" (D8).
- Why: the "left" flow never needs the delete, and the DO limit is years away.
- When to fix: D5 before anyone writes a hard-delete flow: document the order or add cascades. D8 when numbers reach about 9000: widen to five digits and show a plain message.

## Commission appeals and MOF changes lack the left-people policy (loop 24 #07)
- What: `commission_appeals` and `mof_changes` have RLS but no restrictive "left people: no access" policy, so a person who left can still read them if their role matches.
- Why: found while fixing S-DB1 to S-DB3; each table needs its own migration.
- When to fix: the next migration touching either table: add the restrictive policy in that migration.

## Installer POs keep the typed installer name (loop 24 #06)
- What: `installer_pos` keeps the `installer` text column and the old unique `(mof_id, installer)` constraint. A trigger keeps the text in step with the directory.
- Why: the app reads the installer id now, but dropping the column changes a table the migration just fixed. Loop 24 D5 kept the old constraint for now.
- When to fix: once nothing reads `installer_pos.installer` (grep first): drop the unique constraint and the text column in one migration.

## Sign-out leaves an expired view-as row open (loop 24 #10)
- What: signing out with a view-as cookie older than 8 hours does not set `impersonation_log.ended_at`. `endViewAs` has the same gap.
- Why: the expired cookie is no longer honoured; the row only stays open in the log. Loop 24 #10 kept `endViewAs` behaviour.
- When to fix: the next change to `closeImpersonationLog` or `endViewAs`: close rows older than the cookie's expiry too.

## Error logs on other paths lack context (audit O4)
- What: `logServerError` (message, error and record context) is used only on the money and HR actions. About 150 other `console.error` calls log the raw error with no user or record id.
- Why: money and HR were the forensic priority (loop 24 D6); the rest adopt the helper when touched.
- When to fix: when a file is next changed, switch its `console.error` calls to `logServerError`.

## Observability lows (audit O2, O8, O9, O10)
- What: no timeouts on Supabase calls (O2), so a slow database hangs pages until the Vercel timeout. `session-sync.mjs` fails silently when `gh` auth expires (O8). Zod `.catch()` swaps silent defaults into report and reminder settings (O9). No cron exists; yearly-target rollover runs on request (O10).
- Why: none breaks today. Each needs a design choice (timeouts, a watcher for the watcher, schema drift logging, a scheduled job).
- When to fix: O2 when a slow database is seen on the live app. O8 when instructions stop flowing. O9 at the next settings schema change. O10 with the Integration loop.

## Dev-only audit advisories and patch lag (audit X1, X2)
- What: `pnpm audit` reports 2 advisories, both in the dev-only `shadcn` CLI (`minimatch`, `deepmerge`). Next, react and supabase-js have patch releases pending.
- Why: production does not run them; patching was not part of loop 24.
- When to fix: the next dependency update: take the patch versions and recheck `pnpm audit`.
