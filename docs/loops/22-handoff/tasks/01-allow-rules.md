---
tier: economy
why: two JSON allow rules, no logic
depends: []
---
# 01 Allow rules
## Goal
Vicky's agent can run `pnpm catch-up` without a prompt; the executor can run the auth config workflow.
## Context
Loop D13. Repo settings are what her Claude Desktop reads. The executor runs in auto mode on the owner's machine.
## Files to touch
- `.claude/settings.json` (add `"Bash(pnpm catch-up)"` and `"Bash(pnpm catch-up *)"` to `permissions.allow`, next to
  `pnpm copy-env`)
- `~/.claude/settings.json` (owner's global, add `"Bash(gh workflow run auth-config.yml*)"` to `permissions.allow`;
  read it first, keep everything else)
## Steps
1. Add the rules; keep JSON valid and the existing order style.
## Acceptance
- `node -e 'JSON.parse(require("fs").readFileSync(".claude/settings.json","utf8"))'` exits 0; same for the global file.
- `pnpm check` passes.
## Out of scope
Any other permission change.
