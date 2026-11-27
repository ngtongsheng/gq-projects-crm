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
| 01 | Branch and allow rules | done | | economy |
| 02 | Patch/minor bumps and minimatch advisory | done | 01 | standard |
| 03 | Biome 2.4 to 2.6 | done | 02 | standard |
| 04 | pglite 0.6 and supabase CLI 3 | done | 03 | frontier |
| 05 | Audit A: delta deep review (loops 23-25) | done | 04 | frontier |
| 06 | Audit B: repo-wide sweep | done | 05 | frontier |
| 07 | Fix: dead code and duplication | done | 06 | frontier |
| 08 | Fix: comments and oversized files | done | 07 | standard |
| 09 | Fix: performance, robustness, error handling | done | 08 | frontier |
| 10 | Debt log, audit outcome, push branch | done | 09 | economy |
<!-- status: todo | in-progress | done | blocked: <reason> -->
## Owner actions
- After #10: push `loop/25-claims-marketing-samples`, then `loop/26-code-audit`, to `main` (or merge the PRs).
## Log
<!-- one line per event: YYYY-MM-DD · #NN · result · next -->
2026-11-27 · setup · worktree ../gq-projects-crm-loops/26-code-audit on loop/26-code-audit off loop/25 (D1); plan commit cherry-picked · #01
2026-11-27 · planner · tab w7:t1F answered YES, closed · #01
2026-11-27 · #01 · in-progress · delegated economy
2026-11-27 · #01 · done · ancestor check ok, 4 allow rules, pnpm check ok · #02
2026-11-27 · #02 · in-progress · delegated standard
2026-11-27 · #02 · decision · override `exceljs>uuid: 11.1.1` in pnpm-workspace.yaml for GHSA-w5hq-g745-h8pq · second advisory not in plan; exceljs only uses v4, tests pass. minimatch advisory cleared by shadcn 4.23.1, no override
2026-11-27 · #02 · decision · pin pglite to exact 0.5.14 · 0.5.17 hung createTestDatabase past 30s in ~7 supabase/tests files; #04 re-tests 0.6 and logs debt if it hangs too
2026-11-27 · #02 · done · audit clean, check/typecheck/build ok, 3327/3327 tests, outdated = expected 5 · #03
2026-11-27 · #03 · in-progress · delegated standard
2026-11-27 · #03 · decision · biome markdown formatter off · 2.6 formats .md by default (~350 docs/skill/loop files); keeps 2.4 behaviour, no churn in files Vicky's agents edit
2026-11-27 · #03 · decision · new earlierDate/laterDate in src/lib/format/date.ts for useMathMinMax (8 sites) · Math.min/max on ISO strings gives NaN; no rule disable
2026-11-27 · #03 · decision · noArrayIndexKey fixed with real db ids (handover_items.id, site_follow_ups.id added to selects + zod) · behaviour unchanged, no schema change
2026-11-27 · #03 · done · biome 2.6.9, check clean, typecheck/build ok, 3328/3328 tests, no new biome-ignore · #04
2026-11-27 · #04 · in-progress · delegated frontier
2026-11-27 · #04 · decision · pglite 0.6.0 (PostgreSQL 19), 0.5.17 hang not reproduced; supabase/tests 55 files ok in 58s under load
2026-11-27 · #04 · decision · supabase CLI stays ^2.122.1 (D4 revert) · checked v3.4.0 against: `link --project-ref` ok; `db push --yes` (checks, migrate-prod) BREAKS, v3 targets local unless `--remote`; `db push --db-url` (scripts/db-test-copy.ts) deprecated; `db dump --linked [--data-only]` (backup) deprecated, use `--remote`; `db query --linked` (health) BREAKS, needs `--yes`/`--read-only` unattended; `projects list` ok; `migration list` (allow-list) needs `--remote`. Items 2 and 5 provable only by real runs against the databases → debt for #10. `db push` checked from release notes only (help denied by permissions)
2026-11-27 · #04 · done · pglite 0.6.0, check/typecheck/build ok, 3328/3328 tests; CLI stays 2.x · #05
2026-11-27 · #05 · in-progress · delegated frontier
2026-11-27 · #05 · decision · A1 (silent 1000-row cap → export+Replace import deletes rows) retagged debt → fix: 09, first in rank · highest-ranked finding, no schema/UI change, identical below 1000 rows; D5 cap pushes lower 09 items to debt instead
2026-11-27 · #05 · done · section A: 19 findings with file:line + tags, no source changes, check ok · #06
2026-11-27 · #06 · in-progress · delegated frontier
2026-11-27 · #06 · decision · B6 (12 dead exported types) retagged debt → fix: 07, over the D5 cap · 07 acceptance needs knip clean of confirmed items; one-line deletes, zero behaviour risk
2026-11-27 · #06 · done · section B (B1-B9) + Dependencies table, no source changes, check ok · #07
2026-11-27 · #07 · in-progress · delegated frontier
2026-11-27 · #07 · done · A8 A11 A19 B1 B6 fixed in e0f8cef; check/typecheck/build ok, 3328/3328 tests, knip clear of report items · #08
2026-11-27 · #08 · in-progress · delegated standard
2026-11-27 · #08 · decision · plan types moved to new marketing-excel-plan.ts · avoids import cycle between sheet readers and marketing-excel-import.ts
2026-11-27 · #08 · done · A7 B3 fixed in 81e2819; check/typecheck/build ok, 3328/3328 tests · #09
2026-11-27 · #09 · in-progress · delegated frontier
2026-11-27 · #09 · decision · readAllRows runs the original query first, adds order("id") only past one page · keeps tie order below 1000 rows; loadEventCosts (dashboard only), allIds and installer-data paging left as is (cap) → debt
2026-11-27 · #09 · decision · A17 A3 A14 A15 A4 A10 → debt (09 cap) · D5 cap reached after A1 A18 A9
2026-11-27 · #09 · done · A1 A18 A9 fixed in fd1300e; check/typecheck/build ok, 3337/3337 tests · #10
2026-11-27 · #10 · in-progress · delegated economy
2026-11-27 · #10 · decision · corrected subagent's debt.md claim that `allIds` is unpaged · it pages by id (marketing-excel-store.ts:33-47); duplication only, no data-loss path
2026-11-27 · #10 · done · 10 debt sections + Loop 26 outcome (A 7 fixed/12 deferred, B 3 fixed/6 deferred), check ok · push
2026-11-27 · vault · ~/work/vault/sessions/gq-projects-crm/2026-11-27-loop-26-code-audit.md
2026-11-27 · merge · origin/main merged into loop/26 (plan commit 996a2e9; loop.md kept ours) so it fast-forwards onto main
