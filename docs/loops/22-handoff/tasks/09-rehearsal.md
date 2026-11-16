---
tier: frontier
why: end-to-end simulation of her first session from an old state; finds and fixes gaps across scripts
depends: [04, 05, 06]
---
# 09 Rehearsal on a fresh clone
## Goal
Prove that from her plausible laptop states, the bootstrap issue plus one Claude session leaves a working laptop app
with 17 test people, and fix every gap found.
## Context
- Loop D5. Her laptop is at an unknown `main`: her old hook pulls main every session, so either an old commit (oldest
  plausible: loop 10 merge `a8ddcaa`, 2026-11-08) or recent main. She may have a pre-parity worktree with unsaved
  work, and may lack `.env.local`.
- Old hook behaviour: `git show a8ddcaa:scripts/agent/session-sync.mjs` (pulls when clean, prints "Rules updated:
  re-read CLAUDE.md" when CLAUDE.md or `.claude/` changed, injects `for:vicky-claude` issues).
- The bootstrap issue text is drafted here (`assets/bootstrap-issue.md`) and opened in #10. It tells her Claude:
  in the main folder, not a worktree, `git pull --ff-only` on `main`, re-read CLAUDE.md, run `pnpm catch-up`, relay
  its line and what's new, close the issue with a one-line comment. No build/deploy.
- Simulate in temp dirs only (AGENTS.md 21a): `git clone` the repo into the scratch dir, checkout state, no
  `.env.local`; use the owner's gh (has access to `gq-dev-private`, standing in for her accepted invite). Do not touch
  the real checkout's stamp.
## Scenarios
1. Old commit `a8ddcaa`, clean, no `.env.local`, plus a worktree on a pre-parity branch with an uncommitted file →
   run the loop branch's flow (pull the loop branch instead of main) → catch-up → `pnpm dev` → Sign in as panel lists
   17 people; sign in as Vicky and as an installer; tag `archive/pre-parity/*` exists locally with the saved file.
2. Recent main, already has `.env.local` → catch-up silent after first run.
3. Second session immediately after → no output.
4. Keys missing from `gq-dev-private` (simulate by pointing at a wrong path) → plain failure line, exit 1, playbook
   entry leads to connect-test-copy.
## Files to touch
- `docs/loops/22-handoff/assets/bootstrap-issue.md`, `docs/loops/22-handoff/reports/rehearsal.md`
- Fixes in scripts from #03-#05 as found (≤ 5 files; more → log and park)
## Acceptance
- Report lists each scenario with pass/fail and what was fixed; all pass.
- `pnpm check`, `pnpm typecheck`, `pnpm test` pass after fixes.
## Out of scope
Opening the issue (#10). Windows run (log as untested in `docs/debt.md` if not already).
