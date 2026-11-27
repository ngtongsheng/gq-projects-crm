---
tier: economy
why: mechanical branch setup and a config edit
depends: []
---
# 01 Branch and allow rules
## Goal
`loop/26-code-audit` exists off `loop/25-claims-marketing-samples`; agents can run the dependency and audit tools.
## Context
Read `00-shared-context.md`. D1, D5, D6 in `loop.md`.
## Files to touch
`.claude/settings.json`
## Steps
1. Create worktree and branch `loop/26-code-audit` from `loop/25-claims-marketing-samples` (not `main`).
2. Add to `permissions.allow`: `Bash(pnpm add *)`, `Bash(pnpm update *)`, `Bash(pnpm dlx knip*)`,
   `Bash(pnpm dlx jscpd*)`. Keep every deny rule.
3. Commit `chore: allow dependency and audit tools for agents`.
## Acceptance
- `git merge-base --is-ancestor loop/25-claims-marketing-samples loop/26-code-audit` exits 0.
- `jq '.permissions.allow' .claude/settings.json` lists the 4 rules. `pnpm check` passes.
## Out of scope
Any dependency change.
