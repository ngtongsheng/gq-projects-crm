---
model: haiku
effort: low
why: Removing one skill and updating references
depends: [05]
---
# 06 Retire the test sign-ins step
## Goal
Vicky's agent points her to the floating panel instead of handing out test passwords.
## Context
Decision D9. Keep `pnpm reset:sign-ins`: it creates the test users the panel needs.
## Files to touch
- `.claude/skills/test-sign-ins/SKILL.md` (delete)
- `.claude/skills/preview/SKILL.md`
- Any other file `git grep -n "test-sign-ins"` lists, except `docs/loops/`
## Steps
1. Delete the skill.
2. In the preview skill, replace the reference: to see another job role, she uses the floating panel at the bottom of the page. If the panel says the test sign-ins need setting up and her laptop is connected, run `pnpm reset:sign-ins` and do not show its output.
3. Update the remaining references.
## Acceptance
`git grep -n "test-sign-ins" -- ':!docs/loops'` prints nothing. `pnpm check` passes.
## Out of scope
Changing `pnpm reset:sign-ins`.
