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
| 03 | Cloud setup (Supabase, Vercel, secrets) | blocked: owner — allow `gh secret set` (permission rule or run it yourself), then re-run /execute-loop | 01 | sonnet/high |
| 04 | Design system + app shell | todo | 01 | sonnet/high |
| 05 | Auth, profiles, roles, RLS | todo | 03, 04 | opus/medium |
| 06 | People admin + invite link | todo | 05 | sonnet/high |
| 07 | Destructive-migration guard | todo | 01 | sonnet/high |
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
