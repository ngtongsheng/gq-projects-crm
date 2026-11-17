# Decisions

Loop 01 decisions: see `docs/loops/01-foundation/loop.md` (D1-D12).

## Context
- Client: Vicky, owner of a 17-person carpet sales + installation company. Team is non-technical.
- Product: invite-only internal CRM. Vicky vibe-codes it herself via Claude Desktop (Code mode); more editors may follow.
- Owner (ngtongsheng) builds the foundation and the setup, hosts everything on his accounts during evaluation, transfers at handover.

## Loop 02 inputs (setup skill + first run), decided 2026-11-01
- Mac first (Vicky's laptop is a Mac). Windows (winget path) in a later loop when a Windows teammate can test.
- No Homebrew (needs a typed admin password). Git via Apple's click-to-install popup; mise via user-level installer for node, pnpm, gh.
- No ZIP. Bootstrap: Vicky pastes one message into Claude Desktop pointing at a public `ngtongsheng/gq-setup` repo
  (instructions only, no secrets); Claude follows it. Fallback: public plugin marketplace. Verify both in #02 spike.
- Setup covers: GitHub account creation (plain steps), owner invites her to the repo, `gh auth login` (browser device flow), clone, install, first preview.
- After clone, the in-repo kit (CLAUDE.md, skills) takes over; updates arrive with every pull.
- Vicky on Claude Pro; upgrade later. Owner present in person for the first run on her Mac. No separate test rig.
- After handover: replace the CI destructive-change block with Claude double-confirming with Vicky.
- At handover: move to Vicky's paid Vercel Pro + Supabase Pro (commercial use, backups), company GitHub org.

### Findings from loop 01 (2026-11-02)
- Desktop spike: AskUserQuestion, project output style, project skills, worktree toggle, launch.json preview, `/plugin marketplace add` and raw-URL fetch all pass. Following written steps from a fetched URL is untested: test it end to end in loop 02.
- GitHub Free private repo has no branch protection or auto-merge (403). The deploy skill waits for `gh pr checks`, then squash-merges; the destructive-migration guard is advisory. Settings deny `git push` to main. GitHub Pro or a public repo closes the gap.
- Vercel preview links sit behind Vercel login (Deployment Protection). Decided 2026-11-02: no shared previews. Vicky and her team preview on localhost; Hobby allows one shareable link per account, made by the owner on request. Admin-only features are tried on the live site right after deploy. Revisit with Vercel Pro (team seats).
- Preview URL is read from the Vercel bot PR comment (GitHub deployments API is empty). The duplicate Vercel project `gq-projects-crm-ym4y` was deleted 2026-11-02.
- Skills may need extra allow-list entries (`gh api .../deployments`, `curl -sI`, `lsof`, `kill`, `sleep`) to avoid jargon permission prompts; owner decides.
- The dev database is shared by all open PRs: a PR missing another PR's applied migration fails `migrate-dev` until rebased.
- First admins are seeded with `scripts/seed-admin.ts` using the prod secret key from an untracked `.env.seed`; there is no change-password screen yet, so the temporary password stays until one is added.

## Loop 04 (Vicky's global agent layer), decided 2026-11-02
- The company layer (rules, plain style, tdd / diagnosing-bugs / grilling / get-help, settings, apply script) lives in
  public `ngtongsheng/gq-setup/agent/` and applies to every session on Vicky's Mac, not only this folder. Public
  because the bare-link setup must fetch it before GitHub sign-in; it holds no secrets, customer data or prices.
- The apply script runs at setup and on every SessionStart, pulling gq-setup. Risk accepted: whoever can push to
  gq-setup runs code on her Mac. Only the owner can.
- Default model is Opus on Pro. It burns the usage limit faster than Sonnet; accepted. Subagents use Sonnet.
- `get-help` is global, always filing in this repo with a `from:crm` / `from:other` label. The CRM copy is
  removed.
- The CRM keeps a byte-identical copy of `plain.md` so it works without the global layer; CI diffs it against
  gq-setup `main`. CRM-only wording (glossary words, preview and put-it-live lines) lives in `CLAUDE.md`.
- Details: `docs/loops/04-vicky-agent-layer/loop.md`.

## Loop 03
CRM features: to be grilled after loop 02. Source: Vicky's prototype `docs/mockup/gqp-office-demo.html` (team roster
and roles, lead pipeline, customers/designers, site activities, projects + payment claims, purchasing/POs with
supplier and warehouse statuses, deliveries, installation schedule and installers, stock/offcuts and returns, staff
OT claims, guide). The prototype is the spec input, not the data model: grill it into slices.

## Loop 07 (debt fixes), decided 2026-11-03
- D1: salespeople (bd, sales) see only projects where they are `pic_id`, `support_id` or `passed_by`; md, director,
  accounts, site and support still see all. Owner's choice, matching the prototype. Enforced by narrowing the
  projects read policy in SQL and by the projects page. Finding 55 of loop 05.
- D2: database rules are tested with `@electric-sql/pglite` (devDependency). `supabase/tests/*.test.ts` applies every
  migration to a fresh in-memory database with a stubbed `auth.uid()` and roles, and runs under `pnpm test`.
  Closes finding 3 of loop 05.

## Loop 09 (self-serve shipping), decided 2026-11-07
Goal: Vicky says the preview looks right and it is live, without git knowledge or waiting on the owner except for
accounts, secrets and billing. Full table and log: `docs/loops/09-self-serve-shipping/loop.md`.
- Autonomy (D1): her agent decides and ships. Vicky approves business rules (who sees what, new columns, backfills).
  The owner is only needed for accounts, secrets, billing, or a step that still fails after two fixes.
- Data loss (D2, D3): dropping a table or column, deleting rows or changing a column's type still trips the migration
  guard. The agent asks Vicky in plain words what disappears; on her yes it adds `data-loss-approved` and ships.
  Dropping a policy, function, trigger, view or index (no stored data) passes. `migrate-prod` dumps prod first.
- Go-live (D4): her "looks right" on the preview is the go-live yes; there is no second prompt.
- Batching (D5): small changes and fixes share one change from `main`; a new module or breaking change gets its own.
  Changes are never stacked on other changes.
- Ship queue (D6): at session start, merge approved green changes, bring the rest up to date, close superseded ones,
  remove merged worktrees, one-line status to her. Waiting branches take `main` in with a merge and a plain push, not a
  rebase and force push (squash merges make the branch history irrelevant). Her approval is a `<!-- vicky-approved -->`
  comment on the pull request. If a push is refused, `deploy` leaves a `vicky-approved-<branch>` marker and calls
  `get-help`; the owner adds an allow rule and the next session finishes the push.
- Permissions: narrow allow rules for her push and pull-request commands (`git push -u origin HEAD`,
  `git push origin HEAD:*`, `gh pr create/merge/edit`); denies for `main`, force and `--admin` still win. Auto mode
  ignores a broad `git *` allow and a classifier may still refuse a push, hence the refused-push path.
- Roles (D7): live app uses "View as" (MD, read-only since loop 11); her laptop uses the floating panel at the bottom of the page on the test copy (the sign-in skill was retired, loop 10 D9).
- Pending PRs (D8): 21, 23, 25 approved by the owner (company rating, MOF cost to Purchasing, MD "Sign in as") and
  consolidated onto `main`. PR 31 was left open as a draft: its 5 migrations have no screens and one rewrites a live
  function. The test copy's migration history is out of step with `main` until PR 31 is decided (`docs/debt.md`).
- Cross-platform (D9, D10, D16): agent scripts are Node, no `lsof`, `kill` or Python; `.gitattributes` forces LF and the
  formatter is back on; gq-setup `SETUP.md` has a Windows path (winget for Git, mise for gh, Node and pnpm).
- Test copy from a laptop (D11): the owner sends the dev secret key and database password privately once;
  `connect-test-copy` stores them in `.env.local`; `pnpm db:test-copy` refuses any other database.
- Health and backups (D12, D13): weekly `health.yml` keeps both databases awake and checks the CI token, opening an
  `Urgent:` issue on failure. Nightly `backup.yml` dumps prod to a 30-day artifact. Supabase Pro is deferred to handover.
- Remote instructions (D14): a session hook injects the owner's `for:vicky-claude` and `from:crm` issues; only text by
  `ngtongsheng` counts. The agent ships without asking her, comments, closes, and tells her one line.
- Asking for help (D15): `get-help` attaches a diagnosis and a condensed, redacted session transcript.
- Rollout caveat: the hook text reads like an instruction injected into a prompt, and a test agent primed to be
  suspicious treated it as untrusted. Watch the first real `for:vicky-claude` issue on her machine.

## Loop 10 (multi-module app), decided 2026-11-08
- Module (D5): a module is a tab in the top navigation with its own sidebar links. Each sidebar section carries a
  `ModuleKey` (then `src/lib/auth/nav-sections.ts`, today `"crm"`; replaced in loop 11, see below), and the labels map to the tab names. The app shell picks
  the active module from the pathname.
- Adding a module: add its key to `ModuleKey` and its label to the module label map, then give each of its sections
  `module: "<key>"` with the job roles allowed to open it. The top navigation and sidebar follow from that.
- URLs are not prefixed (no `/crm/...`). Existing links and bookmarks keep working, and pages do not move. Module is a
  navigation grouping only; access stays per section.
- Not renamed: the repo, package name and web address keep their current names.

## Loop 11 (office foundation), decided 2026-11-14
- A person who has left (`profiles.active = false`) has no role: the SQL role helpers return false, and every RLS table
  carries the restrictive policy "left people: no access". New tables add that policy in the same migration
  (`using ((select public.is_active())) with check ((select public.is_active()))`). `getCurrentProfile` sends them to
  `/left`, which signs them out.
- The migration guard lets `drop constraint c, add constraint c ...` in one statement through: replacing a rule keeps
  every row, and a stricter rule fails the migration instead of deleting data.
- Pages (D5, D7): every demo page is registered once in `src/lib/auth/pages.ts` (key, per-role label, href, icon,
  sidebar group, `built`). A role's default pages are the demo's `tabsDefBase` plus `ACCESS0`; the MD's changes are
  rows in `role_page_access` (People, "What each role can see"). `requirePage(key)` gates routes and actions; the
  sidebar uses `navPagesFor`. Cost visibility is the "margin" row or the person's `sees_margin`, in TS (`canSeeMargin`)
  and SQL (`can_see_mof_cost()`). This replaces `nav-sections.ts`; the registry has no module key, so the layout puts
  every page in the one CRM module until task 07 settles the shell.
- Shell (task 07): the top-navigation "module" tabs are gone, as in the demo; one sidebar lists the person's pages
  (`sidebarItemsFor` in `src/lib/auth/sidebar-items.ts`): built pages, a divider, the Guide, then Sales Performance and
  People (admins), Tasks, Tools & Forms, Leave. Icons are the demo's SVGs (`nav-icons.tsx`); HR and Claims show the
  dashboard icon because the demo has none for them. The "Ownership requests" / "My requests" sidebar link is gone (the
  demo has none): its count is the Dashboard badge, and deciders open the list from the dashboard's attention panel.
- Shell deviations from the demo, on purpose: no body margin around the page (the demo shows an 8px frame, a missing
  reset); no demo subtitle under the name; at phone width the header stays one row (the demo wraps "Signed in as" under
  the logo) and shows the name without the title; the phone drawer is a sheet over the whole screen, header included
  (the demo's drawer starts under the header); the theme follows the system (no toggle in the header yet).
- Routes the demo has no page for: `/overtime` is the Claims page until Claims is built; `/guide` sits outside the
  matrix for everyone, as the demo's Guide button does; `/performance` stays the admins' page (perf is not built).
- View as (task 08, D1): "Sign in as" is now the demo's read-only "View as". The MD still switches to the person's own
  session (so reads are exactly theirs), and every server Supabase call passes `viewOnlyFetch`
  (`src/lib/supabase/view-only-fetch.ts`): while the `gq_impersonation` cookie is there, anything but a read is refused
  before it leaves the server, for the server and admin clients alike. supabase-js calls every database function with
  POST, so read-only functions a page calls must be listed in `READ_ONLY_FUNCTIONS`; storage sign-URL calls (task 10)
  are POST too and need the same. Any cookie counts, even an expired or altered one, and the cookie outlives its 8-hour
  view, so a lapsed view stays read-only until "Back to ..." (which then signs out). Actions show their own failure
  text, not the demo's "View only – not saved." toast; the banner says nothing is saved.
- Final checks (task 15), found on the test copy:
  - Team work shows its customer: a Sales or Marketing Director read their team's projects and activities but not the
    customer behind them when someone else owned or added it, so "project at company" screens crashed (the Dashboard did,
    as Eddie). `20261115100000_team_work_shows_its_customer.sql` lets them read customers and companies their team has a
    project or activity on.
  - `src/lib/supabase/test-copy.ts` keeps the test copy and live app project refs in code. This is the one exception to
    "no refs in code" (D12): it is the guard that stops example data, one-click sign-in and the scripts from reaching the
    live app. Moving the refs to env would let an unset or wrong value switch the guard off, and refs are not secrets.
    On handover change the two constants and the test next to them (`handover-migration.md`).
  - Google sign-in with an address nobody added (a personal Gmail) is refused by Supabase before our callback runs, so
    the person sees "You haven't been added yet", not the company-domain message. The domain message shows only when the
    address has a user but is off the allowed list. Both refuse and leave no session.
  - View as round trip works: the MD views as a salesperson, a save shows "Could not save the customer. Try again."
    and writes nothing, "Back to <MD>" returns to the MD's own session (no sign-out).
  - Print: the app shell's inset (rounded, dark, margined) and the page background now print white and flush, and the dev
    role panel is hidden when printing, so a PrintLayout form is one A4 page.
  - Parity deviations left for the page loops (this loop is the shell only): the Dashboard content differs from the demo
    (tile set, "Sales activity" / "MOF & projects" tabs, columns); Costing, Tasks, Tools & Forms, Leave, HR and Log work
    are not built so they are hidden; Sales Performance shows for admins only.

## Loop 13 (costing), decided 2026-11-15
- D1: five tables plus `quote_revision_history`: `quotes`, `quote_revisions`, `quote_options`, `quote_items`,
  `fob_enquiries`. Items are rows with typed nullable cost columns, not the demo's JSON blobs.
- D3: cost and margin are stripped server-side for people without the margin flag; they see "Low / High margin".
  Without the flag, lines are edited sell-side only and keyed lines have cost 0. The owner may want a sales exception.
- D9, where the app differs from the demo:
  - Directors read all quotes (demo and drift doc; the task text said own team).
  - Approvers may decide their own costing (demo). A sent-low costing cannot be resent.
  - The editor is line cards with a category select, not per-category tables. No unsaved-edit warning, Versions panel
    or automatic "Installation for X" text. Save, add and remove option are multi-write (`debt.md`).
  - Register shows the lowest-option margin and highest sell per quote; revision copies are `-R<n>`.
  - FOB Enquiry: only MD, Director, Support, Accounts reply; landed cost is display only; no "Copy to WhatsApp" or
    "Mine" toggle; sales delete only pending enquiries; the size parser splits on ", " (fixes the demo's
    thousands-separator bug).
  - Client quote: product name only in compare view (no rug size); the sheet and TSV stay English; the compare view
    prints portrait A4.
  - Project card: lines on the Projects board card only; matched by `project_id`; only the newest revision counts.
  - Chinese: ~295 strings in `zh.ts`, Noto Sans SC; value-bearing server messages and page titles stay English.
  - Choosing the customer option cannot be undone. Nav badge and low-margin banner wait for Integration.
- Parity pass (2026-11-15, Chrome, md / director / sales / support / accounts, desktop and 390 px), deviations left:
  - Costing sub-navigation is header buttons (Below min margin, FOB Enquiry, New costing), not the demo's tab strip. Sales
    and BD get no FOB Enquiry button; support and accounts get no New costing (role rules in `job-role.ts`).
  - Register and Approvals use sentence case ("New costing"), the app's design system, not the demo's "New Costing".
    The Approvals subtitle states the rule without a hard-coded 30% and has no margin colour legend.
  - Register table is wider than the page at 1280 px; the last columns scroll inside the card (shared `DataTable`).
  - FOB Enquiry table merges the demo's Unit, Cur. and Sales columns into Qty, FOB and Quotation.
  - Seed data differs from the demo's example quotes (different customers, salespeople, amounts).
  - Compare view prints portrait A4 like the demo's `@page`; no landscape needed. Quote sheet is wider than 390 px, in
    the demo too.
  - D3: a salesperson who raised a FOB enquiry sees the supplier's reply (FOB, rate, shipping, landed cost) on their
    own costing, as the demo intends ("Sales sees it here"). Owner to confirm or strip it for people without the
    margin flag.

## Loop 12 (sales parity), decided 2026-11-15
- Company salespeople (D1): derived from the owners of the company's people (`contact_owners`); the demo's 2-owner limit
  is shown (first two), not enforced. "Only owners add people" checks that list. Salesperson assignment fields and
  Remove are not built (Remove loses data). Company sheet add-person is also open to the MD, Sales Director, and anyone
  when the company has no owned people (otherwise nobody could add the first). Header "Add customer" now refuses a
  non-owner adding to an existing company. Saving a company is MD and Sales Director only, as the database allows.
- Visits before go-live (D3): the migration sets `logged_at` on existing completed activities, so only later visits can
  be "not logged" or "late". Existing outcome text stays as learnings.
- Weekly report deadline (D6): `app_settings` row `weekly_report_due` = `{weekday:5,time:"18:00"}`; its editing screen
  comes with Tools & Forms. Only sales and bd file weekly reports.
- Outcomes: a trigger stamps `logged_at` and `late_logged`, so the client cannot write them. A lead is stored as
  `activities.lead_project_id` and copies `saveProject`'s schema and permission rule; lead source is fixed to cold call.
  A next step needs a follow-up date, owned by the person logging. "Needs outcome" means planned and start time passed.
  The three writes are not one transaction (see `debt.md`).
- Companies view: "No visit yet" is its own status, included in the inactive filter; the demo's "Assigned firms" filter is
  dropped (no company-level owners). Companies is the default view; the Salesperson filter is for managers only (not BD
  with a team); the company name is the link, not the whole row (DataTable has no row click). Pure derivation lives in
  `company-rows.ts`.
- Invitations: the invite list is every colleague except the creator (the demo limits it to MD, directors, BD and sales;
  `team_directory` has no job roles). Invitations go out only when an activity is created; no re-invite or change of
  answer later (no activity detail view). The picker is hidden for calls.
- Calendar: Monthly list replaces the sales Month grid (old `?view=month` opens the list). Week keeps one row per day,
  not the demo's 7-column grid (phone). Plan a call is a `?call=<date>` dialog. A Marketing Director with a team gets no
  Who filter. Excel and Copy list buttons are not built.
- Weekly outcomes: rows come from `my_team()` or the picked person; MD and Accounts see `report_filers()` plus anyone
  with a visit or report that week. On a Monday the default week is the week just ended (the demo's Sunday logic is
  buggy). Submit is blocked while outcomes are unlogged, enforced in the action, not the database.
  `weekly_report_due_at` is in `READ_ONLY_FUNCTIONS` so View as keeps working.
- Projects: migration `20261115140000` takes site out of "projects: read all". A site person who sells still cannot
  create or edit projects (the demo gives them full sales use; needs an add/edit rule change, not planned).
- Dashboard banners, the Sales Calendar nav badge and the on-leave strip go to the Integration loop (D2). Sales screens
  stay English only (D4).
- Migrations (D5): ours are `20261115130000` and `20261115140000` (renamed after loop 13 took `20261115120000`); rename again at merge if `main` has a
  newer one.
- Parity pass (2026-11-15, test copy, md, Sales Director, BD, sales, site, site who sells; 1280 and 390 px, no
  horizontal overflow). Page headings now read "Calendar & itinerary" and "Project pipeline" as in the demo, and the
  calendar's "visits done" counts walk-ins like the demo and Weekly outcomes. Deviations left, all deliberate:
  - All people keeps the existing people table (Position, Company, Mobile, Owners, rating, account type, CSV) and its
    filters, not the demo's six columns.
  - Weekly outcomes rows are expandable cards (a table does not fit a phone); the same numbers, the Week bar and the
    report block are there. Monthly list moves months with the arrows, not a Month picker.
  - Projects keep the existing Person filter and stage filters instead of the demo's per-person count chips; the List
    columns are the existing ones (Flags, Est. commission, PIC).
  - Sales and Site who sell read every company and customer (existing "read all" rules) and request ownership to edit;
    the demo lists only their own under "My customers". Site who sell see only their own projects (none in the
    example data); a Site supervisor who does not sell has no Customers, Calendar or Projects, as in the demo.
  - Calendar cards and the Monthly list badge open the customer page, where Log outcome lives; the demo logs from the
    row. The invitee list also shows people who have left (`team_directory` has no active flag; needs a migration).

## Loop 14 (MOF & money), decided 2026-11-15
- D1, variation orders: new table `mof_variation_orders`; each non-zero `mofs.vo_amount` was backfilled as one VO dated at
  the MOF's confirmation date. A trigger keeps `mofs.vo_amount` equal to the sum (the column stays: commission and RLS
  SQL read it) and `save_mof` refuses a differing `vo_amount`. VO cost lives in its own table
  `mof_variation_order_costs` (RLS `can_see_mof_cost`) so salespeople never see it; it is added to MOF cost by the SQL
  view `mof_cost_totals`, so `mof-totals.ts` is unchanged. `commission_basis`, `commission_payable_now` and `import_mofs`
  were redefined in the VO migration. A VO counts as sales in the month it is confirmed (`order-sales.ts`, shared by
  performance and report stats); commission stays collection-based; report counts and performance margin/count stay by
  LOA month/year.
- Additional-work alert: SQL `reopen_for_additional_work`. A new VO that needs work on a finished job moves the site
  stage to installation (80%, not the demo's 95%, because app progress derives from the stage). Only a new VO reopens;
  VOs cannot be deleted. The alert is in-app on the Site Supervisor dashboard only; WhatsApp and the VO notice go to the
  Integration loop.
- D3, 180-day late cut: code default and the saved `app_settings` value (only where it still equalled 120) move to 180
  for all unpaid commission; paid payouts are never recalculated. A saved 120 is left alone if the first cut starts at
  180 or later, to keep the cut order valid.
- D4, appeals: decided by md and accounts (demo: Vicky and Jany), never on their own appeal. An approved appeal waives
  all late cuts on that person's line for that order. A rejected appeal is kept and a new appeal is a new row. The
  Appeals tab shows for md and accounts only; the Claims loop moves it.
- D5, MOF history: new table `mof_changes` stores raw values per field; a trigger copies every existing
  `mof_total_changes` row in and the old table is kept. `save_mof` takes a `changes jsonb` argument. The diff is computed
  in the app (a register editor could post a wrong list directly; the database blocks everyone else). "Job complete" for
  the reason rule means `site_stage` completed.
- D6, reports: team lead (`reports_to`) or md reviews, then md gives final approval (new status `approved`; an MD review
  is itself the approval). Director reports go to md only; a salesperson with no lead goes to md. Reports reviewed
  before go-live count as approved. "Vicky" in the demo means the `md` role, no name-based rules. The Marketing Director
  can review team sales reports in the database but has no Team Reports page (`debt.md`).
- D9, where the app differs from the demo:
  - Site reports stay with the Sales Director for review (the demo contradicts itself); BD director reports go to md only.
  - Site report: the OT table and activity summary are removed from the screen and print only; the frozen `otHours` stays
    (the site dashboard uses it). The itinerary is live from logs and confirmed bookings; remarks reuse the existing
    issues/support text.
  - Print: the sheet is the screen content with `print:hidden` on screen parts, not a separate overlay;
    `PrintSignatureRow` has an optional 3-column prop; no "Printed" date stamp.
  - Performance: targets prorate over actual year days (leap-aware) using `profiles.yearly_target` with `joined_on` /
    `left_on`; per-year targets come with People & HR. Hidden-director rule covers Sales and Marketing Director. Best
    month ties go to the earliest. The team panel omits visits, new customers and pipeline. The chart is plain SVG, no
    library; its dark-mode tokens fail the dataviz lightness check (`debt.md`).
  - Appeals pill reads "Special approval by X" without an emoji; the Appeal button shows only on one's own line with a cut
    above 0 and no standing appeal.
- Tests: vitest `testTimeout` and `hookTimeout` are 30 s, because DB tests build from all migrations and slow down as
  migrations grow.

## Loop 15 (tasks and leave), decided 2026-11-15
- D2: leave balances start 1 Jan 2027; HR & Accounts enters carry-forward from 2026 through the per-person
  entitlement override. No 2026 records. Leave dated in 2026 is not blocked, so real December 2026 leave can be saved.
- D3: task and leave reminders are in-app only (tiles, overdue, escalation worked out when the page loads, no cron).
  Reminder and escalation days are calendar days with parameter defaults, no `app_settings` row. WhatsApp reminders
  and leave in Sales Calendar / Site Work go to Integration.
- D4: approvers come from job role and `reports_to`, never names ("Eddie" is the `director` job role). Never your own;
  the MD's own leave goes to the Sales Director. The MD decides any step; HR & Accounts any MC or hospitalisation
  step. Task approval: the assigner or the MD. Assigners: MD, Director, BD, Support, Marketing.
- D7: leave policy (14 AL, 14 MC, prorate by join month to half day) is in `app_settings`; per-person per-year
  overrides (al, carry, mc) are in `leave_entitlements`. An override replaces the whole default. The entitlement sheet
  edits the later of this year and 2027. No policy editor yet.
- Leave decisions go through the `decide_leave` SQL function so the step order and the final result change together.
  Days are counted in SQL when the request is saved.
- Holiday edits do not recount leave already saved (`debt.md`).
- Hospitalisation leave does not reduce the MC balance (demo `lvBal`).
- Task status rules are also enforced by the `guard_task_write` trigger, so an assignee cannot complete their own task
  through the API. The server action also requires a comment on a revision.
- `task_people()` and `leave_people()` SQL functions list assignees and team data with job role, join date and
  `reports_to`, which `team_directory()` lacks.
- Not modelled (not in the drift field list, or Integration): task customer, "bring me along", appointment link.
- Slips: the "original given to HR" tick needs an uploaded slip, stricter than the database. A rejection remark is
  optional.
- Chinese: server-action messages, page titles and calendar month and weekday names stay English; wording outside the
  demo's own strings needs a native read.

### Loop 15 parity pass (Chrome, test copy)
Checked Vicky (md), Cavan (sales), Jany (accounts), Affifa (designer), Akmal (site) on Tasks and Leave; 390 px via iframe. Accepted differences from the demo: task sheet is a side sheet, not a modal; no Customer field, Edit button or WhatsApp reminder; salespeople see the four task tiles; Workload lists everyone with tasks; approvers named by job title; example data differs; "Attach" strings from the shared file upload stay English; the Apply leave dialog closes with its X only.

## Loop 16 (HR, Tools & People), decided 2026-11-15
- D1: HR data (policies, packages, grades, outstation rules) is readable and writable only by the job roles MD and HR &
  Accounts, enforced in row-level security. The `admin` role alone grants nothing, and View as cannot reveal it.
- D2: bonus bands are a fixed on-screen reference in HR, not a table; the app does not work bonuses out.
- D3: new `yearly_targets` table (person, year, sales target, visit target). Effective target is the person's row,
  else their grade's annual target. The current year was backfilled from `profiles.yearly_target`, and a trigger keeps
  `yearly_target` equal to the current year's effective target, so Performance keeps working. The edit grant on
  `profiles.yearly_target` is revoked; targets are edited through `yearly_targets`. Only MD, Sales Directors and HR &
  Accounts can edit them (the database refuses others). The 1 January rollover is a lazy refresh:
  `refresh_yearly_targets()` runs when Performance, the dashboard or People load, instead of a scheduled job. The year
  select offers this year or next; the visit target is visits per month.
- D4: staff packages start empty and are add-only. A typo is fixed with a new row on a new date, so history is never
  overwritten.
- D5: resignation handover (`hand_over_work`) moves the leaver's customers and open projects to a chosen person and
  writes a handover list. Commission on their MOFs stays with the leaver. Open means every stage except Awarded and
  Lost (On Hold moves); support-role projects and archived customers also move, since leaving them with a leaver is
  worse. The project guard is bypassed through a transaction-local `gqp.handover` flag set only inside the function, so
  any admin can run it (a PIC change is otherwise refused for non-MD admins).
- Grade is stored per person in `staff_hr_records`, not per package: the demo keeps grade per person and directors have
  no package. The per-person grade table drops the demo's 2026 target, sales so far, bonus and basic override columns.
  Signing the appendix stamps the current scheme version.
- Hotel level "Auto" uses job role and grade only; BD uses the salesperson standard package (avoids a circle).
- HR people list comes from `leave_people()` and `team_directory()`, so HR & Accounts need not be admin.
- Policy "Older" is derived from `replaces_id`. A policy has either a PDF or a link. The shared attachments bucket caps
  uploads at 1.5 MB, so larger policy PDFs are refused until that bucket is changed. The demo's sample policy and extra
  rules are only in the dev seed.
- Tools & Forms is built for all roles. Vinyl layouts A and B are recommended by order length and welding rod as in the
  demo (no offcut figure exists). Forms list every MOF except cancelled and closed, newest 80 (no completion date).
- Drive links are managed by the `admin` role only; the demo says MD or HR & Accounts. Widening is one RLS change plus
  one action change.
- The Best Link pickup row points to `/stock` until loop 17 builds Samples; loop 17 repoints `PICKUP_FORM_HREF`.
- Chinese: HR and Tools are translated (about 330 strings); printed forms stay English. The People targets, Sales teams
  and handover parts do not call `t()`, so they stay English like the rest of People.
- Browser parity was not run in this loop (needs the seeded test copy and a signed-in Chrome). Run it after go-live.

## Loop 17 (site work), decided 2026-11-15
- D2: Leave and MC come from the Leave module, so there is one balance in one place. `site_off` stores only office and
  other days; public holidays come from `public_holidays`. Log work's "Leave / MC" opens the apply-leave sheet. Any
  approved leave counts as an away day.
- D5: `site_logs` is extended (installation %, measurement, shooting, completed photos, return answer) instead of a new
  table. A log can have no MOF: free-text site and salesperson, optional pipeline project.
- D6: logging moves the site stage. Installation % maps to 60 + 0.35 x pct (cap 95); a signed handover means Completed;
  a delivery means Delivered. A stage never moves backwards, so a manual stage is not overwritten.
- Migration guard: `DROP NOT NULL` now passes (it loses no data). `DROP NOT NULL, DROP COLUMN` in one statement is
  still caught.
- One `site_logs` row per activity per visit. The `photos_*` columns are shared by shooting and handover rows.
- Snooze lives only in `site_follow_up_waits`; the follow-up row is not changed.
- Reminder settings are one JSON row in `app_settings` under the key `site_reminders` (no migration). MD and admin
  edit it; the Director sees the form disabled. Nothing is sent until Integration.
- Balance stock is stored only as `return_answer` text. Items, quantities and return method per row wait for loop 18.
- No "Didn't go" option (there is no table for it) and no office WhatsApp number setting yet: the stock-return link
  opens WhatsApp to pick a chat. `photos_to` stays empty (no sales-support setting yet).
- The new-site salesperson list is all of `team_directory`, because the site role cannot read job roles.
- BM strings are in `src/lib/i18n/bm-site-work.ts`. Server-action messages and WhatsApp texts are not translated.
- Also decided in the build: the old site-log dialog and `addSiteLog` were retired (the wizard replaces them); logging a
  shooting closes that MOF's open shoot requests; Add follow-up got an optional "Assigned to"; snooze counts the
  person's own week (site Mon-Sat, others Mon-Fri); the support team sees "before joined" and leave days as Missing
  (`leave_people()` is manager-only); Site log and other tables are not scoped per salesperson (RLS gives read to all).
- Browser parity was not run in this loop (the new migration was not on the test copy yet). Run it after go-live.

## Loop 18 (installation and stock), decided 2026-11-15
- D1: `installers` is a new table, backfilled from the distinct trimmed names in `jobs.installer`, `installer_pos` and
  `installer_claims`, plus `mofs.installer_name`. Jobs get an `installer_id`. The text columns stay (no data lost) and a
  trigger (`link_job_installer`) keeps text and id in step; dropping the text is a later, approved step. Installers got
  a `description` column (what they can do). People who have left get no access to the table.
- Renaming an installer does not rewrite the name on old jobs (RLS stops editors writing to `jobs`). The calendar
  filters by `installer_id`, so it still finds them. Logged in `docs/debt.md`.
- D2: DO numbers are issued by the database. Next = max(used, cancelled) + 1, seeded at 5541, shown as the MOF no plus
  four digits. The next number lives in its own one-row table (`delivery_order_numbering`), not `app_settings`, so
  "must exceed the last used" cannot be bypassed. Issuing locks that row (`for update`) and `running_no` is unique, so two
  people cannot get the same number. PGlite is single-connection, so concurrency is argued from the lock, not tested.
- There is no cancel function: the number goes on the void list automatically when `running_no` is changed or cleared or
  the DO is deleted. The Cancel button on the job postpones the job and clears the number. Void-list rows cascade when the
  example data is reset.
- `issue_do_number` is for MD, Director and Purchasing; `set_next_do_number` for MD, Purchasing and HR & Accounts. Only
  the MD can correct an issued number. A typo when keying a number by hand cancels the old one (see debt).
- D3: print never blocks (the warnings stay warnings). Saving DO items is one atomic function (`replace_delivery_order_lines`).
  DO items are edited in a dialog on the MOF page, not in the job form; the old free-text items input is gone and old DOs
  keep their text.
- D4: Samples use the D2 pattern for SR-0001 (`sample_pickup_settings` holds the next number, a void table keeps cancelled
  ones). A saved pickup form takes samples out in the same transaction (`save_sample_pickup`). Sample quantity changes
  only through `sample_moves`, so it always matches the history.
- A pickup row over what is in stock is refused (the demo clamped it to zero), and its unit must be the sample's unit.
  Pickup forms can be deleted by people who edit samples (that cancels the number and returns the samples), but there is
  no delete button yet. Methods are stored as keys. Paste keeps a sample's existing unit and skips existing lines by default.
- Samples tab links keep Stock highlighted in the sidebar on `/samples`.
- D5: leftover gets a `collected_by_supervisor` status (the check was re-added, existing rows kept), `received_at` and
  `received_by`, transport (arranged state is worked out from `transport_by`), credit note, keep-why and `sold`
  allocations in `leftover_allocations`. Allocations are add-only (no edit or delete) and cannot take more than is
  available. `leftover_id` stays tied to a MOF: "+ Add leftover stock" with no MOF is not built.
- Supervisors mark leftover collected on the Site Work MOF page (not on the leftover page). `/stock/leftover` shows two
  tables: Best Link and Returns from site. The supplier is free text with a suggestion list.
- D6: supplier emails are `mailto:` drafts only. The database sets the notice on confirm, extend or release
  (`supplier_notice`); people only mark it sent. The supplier address is not stored, so the draft's To is empty.
- Installation: no Coming up table and no Team size; phone is required to save an installer; the Site supervisors view is
  a day-by-day week list, not a 7-column grid; a decline reply is saved only on decline (a database check); the booking
  list runs from today to 365 days ahead and includes Declined; there is no Cancel for a booking (no cancelled status);
  `supervisor_only` and `salespeople()` came in a second migration (20261118110000).
- The delivery log and the samples list are not paged: more than 1000 rows would be cut off by PostgREST (debt).
- Chinese and BM: `t()` is now wired through about 55 screens. BM covers the screens a site person sees; the printed DO and
  the pickup receipt stay English. The example data gets DOs 9202 and 9203 and a cancelled 9204 (the existing Zoho DO is 9201).
- Browser parity was not run in this loop: the eight new migrations were not on the test copy. Run the checklist in
  `docs/office-parity/drift-site-stock.md` after go-live. After go-live, tell Vicky to set the next DO number once.

## Loop 19 (claims), decided 2026-11-16
- D1: one claim per person per month, cut-off day setting (default 25). Flow Draft, Submitted, Checked (`accounts`),
  Approved (`accounts` or `md`), Paid (`accounts` only); Returned from Submitted or Checked. Rules use roles, never names.
  Approver, checker and times live only in `monthly_claim_log`; the claimant has a `note` field (appeals go there).
  "Pending" means submitted, checked or approved; paid frees the commission line.
- D2: commission lines come from the existing commission data at 90% paid, late cut shown. A line in a pending claim
  cannot be claimed again (database constraint). Approving is one function (`approve_monthly_claim`) that also writes
  `commission_payouts`, so an approved claim never lacks payouts. Pay uses the claim month's report; submit uses last
  month's.
- D3: OT stays in its tables. The OT policy on `ot_claims` now lets md, director and accounts decide. `/overtime` stays
  as a deep link (it was never in the nav); Claims has an "Overtime to decide" section, because directors have no manager
  view. The attention link points to `/claims`.
- D7: the Appeals tab moved into Claims; the old `/commission?tab=appeals` is not redirected (nothing links to it).
- Settings: claim settings are the `claims` key in `app_settings`. The late1/late2 settings stay in the `commission`
  key because accounts cannot write it, so they are edited on `/commission/settings` (md only).
- Deviations from the demo: the monthly cap is petrol + toll + parking and excludes mileage (D5 and the HR package label
  win over the demo's cap types). Cap 0 means no cap; the cap uses the package on the cut-off date and the hotel budget
  the line's date. A flagged claim needs a remark from both accounts and md (the demo asks only accounts). Adjustments are
  allowed only while Submitted or Checked, and lock after approval, because payouts are written at approval. Waiving a
  late cut raises the line to original plus cut and needs an approved appeal.
- Claimant page: caps and meal rates are read with the service role for that one person, because packages are readable
  only by md and accounts; salary never reaches the page (debt).
- Commission lines start unticked (a tick is a database row). An expense edit cannot cross claim months: delete and re-add.
- Print omits the invoice date (not stored), a meals column (nights only) and the OT approver name; the signature heading
  is "Approved by".
- BM and Chinese wording is the agent's own (the demo has no text for it); Vicky has not reviewed it.
- Browser parity was not run in this loop (the two migrations are not on the test copy). Run the checklist in
  `docs/office-parity/drift-money-reports.md` after go-live. Migrations: `20261119100000_monthly_claims.sql`,
  `20261119110000_monthly_claim_steps.sql`.

## Loop 20 (browser control in opencode), decided 2026-11-15
- opencode cannot load Claude in Chrome: those tools exist only inside a Claude session. Control instead comes from
  `chrome-devtools-mcp@1.13.0` with `--autoConnect`, which drives her real Chrome, so her profile and sign-ins are
  there. A separate browser would meet the sign-in page, not her app.
- The setting lives in `~/.config/opencode/opencode.jsonc` (on this machine a symlink into
  `~/work/config/opencode/opencode.jsonc`): an `mcp` entry for the package plus `"chrome-devtools_*": "allow"`.
  Browser tools are not prompted, by owner decision 2026-11-15: a click that waits for an approval every time cannot
  check a page for her.
- Observed (2026-11-15): `opencode mcp list` shows `✓ chrome-devtools connected`. `opencode run --auto` opened
  `http://localhost:3000` and saved a 424 KB screenshot of her signed-in dashboard, not the sign-in page, because her
  profile holds a session cookie. The Chrome **Allow** dialog did not appear on any connect after remote debugging was
  enabled.
- Limits:
  - Chrome 144 or newer; remote debugging is turned on once at `chrome://inspect/#remote-debugging` and stays on.
  - If connecting fails with `EPERM`, grant Ghostty access under macOS Files & Folders.
  - The **Allow** dialog may reappear (a Chrome restart); approve it again.
  - Page content and prompt injection are a real risk now that clicks are unprompted: browser output is untrusted data,
    and reading it never authorises a write.
  - `take_screenshot` writes only inside the workspace root; save into the repo and move the file, or pass a repo path.

## Loop 21 (parity sweep), decided 2026-11-16
Browser parity ran on the test copy (`pnpm dev`) against the demo. Numbers differ everywhere because the test copy's
seed is not the demo's example data; that is never drift. Larger gaps are in `docs/office-parity/drift-after-sweep.md`.

Loop decisions (`docs/loops/21-parity-sweep/loop.md`):
- D1 Scope: loops 14, 16, 17, 18 and 19 (12, 13 and 15 had already passed). Integration became loop 22.
- D2 Depth: every role that sees the screen, at 1280 and 390 px, structure diff plus screenshots.
- D3 Target: `pnpm dev` on the test copy (`gq-crm-dev`), signed in through the dev role panel, demo from `docs/mockup`.
- D4 Fixes: UI-only and at most about three files are fixed in the loop; anything needing a migration, a new rule, a
  business answer or more files is a row in `drift-after-sweep.md` (42 rows: S 10, M 21, L 11).
- D5 Seeding: `seed:example` reads `.env.local` and still refuses any URL but the test copy.

### Real bugs found by the sweep
These only showed in the real browser against real Supabase. All are fixed in this loop.
- Marketing Director and Sales Director got a server error on the MOF Register, Installation (calendar and unsigned
  DOs) and Leftover: a row whose MOF they cannot read came back with a null MOF. Those reads now use `!inner`, so such
  rows are left out (see [IN2], [SW4], [ST5] for the product question).
- The Log work wizard crashed on step 1 in Chrome 157 (an effect returned the Promise from `scrollTo`).
- Four numbering functions (`issue_do_number`, `set_next_do_number`, `set_next_sample_pickup_number`,
  `save_sample_pickup`) updated a one-row table with no WHERE clause, which Supabase (pg-safeupdate) refuses: no DO
  numbers and no pickup forms on the real database. `20261119120000_numbering_where_clause.sql`.
- HR & Accounts got a server error on All claims and the claim review page: the `profiles` embed came back null for
  them. New `claim_people()` function for the MD and HR & Accounts (`20261120100000_claim_people.sql`).
- The claim review page `/claims/[id]` failed for every role (a client helper called from a server page).
- Saving claim, commission, stock and site-reminder settings was refused for the MD: the `app_settings` upsert writes
  `key`, which had no update grant (`20261120110000_app_settings_upsert.sql`).

Lesson: PGlite tests do not catch pg-safeupdate (UPDATE without WHERE) or per-role RLS null embeds, so browser parity per
role on the test copy is the check for any new read or database function. `scripts/migrations-update-where.test.ts` now
guards the first.

### Not covered
- Cells compared by structure and overflow only, not side by side with the demo: 390 px for much of Money and reports
  (sample only), Tools for eight people at 1280 px, HR as HR & Accounts at 390 px, Log work wizard steps 3 and 4 at 390 px,
  Log work and Site Work at 390 px for Akmal, Jess, Wai Mun and Vanessa, DO print, DO items and numbering dialogs (demo
  has no saved items to compare).
- The Marketing role: the only marketing person is the vacant "Marketing Exec" in the seed, so Photos & videos and its
  two-tab rule were checked by the `siteViewsFor` unit tests only.
- Claims [CL2] (late-cut Appeal and Decide dialogs, Commission's link to Appeals) and [CL3] (BM and Chinese labels at
  both widths) were not run; also not run: the laptop message when the service key is missing, and the stock settings and
  site reminders saves (they share the fixed upsert but were not re-run in the browser).
- Samples [ST6] and Commission [C5]: the demo or the seed has no data for them, so only structure or empty state was seen.
- Printed forms were measured against the A4 height, not printed.

### Money and reports (task 02)
- Fixed in-loop: the MOF Register returned a server error for the Marketing Director (the delivery log read a DO whose
  MOF the person cannot see; those DOs are now left out). Page headings read "MOF register", "Team reports", "Director
  reports" and, for people who see only their own lines, "My commission", as in the demo.
- MOF detail: a full page with the same sections as the demo's sheet (order, products, variation orders, supplier POs,
  delivery, installer POs and claims, change history), not a modal. Forms are pages in this app.
- MOF Register: the demo's "Targets" button is not there; yearly targets are set in People (loop 16).
- Commission settings: its own page for the MD. It also holds the base rates, claim threshold, split share and flat
  pass-down rate; the demo's "Minimum quotation margin" stays in Costing.
- Money is shown in full ("RM 451,300.00"), not the demo's compact "RM 1.26M", on every screen.
- Sales Performance: one wide table per person (months, year to date, target, achieved, MOFs, margin, outstanding)
  replaces the demo's two tables. The page stays admin-only (loop 11); see the drift list for the other roles.
- Reports: the MD's second step reads "Give final approval", not "Approve (Vicky)" (roles, not names; loop 14 D6).
- Site report: the schedule check is the sentence under the itinerary heading; the full planned-versus-done panel
  stays in Site Work.

### People, HR, Tools (task 03)
- Fixed in-loop: HR policy rows keep icon, title and buttons on one line; the scheme summary's long "not checked yet"
  note wraps, so HR no longer scrolls sideways at 390 px; the Work commencement form uses the demo's tight variant and
  now fits one A4 (it ran onto a second page); a form's MOF picker and Print stay beside its title.
- People: left people stay in the main table ("Salesperson · Left") and their handover list is in their Settings
  dialog, not in a separate "Left the company" table. Targets are set in Settings (this year or next).
- HR copy says "the Managing Director and HR & Accounts", not the demo's names (roles, not names).
- HR layout: the editable J1-M2 grade table sits on "Sales grades & bonus" (the Policies tab keeps a read-only copy in
  the scheme summary); the demo edits it inline in the Policies tab. A policy's file is replaced through its Edit
  dialog, not an "Attach file" button. Standard packages and outstation rules are headed sections, not one framed card.
- Tools: same fields and same figures as the demo (wallpaper rolls, vinyl metres, welding rod). The app uses compact
  segmented controls and its own number font. Drive form links are added by the `admin` role only (loop 16 D);
  Jany (HR & Accounts) does not see "Add a form".
- Sales Performance is missing from the sidebar of Eddie, Vanessa, Cavan and Jany on Tools and HR: same gap as [P1].

### Log work and Site Work (task 04)
- Fixed in-loop: the Log work wizard crashed on step 1 in current Chrome (the page scroll effect returned the Promise
  that `scrollTo` now gives back, which React rejects); it is a plain function body now. Choice buttons are centred and
  the picked one is tinted teal with a teal border, as in the demo; activities sit four across on wide screens; "Another
  site today" is the dark button on the saved step. Site Work: the heading reads "Site work"; stage counts are tiles
  (number over label); tables wrap long text so Jobs, Site log and Shooting wanted no longer scroll sideways at 1280 px;
  the Site log shows three supervisor tiles across; the MOF number in the MOF summary finder stays on one line; the
  new-MOF banner puts its button under the text on a phone.
- Fixed in-loop, BM: 25 Log work strings now use the demo's wording (they had been rewritten in loop 17 on the belief
  that the demo had no entry); Tasks and Leave read "Tugasan" and "Cuti" in the sidebar, as in the demo.
- Follow-up owner "Client" reads "Client / main contractor", as in the demo's filters.
- Log work: Leave, MC and office days go through the two-step "Away from site" dialog (loop 17 D2), not the demo's one
  sheet of five chips. The follow-up banner lists every open follow-up with "Done" and "Still waiting" (the demo shows
  two and "Show all"; "Done – solved"). The planned-but-not-recorded banner is extra. Icons are line icons, not emoji.
  The new-site salesperson is a select over the whole team directory (the demo shows chips without Vicky).
- Log work wizard: the job list shows MOF number, project, client and percent installed on three lines (the demo has one
  line with the salesperson); unanswered questions have an amber outline; yes/no buttons are two equal halves; Back and
  Save sit at the end of the page on a wide screen (sticky bar on a phone, as in the demo). The 390 px "Record a site"
  bar is full width, the demo's floats with a shadow.
- Site Work: the Stock returns tab has no count in its label (see [SW1]). The Site log opens on the current month with
  previous/next arrows and supervisor chips, not the demo's month and supervisor selects. Reminder settings, the
  "Installer claims to verify" panel (loop 14) and the Daily log's "missing" summary are extra.
- Not reachable in the browser: the Marketing role (Photos & videos and Site log only). The only marketing person is the
  vacant "Marketing Exec" who has left, in the seed and in the demo; the two-tab rule is covered by the `siteViewsFor`
  unit tests.

### Installation and delivery orders (task 05)
- Fixed in-loop, bugs: the Installation calendar and the "DOs not yet signed" panel returned a server error for the Sales
  Director and the Marketing Director (a job whose MOF they cannot read came back with no MOF; both reads now leave such
  jobs out, so those two see only their team's jobs, see [IN2]). `issue_do_number`, `set_next_do_number` and the two
  samples functions (`set_next_sample_pickup_number`, `save_sample_pickup`) updated a one-row table with no WHERE clause.
  Supabase refuses that ("UPDATE requires a WHERE clause"), so on the real database Purchasing could not issue a DO no.
  or set the next number, and a pickup form could not be saved; PGlite has no such guard, so the tests never saw it.
  New migration `20261119120000_numbering_where_clause.sql` (same bodies, `where id`), applied to the test copy, and a
  test that fails on any update in a migration without a WHERE clause. Samples are fixed here because the cause is shared;
  their parity check is task 06.
- Fixed in-loop, UI: all three Installation views are headed "Installation calendar" with the demo's subtitle (the
  sidebar keeps "Installation", "My schedule" or "Delivery & Installation"); the subtitle for people who cannot schedule
  says "Ask purchasing, sales support or the site supervisors..." (roles, not names). The page opens on the week, as the
  demo does; Month stays as an extra. The job and booking counts moved from the subtitle to the row with the date arrows;
  the supervisors and contacts views no longer show a count (demo: "15 active" in the panel heading). A DO print sheet
  scrolls inside its grey desk on a phone instead of the whole page scrolling sideways (all printable forms share it).
- Deliberate: "Settings" in the head (next DO running number) is extra; the demo only has "Change" in the Delivery log,
  which the MOF Register has too. The calendar filters apply with a "Show" button (the demo applies on change). Month and
  Week toggle, the "DO not issued" note and the Edit button on every job card are extra. The first line of a job's DO is
  not a separate "Issue DO no. now" panel but the checkbox of the same name next to the DO no.
- Deliberate: Installer contacts at 390 px shows three columns (Installer, Phone, Jobs); the demo scrolls all seven
  sideways. The DO print says "Back" where the demo says "Close", and the driver name line carries the transporter as
  "Transporter: Lalamove". The printed DO fits one A4 (content 929 px of the 1032 px available) with 12 rows.
- Roles checked on the test copy: Purchasing (support) and HR & Accounts open the next-number dialog and can save it;
  the MD can too (loop 18 D2); the Sales Director, Marketing Director, salespeople, sales support and Site Supervisors have
  no Settings button. Site Supervisors have no Edit button, so they cannot issue a DO no. A Site Supervisor sees and answers
  only their own bookings (Awal confirmed his own request; Akmal's, Sarah's and the others' were not in his list).
- Test copy changes made by the check (restored by re-seeding): DO no. 9205 issued to MOF-2026-016's delivery, one DO
  item line saved on it, Awal's measurement booking confirmed. The next DO number is the seed's.

### Stock, Samples and Leftover (task 06)
- Fixed in-loop, bugs: `/stock/leftover` returned a server error for the Sales Director (a leftover row whose MOF he
  cannot read came back with no MOF). The list and the segment count now leave such rows out (`mofs!inner`), so he sees
  fewer leftover items, same rule as Installation (task 05, [IN2]). The two samples numbering functions fixed in task 05
  were re-run in the browser: the MD, Sales Director, Purchasing, Sales support and HR & Accounts each saved a pickup form
  and set the next form no. without error. No other `.update()` or `.delete()` in `src`, and no other `update` or `delete`
  in `supabase/migrations`, runs without a filter (checked by script across both).
- Fixed in-loop, UI: the reservations page is headed "Stock reserved" as in the demo ("Stock" stays on the Stock items
  view); the reservation table no longer scrolls sideways at 1280 px (client, SKU and status columns wrap, so the hold
  buttons are visible) and shows "N days held" under the hold date; the Best Link and Returns tables and the Samples list
  no longer scroll sideways at 1280 px (long text wraps, so "Use for project" and Take out are visible); on a phone the
  printed forms' toolbar title ("Pickup form SR-0010", "DO ...") sits on its own row instead of shrinking to "P.".
- Deliberate: the Stock segment bar has a fourth segment, "Stock items", and the head carries "Download CSV" and "Add
  stock item" (the demo has neither). Salespeople and the Marketing Director get a "Request a hold" button (the demo says
  to WhatsApp Jess). The page subtitle is the count of lines needing action ("1 to confirm") and falls back to a shorter
  sentence than the demo's; it names roles, not Jess. The filter row is Active / Expired / expiring / All buttons. The
  "Expired - follow up" tile uses a hyphen where the demo has an en dash.
- Deliberate: the Email suppliers dialog has no "To:" line ("no email saved") because supplier addresses are not stored
  (loop 18 D6); it tells the person to add the address in their email app. "Mark as sent" works (tile went from 2 to 0).
- Deliberate: Samples has a "Settings" button (Best Link number, Drive folder, next form no.) and a "Pickup forms" list under
  the samples; the demo keeps the number and folder link inside the pickup form dialog and has no pickup list. The paste button reads "Paste from sheet" on every screen where the demo
  says "Paste from Excel" in Samples. The demo's 📄 icon is a Lucide icon. Take out, Back and Edit stack in a narrow column
  when the row is tall (the demo opens Edit by clicking the row).
- Deliberate: Leftover shows a "Search" button next to the search box (the page filters on the server; the demo filters as
  you type) and a second table, "Returns from site" (loop 18 D5). Its subtitle says "WhatsApp purchasing", not "Jess". The
  button that opens "Arrange transport" is labelled "Transport arranged" (the dialog and the badge read correctly).
- Checked on the test copy: Mark collected by the Site Supervisor (Awal, MOF-2026-016) and Arrange transport by Purchasing
  saved; "Use for project" saved a 1 pc allocation as the MD (the form refuses more than is available before it reaches
  the server); "Show sold out" reloads the list on click (1 item became 2). The receipt fits one A4 (751 px of 1032 px,
  10 rows). At 390 px the receipt keeps its A4 width and scrolls inside its grey desk (task 05).
- Test copy changes made by the check (restored by re-seeding): next pickup form no. set to 10, 20, 30, 40 and 50; five
  pickup forms saved (SR-0010 took 1 pc of UNJ-CT-37 out); 1 pc of Orbis Vinyl Plank offcuts used for a project; the two
  supplier emails marked sent; Awal marked MOF-2026-016's leftover collected; Purchasing arranged its transport.

### Claims (task 07)
- Fixed in-loop, bugs: HR & Accounts got a server error on All claims and on the review page, because the claim
  queries embedded `profiles(...)` and HR & Accounts reads only their own profile (the embed came back null). Names and job
  roles now come from a new `claim_people()` function for the MD and HR & Accounts (`20261120100000_claim_people.sql`, no
  data change); the "Not submitted yet" line, the flag count behind Approve and the printed form's "checked by" name use it
  too (the checker name uses `team_directory()`). The review page `/claims/[id]` failed for every role (a client helper was
  called from a server page; moved to `src/lib/domain/claim-review.ts`). Saving the claim settings (and the commission
  settings, stock settings and site reminders, which share the upsert) was refused for the MD: an upsert also writes the
  `key` column and only `value` could be updated (`20261120110000_app_settings_upsert.sql` grants update on `key`; the
  policies still decide who may write which key). No `UPDATE` or `DELETE` without a filter under `claims/` or `overtime/`.
- Fixed in-loop, UI: the claimant's Overtime section shows for site supervisors, or when an entry exists (it showed for
  everyone); the Sales Director's page is headed "My claims"; the Travelling section is numbered only for people who claim
  commission, with Overtime counted as 2 or 3 as in the demo; the Commission column shows "—" for no commission.
- Deliberate: the review is a full page, `/claims/[id]` (loop 19), not the demo's modal sheet. Wording names roles, not
  people: "Note to HR & Accounts", "Submit Nov 2026 claim", the flow banner and the claimant subtitle (shorter than the
  demo's, which also tells the person to print, sign and hand over the form). The month is a row of tabs (up to six
  months) and an "Earlier claims" table for the claimant, where the demo has one select for the current month. Managers
  also get an "Appeals" tab (D7) and "Overtime to decide" at the top of All claims (D3: directors decide OT there; the demo
  decides it from the review sheet). The late-collection cuts are edited on Commission settings (MD only), so Claims
  settings has no card title and no cut fields. Buttons read "Add expense" and "Add overtime" where the demo says "+ Add";
  the flow banner is blue where the demo's is green; "N to check" has no warning icon; submitted dates carry the year.
  At 390 px the manager list hides Commission and Submitted and scrolls inside its card.
- Checked on the test copy: submit gate, check, approve (Jany, and Vicky on a flagged claim), pay (after the MD approved
  the person's report), return, adjust an amount with a reason, receipt upload, tick and untick a commission line, OT
  decided by HR & Accounts and by the Sales Director, settings saved by Vicky and by Jany. The print sheet is 659, 654 and
  738 px high of 1,047 available (one A4). Not run: BM and Chinese labels, the Appeal and Decide dialogs (no late-cut line
  or appeal in the example data), the laptop message when the service key is missing.
- Test copy changes made by the check (restored by re-seeding): see `reports/07-claims.md` in this loop.

## Loop 22 (handoff to Vicky), decided 2026-11-16
Goal: Vicky opens Claude and the laptop brings itself up to date; Google sign-in is live. Full table in
`docs/loops/22-handoff/loop.md`.
- One command, `pnpm --silent catch-up` (`scripts/agent/catch-up.mjs`, Node only, Mac and Windows), runs at every
  session start and does only what changed: accepts the owner's invite, fetches the test copy keys, installs, applies
  migrations, seeds the 17 test sign-ins, saves pre-parity drafts, prints "What's new" once per version. It is silent
  when nothing changed. `--silent` because pnpm 12 echoes the script line otherwise.
- Keys travel through a private repo, `ngtongsheng/gq-dev-private` (`crm/.env.dev`), not WhatsApp. The CRM repo stays
  public (Vercel Hobby). Test copy values only; the fetch refuses a live app ref. Vicky got a write invite because
  personal repos cannot grant read.
- Pre-parity drafts are never rebased: each becomes the tag `archive/pre-parity/<branch>`, on her laptop and on origin;
  the old branches are removed. PR 31 is closed with a pointer to its tag.
- Her old hook cannot run the new script, so a `for:vicky-claude` issue tells her Claude to pull `main` in the main
  folder and run catch-up once. After that `session-sync.mjs` prints "Run `pnpm catch-up`" when it is due.
- Google sign-in goes live by publishing the consent screen (Branding with the live URL and `/privacy`); basic scopes
  need no Google review. Vicky is the first admin (owner runs `seed-admin.ts`); she adds the rest in People.
- A fresh test copy shows 15 people in the Sign in as panel, not 17: the seed makes 17 sign-ins and marks 2 as left.
- Laptop playbook for her agent: `docs/laptop.md`. README and `docs/features.md` use fresh screenshots at 1512 px.
- Rehearsal on a fresh clone passed (`docs/loops/22-handoff/reports/rehearsal.md`): catch-up 34 s first run, 0.13 s
  silent rerun.

## Loop 25 (travel claim, marketing expense, custom samples)
### Custom samples schema (task 06)
- `custom_samples` and `custom_sample_loans` are separate from the stock `samples` table. A "Not received" answer is
  a date appended to the loan's `not_received_on` array, not a log table: the demo only appends a line, nobody reads
  it back per entry.
- Customer and project on a loan are free text, as in the demo: a sample is often lent for a prospect who is not a
  customer record yet.
- Read access is "everyone but Site Supervisors", the page's default; an MD override that gives Site the page shows
  an empty list.
- The photo lives at `custom-samples/<sample id>/` (D11). The id is chosen before the upload, like HR policies, so a
  keeper may add a photo before the sample is saved. Photos only: the upload request refuses a PDF and the
  `photo_path` must end in .jpg, .jpeg, .png or .webp.
- Due date is set by the database from `app_settings.customSamples.loanDays` when the loan is added; a later change
  leaves existing loans alone.

### Custom samples page (task 07)
- Photos show through short-lived signed links (service key), so on a laptop without the key the list shows grey
  blocks and the detail sheet says photos open on the live app. The detail sheet asks for a fresh link when it opens
  because the page's link lasts minutes.
- A sample opens from its code (a button) rather than the whole row; the shared table has no row click.
- The borrow customer list is every company name (companies are readable by everyone), not only own and unowned
  contacts as in the demo; the field stays free text.
- The MD's salesperson picker lists active Salespeople, Marketing Directors and Sales Directors (from `task_people()`).
  A person in another job role who has the Sells flag borrows for themselves but is not offered to the MD.
- Delete asks "Delete this sample?" first, like the other delete buttons in the app (the demo does not ask).

### Custom samples return, give away, remind, settings (task 08)
- The Remind button uses the borrower's WhatsApp number from People settings (`profiles.whatsapp`), not the site
  Reminders setting: that setting only holds Site Supervisors, and borrowers are salespeople. Staff cannot read other
  profiles, so the page reads the numbers with the service key, for the office only; without the key (a laptop) the
  button opens WhatsApp with the text and no number, and says to add it in People.
- The demo counts each reminder (`reminded`, `remAt`) but never shows it; nothing is stored.
- "Not received" toast reads "Not received – <who> still has it, please follow up" (the demo's wording needs a
  possessive that does not translate by phrase).
- Edit is hidden on a given-away sample (the database refuses it anyway). Give away is offered to the office and to the
  current borrower; the database decides, and a sample already given away answers "already given away".
- Return, give away and loan-period saves are server actions with the database's own refusals passed through
  (`custom-sample-refusal.ts`); the settings dialog saves `app_settings.customSamples` through the keepers' policies
  from task 06.

### Marketing expense log and categories (task 10)
- The page opens on the Dashboard tab like the demo; until the dashboard and the other views are built, those tabs show
  "Nothing here yet." Edit categories sits in the page header (all views) for now; the dashboard task may move it.
- The demo's "Older categories still on expenses" panel is not built: expenses link to a category by id, so a category
  that expenses use cannot be deleted (the row shows "N used") and none are left behind. The way to retire a category
  is to move its expenses to another one by editing them.
- The categories dialog only has Move up, like the demo. Save deletes removed rows first and then saves names and
  order, so a refused delete changes nothing.
- A vendor typed in the expense form that matches no vendor (any capitalisation) is added as a company vendor in the
  same save; a failed expense save after that leaves the new vendor in the list.
- Delete asks "Delete this expense?" first (the demo does not ask). Only editors see the Add expense button and can open
  a line; HR & Accounts sees the log read-only.
- Server messages are shown through the dictionaries (`t(error)`), unlike the earlier pages that show them in English.

### Marketing dashboard (task 11)
- The chart is plain CSS bars (decision D9). The theme has five chart colours, so categories six and up reuse them
  paler (60%, then 35%) instead of the demo's 11 fixed colours. The legend and the hover text name every segment.
- A dashboard number or vendor opens the Expense log through the address (`month`, `category`, `q`). The log starts
  from those filters and, unlike the demo, clears any earlier search text. The vendor link searches the vendor's name,
  so a line whose description mentions that name also shows.
- The year, and "Show all vendors", are in the address, so a reload keeps them. The vendors panel says "Show all
  vendors" without the count (the heading already shows it).
- "Change vs previous month" shows nothing for January (no month before it in the year), like the demo.
- The events panel adds each event's cost-sheet lines (all years, like the demo) and its last row adds the year's log
  total. A row opens the Events tab; the event sheet itself comes with the Events task. The low-balance banners come
  with the prepaid task.
- Edit categories stays in the page header on every tab, not inside the dashboard table heading.

### Marketing vendors and part-timers (task 12)
- Companies are "auto-added" by the expense form: a new vendor name typed there becomes a company vendor in the same
  save (task 10). The prepaid task will do the same for its vendor field. Nothing else syncs names, because records link
  by id.
- Year totals and "Invoices" match by vendor id, not by the demo's case-insensitive name. The year picker is shared with
  the Dashboard (`year` in the address); "Last paid" looks at every year.
- Rename needs no cascade (id link). Delete: the form hides Delete and says "In use" when the vendor has an expense or
  a prepaid entry; the database refuses it anyway. "See payments" opens the Expense log searching the name.
- The part-timer's portfolio link may be typed without https://; it is saved with it. A company drops skills, rate and
  portfolio on save, a part-timer drops what-they-supply and contact person, so the form's hidden half never lingers.
- The "Rate" label of a part-timer reads "Pay rate" because "Rate" is already the exchange rate in Chinese. The
  Contact column reads "Contact details" for the same reason.
- The TOTAL row sums the vendors shown under the tab and search.
