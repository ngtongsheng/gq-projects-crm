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
