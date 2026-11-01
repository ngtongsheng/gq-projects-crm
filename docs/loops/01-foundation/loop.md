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
| D4 | Every change: branch + PR. On "Yes, deploy", Claude enables auto-merge; merges when checks pass; Claude watches the prod deploy and reports | Self-service; owner still sees PRs | Owner approves each deploy |
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
| 02 | Desktop spike checklist | blocked: owner — run docs/desktop-findings.md in Claude Desktop | 01 | haiku/low |
| 03 | Cloud setup (Supabase, Vercel, secrets) | blocked: owner — import repo at vercel.com/new and confirm the emailed code (Vercel reauth); then re-run /execute-loop | 01 | sonnet/high |
| 04 | Design system + app shell | done | 01 | sonnet/high |
| 05 | Auth, profiles, roles, RLS | in-progress | 03, 04 | opus/medium |
| 06 | People admin + invite link | todo | 05 | sonnet/high |
| 07 | Destructive-migration guard | done | 01 | sonnet/high |
| 08 | CI workflows | todo | 03, 07 | sonnet/high |
| 09 | Agent rules + plain output style | todo | 02 | opus/medium |
| 10 | Skills: preview, deploy, get-help | todo | 08, 09 | opus/medium |
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
