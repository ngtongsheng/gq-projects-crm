# Loop 26: Code audit round 3
Orchestrator: frontier
## Goal
Audit the CRM for clean code: no dead code, no duplication, no noise comments, sound error handling, good
performance, current dependencies. Findings live in `docs/audits/2026-11-27-code-audit-round-3.md`. Done: safe
fixes and dependency upgrades are on `loop/26-code-audit` (branched off `loop/25-claims-marketing-samples`), all
checks pass, the branch is pushed, every other finding is in `docs/debt.md`. Owner pushes 25 and 26 to `main`.
## Decisions
| ID | Decision | Why | Rejected |
|---|---|---|---|
| D1 | Branch `loop/26-code-audit` off `loop/25-claims-marketing-samples`; owner pushes both to `main` | Loop 25 (+24k lines) is done but unmerged; auditing `main` misses it and conflicts later. Agents are denied pushing `main` | Audit `main`; wait for owner push |
| D2 | Scope: deep review of code changed since `132f454` (loops 23-25), plus a repo-wide sweep for dead code, duplication, comments, oversized files, error handling | Rounds 1-2 (2026-11-16) already covered perf, bugs, security, reuse across the repo | Full re-audit (~3x tokens) |
| D3 | Fix only behavior-preserving changes. Anything changing behavior, schema, migrations, RLS, public routes or UI goes to `docs/debt.md` | Live business app; Vicky's team uses it daily | Fix everything; report only |
| D4 | Deps: patches/minors and the minimatch advisory (GHSA-g3hv-75wg-m249) fix; biome 2.4 to 2.6; pglite 0.5 to 0.6; supabase CLI 2 to 3 only if every workflow/script command still works, else revert and log. `@types/node` stays `^24` (Node 24 in `mise.toml`). TypeScript 7 deferred to debt.md | Majors proven by checks; TS7 is its own migration | Everything incl. TS7; patches only |
| D5 | Fix tasks cap at ~8 files each: take findings in rank order, log the rest in debt.md | Keeps each task one session | Unbounded fix tasks |
| D6 | No new runtime or dev dependency; knip and jscpd run once via `pnpm dlx` | Rule 13; audit tools aren't needed after | Add them as devDependencies |
| Preflight | `pnpm add`/`update`/`dlx knip`/`dlx jscpd` → allow rules (#01). Push to `main` → owner (denied for agents). No secret reads, no sign-in | | |
## Tasks
| # | Task | Status | Depends | Tier |
|---|---|---|---|---|
| 01 | Branch and allow rules | todo | | economy |
| 02 | Patch/minor bumps and minimatch advisory | todo | 01 | standard |
| 03 | Biome 2.4 to 2.6 | todo | 02 | standard |
| 04 | pglite 0.6 and supabase CLI 3 | todo | 03 | frontier |
| 05 | Audit A: delta deep review (loops 23-25) | todo | 04 | frontier |
| 06 | Audit B: repo-wide sweep | todo | 05 | frontier |
| 07 | Fix: dead code and duplication | todo | 06 | frontier |
| 08 | Fix: comments and oversized files | todo | 07 | standard |
| 09 | Fix: performance, robustness, error handling | todo | 08 | frontier |
| 10 | Debt log, audit outcome, push branch | todo | 09 | economy |
<!-- status: todo | in-progress | done | blocked: <reason> -->
## Owner actions
- After #10: push `loop/25-claims-marketing-samples`, then `loop/26-code-audit`, to `main` (or merge the PRs).
## Log
<!-- one line per event: YYYY-MM-DD · #NN · result · next -->
