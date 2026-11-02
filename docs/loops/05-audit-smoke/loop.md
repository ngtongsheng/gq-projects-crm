# Loop 05: Code audit + smoke test
Orchestrator: opus/medium
## Goal
Loop 03 #35 walk-through is done first. Then every file in `src/` and `supabase/migrations/` is audited against the
project rules and fixed, and every module is smoke tested on localhost (test copy) against Vicky's prototype
`docs/mockup/gq-crm-mockup.html`, with every gap fixed. Findings and results are in `findings.md`; the loop PR is merged.
## Decisions
| ID | Decision | Why | Rejected |
|---|---|---|---|
| D1 | Loop 03 #35 (role walk-through + Vicky checklist) runs first, as task 01 | Owner choice; audit and smoke build on its results | Absorbing #35 into this loop |
| D2 | Sign-ins come from gitignored `.env.smoke.local`, written by the owner after re-running `pnpm seed:example` | Seed prints passwords once; dev key file was deleted | Owner signing in per role; new reset script |
| D3 | Fix everything found, including larger refactors; cross-module fixes collected for #09 | Owner choice | Report only; fix small/log big |
| D4 | A fix needing a drop/rename/retype/delete migration goes on its own branch + PR, task `blocked: owner-approved label`, listed under Owner actions | Migration guard; the label is Tong Sheng's alone | Additive workarounds only |
| D5 | Smoke test is a manual Claude in Chrome run on `pnpm dev` (test copy), results written down | Lean; no new dependency or CI auth | Playwright e2e |
| D6 | One branch `loop/05-audit-smoke` in a worktree, one commit per fix, one PR; merge pre-approved once local checks and PR checks are green. If auto mode denies `gh pr merge`, park the merge as an owner action | Loop 03 log: auto mode denied `gh pr merge` as a production deploy; stacking per-task PRs on unmerged ones is messy | Per-task PRs merged one by one |
| D7 | Audit rules: `assets/audit-checklist.md` (distilled from `~/.agents/AGENTS.md`, `CLAUDE.md`, loop 03 conventions) | One checklist keeps the audits consistent | Each task rereading all rule files |
| D8 | Admin-only server features (adding people) are out of the local smoke test by design | CLAUDE.md: "can't be tried on your laptop" | Testing on the live app |
## Tasks
| # | Task | Status | Depends | Model/Effort |
|---|---|---|---|---|
| 01 | Run loop 03 #35 walk-through + Vicky checklist | done | owner: .env.smoke.local | sonnet/high |
| 02 | Audit + fix: migrations and RLS | done | 01 | opus/medium |
| 03 | Audit + fix: lib and proxy | done | 01 | opus/medium |
| 04 | Audit + fix: MOFs | done | 02, 03 | sonnet/high |
| 05 | Audit + fix: stock, collection, commission | done | 02, 03 | sonnet/high |
| 06 | Audit + fix: customers, activities, calendar, projects, people | done | 02, 03 | sonnet/high |
| 07 | Audit + fix: installation, site work, overtime | done | 02, 03 | sonnet/high |
| 08 | Audit + fix: reports, dashboard, shared components, auth, guide, dev | in-progress | 02, 03 | sonnet/high |
| 09 | Cross-module fixes from findings | todo | 04, 05, 06, 07, 08 | opus/medium |
| 10 | Smoke test vs prototype: sales side | todo | 09 | sonnet/high |
| 11 | Smoke test vs prototype: operations side + summary | todo | 10 | sonnet/high |
<!-- status: todo | in-progress | done | blocked: <reason> -->
## Owner actions
- Before #01: create `.env.seed.dev` (test copy only), run `pnpm seed:example`, and write the printed sign-ins to
  `.env.smoke.local` in the repo root as `SMOKE_<JOBROLE>_EMAIL=` / `SMOKE_<JOBROLE>_PASSWORD=` (md, director, bd,
  sales, accounts, site, support). Delete `.env.seed.dev` afterwards. The executor copies `.env.smoke.local` into its worktree.
- Any task blocked per D4: review the PR and add the `owner-approved` label.
- End: if auto mode denies the merge (D6), merge the loop PR yourself.
## Log
<!-- one line per event: YYYY-MM-DD · #NN · result · next -->
2026-11-02 · plan · loop written (11 tasks) · /execute-loop
2026-11-02 · #01 · blocked: owner: .env.smoke.local missing in main repo root; task spec says stop the loop · owner writes it, then /execute-loop
2026-11-02 · #02-#11 · waiting: all depend on #01 · resume after #01
2026-11-02 · vault · ~/work/vault/sessions/gq-projects-crm/2026-11-02-loop-05-audit-smoke.md
2026-11-02 · #01 · done: loop 03 #35 completed and merged by owner (PR #16, d02e658) · #02
2026-11-02 · #02 · in-progress · subagent opus/medium
2026-11-02 · #02 · decision · no in-repo SQL regression test; verified on scratch PGlite, gap logged in debt.md · new dev dependency not in plan
2026-11-02 · #02 · done: 2 additive migrations (account type guard a45d275, guard fn revokes 593fe28); checks + 742 tests pass · #03
2026-11-02 · #03 · in-progress · subagent opus/medium
2026-11-02 · #03 · decision · new src/lib/format/quantity.ts for shared 2dp rounding; env.ts kept as plain presence check · no shared helper existed; two plain strings
2026-11-02 · #03 · done: 6 findings, 4 fixed (abeb511 a5158fd 5c1610c 444bf53), rows 7-8 to #09; 745 tests pass · #04
2026-11-02 · #04 · in-progress · subagent sonnet/high
2026-11-02 · #04 · decision · row 13 (installer claim cap app-only) moved from debt to #09 as an additive trigger · D3 fix everything; permission rules belong in the database
2026-11-02 · #04 · done: rows 10-14, fixed 5696060 9a643b7, row 12-13 to #09, row 14 debt; 746 tests pass · #05
2026-11-02 · #05 · in-progress · subagent sonnet/high
2026-11-02 · #05 · decision · commission payout cap stays app-only (debt row 20), stock/actions.ts not split · loop 03 #26 decision; SQL copy would drift; actions.ts is one concern
2026-11-02 · #05 · done: rows 15-23, fixed 202066c 7184498 60e4a48, rows 18-19 21-23 to #09; 754 tests pass · #06
2026-11-02 · #06 · in-progress · subagent sonnet/high
2026-11-02 · #06 · decision · row 31 (company saved before contact) stays debt like row 14; project value capped at the DB column max · partial-write, not a permission rule; matches DB
2026-11-02 · #06 · done: rows 24-33, fixed 8e8ff2a..76701f7 (7 commits), rows 32-33 to #09; 758 tests pass · #07
2026-11-02 · #07 · in-progress · subagent sonnet/high
2026-11-02 · #07 · done: rows 34-37, rows 34-35 fixed in 6091308, rows 36-37 to #09; 759 tests pass · #08
2026-11-02 · #08 · in-progress · subagent sonnet/high
