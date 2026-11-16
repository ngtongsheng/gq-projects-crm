---
tier: standard
why: git state changes on her laptop; must never lose work
depends: [03]
---
# 04 Archive pre-parity work
## Goal
Old drafts made before the parity rewrite are kept as tags and taken out of the way, so `ship-queue` never tries to
rebase them and she never sees a conflict.
## Context
- Loop D6. Cut-off commit `3328d4e` (loop 11 plan, 2026-11-14). A local branch is pre-parity when it is not merged
  into `origin/main` and `git merge-base --is-ancestor 3328d4e <branch>` is false.
- Uncommitted changes in a pre-parity worktree: commit them first on that branch as `chore: save draft before
  archive` (no push), then tag. Nothing is deleted without a tag pointing at it.
- Tag `archive/pre-parity/<branch>` (slashes in branch names kept), pushed to origin (`git push origin <tag>` is
  allowed; tags are not main). Then `git worktree remove` (with `--force` only after the save commit) and
  `git branch -D`.
- `ship-queue` skill (`.claude/skills/ship-queue/SKILL.md`) must skip `archive/*` and anything not containing the
  cut-off; add one line there.
- Remote clean-up (executor, once, from the loop worktree): tag and delete origin branches
  `feat/database-for-preview`, `feat/database-for-preview2`, `chore/seed-fixed-password`, `loop/06-setup-rehearsal`
  (close PR #31 happens in #10, before deleting `feat/database-for-preview2`: do that branch in #10).
- Catch-up output when it archived something, one line: "Your older drafts from before the new app are saved; ask me
  if you want something from them."
## Files to touch
- `scripts/agent/archive-pre-parity.mjs` (exported step used by catch-up)
- `scripts/agent/archive-pre-parity.test.ts` (temp HOME and temp repos with a bare origin: pre-parity branch with a
  worktree and dirty file → tagged, saved, removed; post-parity branch untouched; merged branch untouched; rerun is a
  no-op)
- `scripts/agent/catch-up.mjs` (call it in the slot)
- `.claude/skills/ship-queue/SKILL.md` (skip rule)
## Steps
1. Implement and test in temp dirs only (AGENTS.md 21a).
2. Remote clean-up for the three branches named above.
## Acceptance
- `pnpm test scripts/agent/archive-pre-parity.test.ts scripts/agent/catch-up.test.ts`, `pnpm check`,
  `pnpm typecheck` pass.
- `git ls-remote --tags origin 'archive/pre-parity/*'` lists the three; `git branch -r` no longer shows them.
## Out of scope
Rebuilding any old feature. PR #31 and its branch (#10).
