---
model: sonnet
effort: high
why: Git automation over her PRs and worktrees; must never lose work
depends: [06]
---
# 08 Ship-queue skill
## Goal
At session start (after session-sync), her agent tidies her changes without her: merges what she approved and is
green, rebases the rest on `main`, closes superseded PRs, removes merged worktrees, reports one plain line (D6).
## Context
Read loop.md D4-D6. Deploy skill `.claude/skills/deploy/SKILL.md` (after task 06) does a single merge; reuse it.
Squash merges make merged branches look unmerged to git; trust `gh pr view --json state`.
## Files to touch
New `.claude/skills/ship-queue/SKILL.md`, `CLAUDE.md` (call it at session start), `.claude/settings.json` allows if
needed.
## Steps
1. `gh pr list --author @me --state open --json number,headRefName,baseRefName,isDraft,mergeable,statusCheckRollup`.
2. Base not `main` → rebase head onto `origin/main` (`git rebase --onto`), push with `--force-with-lease` to the change
   branch only (never main; update the deny rules to allow lease pushes to non-main branches if blocked), retarget
   `gh pr edit --base main`.
3. Approved (a PR comment marker the deploy skill writes when she said "looks right") and green → deploy step 3-5.
4. Conflicts or failing checks → fix once in a worktree; still failing → leave it, mention in the report.
5. Worktrees under `.claude/worktrees/` whose PR is merged or closed and that have no uncommitted changes → remove.
6. Report to her one line: what went live, what is waiting on her, what is being fixed.
## Acceptance
- Dry-run mode (`--dry-run` described in the skill: print planned actions only) on the current repo lists the PR
  21-31 chain correctly (run before task 11 merges them).
- Fresh subagent following the skill on a throwaway PR pair (stack B on A, merge A) rebases B onto main.
## Out of scope
Consolidating the current backlog (task 11).
