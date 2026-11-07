---
model: opus
effort: medium
why: Unstacking 6 squash-merged PRs with migrations onto main; conflict and migration-order judgment on live data
depends: [01, 02, 06]
---
# 11 Consolidate and ship PRs 21-31
## Goal
Everything Vicky built is live; her issues are closed with a plain summary (D8).
## Context
Open drafts (2026-11-07): chain `main <- 21 feat/company-rating <- 25 feat/people-new-link-sign-in-as <- 27
feat/simpler-mof-form <- 23 feat/mof-summary <- 29 feat/sales-performance`; `31 feat/database-for-preview2` on 27
(migrations-only workaround; 30 closed); `28 feat/team-dashboard-tiles` on main. Owner approved 21, 23, 25.
Help issues 22, 24, 26, 32. Guard fix (task 02) must be on main first. `migrate-prod` dumps prod first (task 02).
Debt: dev DB shared, migration history may mismatch (`supabase migration repair`).
## Files to touch
None in this repo directly; branches and PRs via git/gh.
## Steps
1. Inspect 31: if its migrations duplicate those in 27/23/29, close it with a comment; else fold them into the right PR.
2. Merge in order 21, 28, 25, 27, 23, 29. For each: rebase onto `origin/main` (`git rebase --onto origin/main <old
   base>`), `--force-with-lease` push, `gh pr edit --base main`, `gh pr ready`, wait for green checks, squash merge,
   watch `migrate-prod`, check the Vercel status (deploy skill section 4).
3. Migration timestamps must stay in order after rebase; rename a file only if it sorts before an already-applied one.
4. Close issues 22, 24, 26, 32 with one plain line each (what is live; 32: answered by Sign in as + test-sign-ins).
5. If prod migration fails: stop, mark loop blocked, open `Urgent:` issue.
## Acceptance
- `gh pr list --author vicky-gq --state open` empty.
- `gh run list --workflow migrate-prod.yml --limit 6` all success; `curl -sI https://gq-projects-crm.vercel.app` 200/redirect.
- `pnpm exec supabase migration list` (prod linked in CI log) shows the new migrations.
## Out of scope
Trying Sign in as on live (owner action).
