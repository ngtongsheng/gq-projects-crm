# Loop 01: Foundation
Orchestrator: sonnet/high
## Goal
An invite-only internal CRM shell for Vicky's carpet company is live on Vercel (dev + prod Supabase, Singapore),
with a reusable design system, admin/staff roles, CI-driven DB migrations with a destructive-change guard, and
in-repo agent rules/skills that let a non-developer change, preview and deploy via Claude Desktop in plain language.
## Decisions
| ID | Decision | Why | Rejected |
|---|---|---|---|
| D1 | Next.js + Supabase + Vercel, Singapore region; private repo `ngtongsheng/gq-projects-crm` | Most agent fluency; built-in auth/Postgres; preview URL per change | SvelteKit, Cloudflare D1, Rails/Django |
| D2 | Two Supabase projects: `gq-crm-dev` (local + previews), `gq-crm-prod`. Migrations in `supabase/migrations`, applied by CI: dev on PR, prod on merge to main | Local Supabase needs Docker; not tied to her laptop | Supabase branching (paid), local migrations |
| D3 | Vicky needs a GitHub account only. Dev Supabase URL + anon key committed in `.env.development` (public by design, RLS protects data). Service-role key only on Vercel; locally, admin-only server features show a plain "works on the preview link" message | No secrets on her machine; one login | GitHub + Vercel + Supabase logins |
| D4 | Every change: branch + PR. On "Yes, deploy", Claude waits for checks, then squash-merges (auto-merge is plan-gated on GitHub Free, amended 2026-11-02); Claude watches the prod deploy and reports | Self-service; owner still sees PRs | Owner approves each deploy |
| D5 | CI fails on destructive SQL (DROP, TRUNCATE, DELETE, ALTER ... DROP/RENAME/TYPE) in new migrations unless PR has label `owner-approved`. After handover: replace with Claude double-confirm (loop 02+) | Free tier has no backups | No guard |
| D6 | shadcn/ui + Tailwind themed from Vicky's mockup (`docs/mockup/`: navy + mint, Figtree/Saira/IBM Plex Mono, light + dark); all common UI in `src/components/ui` + app components; catalog page `/dev/components`; rule: reuse before create | Agents know shadcn best; mockup is the approved look | Mantine, MUI, invented theme |
| D7 | Email + password. Roles `admin`, `staff` in `profiles`. Admins add people: server creates user + one-time set-password link via Supabase admin API; admin copies and sends it (WhatsApp). No email service until a company domain exists | Supabase default SMTP only reaches project team members | Resend now, magic link, Google sign-in |
| D8 | Agent kit lives in the repo: `CLAUDE.md`, `.claude/settings.json`, `.claude/output-styles/plain.md`, `.claude/skills/{preview,deploy,get-help}`. Always ask via multiple-choice prompt; never show jargon; get-help files a GitHub issue assigned to `ngtongsheng` | One source of truth, updates on pull | Separate kit repo, ZIP |
| D9 | Free tiers during evaluation (Vercel Hobby, Supabase Free). Logged in `docs/debt.md` | Owner wants evaluation first; pricing talk later | Paid from day 1 |
| D10 | Executor drives Vercel + Supabase dashboards via Claude in Chrome (profile "Agent", owner-authorized). GitHub: `gh` CLI only, never browser automation; GitHub web steps are owner actions | Owner instruction | – |
| D11 | Loop 02 (setup) inputs, recorded in `docs/decisions.md`: Mac first, Windows later; no Homebrew (Apple git popup + mise); no ZIP: bootstrap by pasting one message pointing Claude at a public `ngtongsheng/gq-setup` repo, fallback public plugin marketplace; Vicky on Claude Pro; owner present at first run | Owner choices | ZIP upload, Team plan push |
| D12 | English UI and agent language | Simplest | Bilingual |
## Tasks
| # | Task | Status | Depends | Model/Effort |
|---|---|---|---|---|
| 01 | Scaffold app + tooling | done | – | sonnet/high |
| 02 | Desktop spike checklist | done | 01 | haiku/low |
| 03 | Cloud setup (Supabase, Vercel, secrets) | done | 01 | sonnet/high |
| 04 | Design system + app shell | done | 01 | sonnet/high |
| 05 | Auth, profiles, roles, RLS | done | 03, 04 | opus/medium |
| 06 | People admin + invite link | done | 05 | sonnet/high |
| 07 | Destructive-migration guard | done | 01 | sonnet/high |
| 08 | CI workflows | done | 03, 07 | sonnet/high |
| 09 | Agent rules + plain output style | done | 02 | opus/medium |
| 10 | Skills: preview, deploy, get-help | done | 08, 09 | opus/medium |
| 11 | End-to-end smoke | todo | 06, 10 | sonnet/high |
<!-- status: todo | in-progress | done | blocked: <reason> -->
## Owner actions
- #02: run the Desktop spike checklist in Claude Desktop Code mode on your Mac; paste results into `docs/desktop-findings.md` (or tell the executor).
- #03: approve the Vercel GitHub app for `gq-projects-crm` on github.com when the executor asks (GitHub web = you).
- #11: open the prod URL, sign in as admin with the seeded credentials, confirm.
## Log
<!-- one line per event: YYYY-MM-DD · #NN · result · next -->
2026-11-01 · plan · loop written · /execute-loop
2026-11-01 · #01 · in-progress · worktree loop/01-foundation · planner tab closed by owner
2026-11-01 · #01 · done · verified install/check/typecheck/test/build pass · #02, #03, #04, #07 unblocked
2026-11-01 · #01 · decision · Node 24 LTS pinned in mise.toml, not 26 · 26 is days old, Vercel support unconfirmed
2026-11-01 · #01 · decision · removed cacheComponents/partialPrefetching from next.config.ts · forces Suspense around dynamic access, friction for auth in #05
2026-11-01 · #01 · decision · Biome ignores docs/mockup; "type": "module" set; Next AGENTS.md skipped · mockup is lint noise; #09 owns agent rules
2026-11-01 · #01 · note · Tailwind wired via @tailwindcss/turbopack loader in next.config.ts (create-next-app default); #04 should know
2026-11-01 · #02 · in-progress · delegating
2026-11-01 · #02 · blocked: owner · checklist written (7 rows), verified; owner runs it, then record Results/fallbacks · #09 waits on it; continue #03
2026-11-01 · #03 · in-progress · delegating
2026-11-01 · #03 · blocked: owner · classifier denied gh secret set (Secret-Store Writes); local part done (supabase devDep, config.toml, draft environments.md); no cloud resources created, no secrets written · #05, #08 wait on it; continue #04, #07
2026-11-01 · #04 · in-progress · delegating
2026-11-01 · #02 · note · rows 1 and 5 PASS (Desktop session); rows 2,3,4,6,7 pending owner · probe files in worktree .claude/ must not be committed; delete after rows 2-3
2026-11-01 · #03 · in-progress · owner explicitly authorised the executor to do #03 incl. secret writes (chat, 2026-11-01); re-delegating from step 1
2026-11-01 · #04 · done · verified check/typecheck/test/build pass; /dev/components prerenders; subagent checked light+dark in Chrome · #05 still waits on #03
2026-11-01 · #04 · decision · radix-nova shadcn preset, `field` instead of absent `form`; Biome excludes src/components/ui (generated code fails lint rules) · avoids lint-disables/vendor edits
2026-11-01 · #04 · decision · theme via next-themes data-theme; shadcn --accent = soft mint, mockup navy = --primary · keeps shadcn components working with mockup palette
2026-11-01 · #04 · note · `next dev` regenerates root AGENTS.md; set agentRules:false in next.config if it recurs (#09). /dev/components 404s on Vercel production (untested)
2026-11-01 · #07 · in-progress · delegating
2026-11-01 · #07 · done · verified check/typecheck/test (53)/guard exit codes · #08 needs #03
2026-11-01 · #07 · decision · guard args format A:path/M:path; editing or deleting a merged migration also fails; DO $$ bodies scanned · spec silent; #08 must fetch-depth 0 so origin/main exists
2026-11-01 · #03 · blocked: owner · Supabase dev+prod created (SG), signups off, 5 GH secrets verified, .env.development has no service key; Vercel project not created (reauth code emailed to owner) · remaining: Vercel import, env vars per scope, prod branch main, Supabase site URL/redirects, prod deploy check after merge
2026-11-01 · #03 · decision · publishable key name NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (current Supabase name); server var SUPABASE_SERVICE_ROLE_KEY holds the new sb_secret_ key · task allowed current key name
2026-11-01 · #03 · decision · SUPABASE_ACCESS_TOKEN is a legacy full-account token, 90-day expiry (renewal in docs/environments.md) · scoped 7-day tokens would break CI migrations
2026-11-01 · #03 · note · token value appeared once in a subagent dashboard screenshot; consider rotating it after loop; dev signup toggle saved but not reloaded to confirm
2026-11-01 · #05 · decision · start #05 though #03 is blocked · #03's Supabase dev project + sign-up setting (all #05 needs) are done; only Vercel steps remain. #08 stays blocked on #03
2026-11-01 · #05 · in-progress · delegating (opus/medium)
2026-11-01 · #02 · done · owner ran all 7 rows in Desktop: all pass (row 7 fetch only); recorded in docs/desktop-findings.md · #09 unblocked; probe files removed
2026-11-01 · #09 · in-progress · delegating (opus/medium)
2026-11-01 · #03 · in-progress · owner imported repo into Vercel (reauth done); delegating remaining Vercel env vars, prod branch, Supabase redirect URLs
2026-11-01 · #09 · blocked: owner · files written, pnpm check passes; acceptance needs the Desktop test (jargon-free answer + multiple-choice step) · #10 also waits on #08
2026-11-01 · #09 · decision · single CLAUDE.md (no @AGENTS.md import; imports untested in Desktop); next.config agentRules:false; .gitignore ignores .claude/worktrees; owner shown as "Tong Sheng" in text Vicky sees · spike never tested imports
2026-11-01 · #09 · note · settings allow `git *` broadly; deny covers force-push and db push but not plain `git push origin main` — #08 should add branch protection or a deny so D4's PR flow is enforced
2026-11-01 · #05 · done · verified check/typecheck/test(58)/build/guard; dev server: / -> 307 /sign-in, /sign-in 200; subagent ran 15 RLS checks on dev DB via SQL editor, test users deleted · #06 unblocked
2026-11-01 · #05 · decision · src/proxy.ts instead of middleware.ts (Next 16.4 rename); staff on admin pages redirect to /; admin updates limited to full_name+role; lazy env read so build works · per Next docs / spec gaps
2026-11-01 · #05 · decision · dev DB has supabase_migrations.schema_migrations row for the profiles migration (as `migration repair` would) so CI db push won't re-apply · migration applied by hand via SQL editor
2026-11-01 · #05 · note · not verified: real password sign-in (no admin on dev yet; run scripts/seed-admin.ts per docs/environments.md; temp password, no change-password screen yet). Stray Chrome tab 904780670 (dev SQL editor, maybe "Leave site?" dialog) needs closing by owner
2026-11-01 · #06 · in-progress · delegating
2026-11-01 · #03 · done · verified 5 GH secrets, no service key in .env.development, no TBD in environments.md; subagent verified Vercel env vars per scope, prod branch main, Supabase auth URLs; prod URL https://gq-projects-crm.vercel.app · prod deploy check pending until merge to main · #08 unblocked
2026-11-01 · #03 · note · env changes need a redeploy (first push to main); dev secret key verified by length only, first preview deploy is the real check; prod key partly shown once in a subagent screenshot; prod redirect allow-list empty: add https://gq-projects-crm.vercel.app/** before invite links are tested in #11
2026-11-01 · #08 · in-progress · delegating
2026-11-01 · #08 · decision · write workflows + repo settings now; defer branch protection and the live test-PR acceptance until after loop merges to main (protection would block the merge push; PR checks need workflows on main) · move live acceptance into #11
2026-11-01 · #06 · done · verified check/typecheck/test(72)/build; Vercel-preview invite e2e deferred to #11 (needs seeded admin + deployed branch) · #11 must run: seed admin, add person, private-window set-password, sign in, role change, last-admin refusal, delete test user; check Vercel Deployment Protection on previews
2026-11-01 · #06 · decision · emails read via auth.admin.listUsers (profiles has no email column; avoided a DB change); invite link consumed on form submit via verifyOtp (scanner-safe); /set-password allowed through proxy; zod added; vitest tsconfigPaths on · spec gaps
2026-11-01 · #06 · note · docs/environments.md should note SUPABASE_SERVICE_ROLE_KEY is read by src/lib/supabase/admin.ts and People emails/Add person only work where set
2026-11-02 · #09 · done · owner ran the Desktop test ("can you make the sign-in button bigger?"): pass
2026-11-02 · #08 · done · verified actionlint clean, check/typecheck/test(72)/build; live PR acceptance (harmless migration, drop-table + label, merge to prod) deferred to #11 since workflows must be on main first · #10 unblocked
2026-11-02 · #08 · decision · GitHub Free private repo: branch protection, rulesets and auto-merge are plan-gated (403). Proceed with advisory checks: #10 deploy skill waits for `gh pr checks` green, then merges with `gh pr merge --squash --delete-branch` (no --auto, never --admin). Revisit with GitHub Pro (~$4/mo) at handover · D9 free-tier evaluation; logged in docs/debt.md
2026-11-02 · #08 · note · first merge to main runs migrate-prod: applies 20261101120000_profiles.sql to prod; watch the run. CI uses pinned devDependency supabase CLI, not setup-cli; fetch-depth 0 on checks/guard/migrate-dev
2026-11-02 · #10 · in-progress · delegating; live dry-run acceptance deferred to #11 (workflows must be on main)
2026-11-02 · #10 · done · 3 skills + launch.json written, pnpm check passes, no --auto/--admin in skills, consistent with workflow job names; live dry run moves to #11 · #11 unblocked after merge
2026-11-02 · #10 · decision · added deny rules for `git push` to main in .claude/settings.json · enforces PR flow without branch protection
2026-11-02 · #10 · note · OWNER DECISION: skills need extra allow entries in .claude/settings.json to avoid jargon permission prompts (gh api .../deployments*, curl -sI https://gq-projects-crm*, lsof -ti tcp:3000, kill *, sleep *). Not added by executor (permission config). Also Vercel Deployment Protection on Hobby may 401 preview links: Vercel > Settings > Deployment Protection
