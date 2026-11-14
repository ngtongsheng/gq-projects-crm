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
- Roles (D7): live app uses "Sign in as" (MD); her laptop uses the floating panel at the bottom of the page on the test copy (the sign-in skill was retired, loop 10 D9).
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
- Routes the demo has no page for: `/overtime` is the Claims page until Claims is built; `/guide` sits outside the
  matrix for everyone, as the demo's Guide button does; `/performance` stays the admins' page (perf is not built).
