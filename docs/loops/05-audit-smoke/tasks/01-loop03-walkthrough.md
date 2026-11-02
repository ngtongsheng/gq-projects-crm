---
model: sonnet
effort: high
why: end-to-end browser walk-through across 7 roles; reuses loop 03's task spec
depends: []
---
# 01 Run loop 03 #35 walk-through + Vicky checklist
## Goal
Loop 03 task 35 is done exactly as its task file says, and loop 03's `loop.md` shows it.
## Context
- Precondition: `.env.smoke.local` exists in the main repo root (owner action). Missing → mark this task
  `blocked: owner: .env.smoke.local` and stop the loop.
- Loop 05 D6 overrides #35's "each fix in its own small PR": fixes are commits on `loop/05-audit-smoke`, and #35's
  step "merged per conventions Done" is satisfied by the loop 05 PR.
- Browser and sign-in method: `docs/loops/05-audit-smoke/assets/smoke-method.md` (first four bullets).
- Loop 03 `loop.md` Tasks table on main still says `todo` for #01-#34 although its Log shows them done; set them to `done`.
## Files to touch
- docs/loops/03-crm-features/tasks/35-*.md (read only), docs/loops/03-crm-features/assets/walkthrough.md
- docs/loops/03-crm-features/loop.md (status + log), docs/debt.md, fixes as needed
- docs/loops/05-audit-smoke/findings.md (one row per fix, task `01`)
## Steps
1. Read and follow `docs/loops/03-crm-features/tasks/35-*.md`.
2. Record each fix in loop 05 `findings.md`.
3. Update loop 03 `loop.md`: Tasks #01-#35 `done`, a Log line for #35.
## Acceptance
- `docs/loops/03-crm-features/assets/walkthrough.md` exists with per-role pass/fail and Vicky's plain checklist.
- `pnpm check && pnpm typecheck && pnpm test` pass.
- `grep -c '| todo |' docs/loops/03-crm-features/loop.md` prints 0.
## Out of scope
Vicky's review itself; the audit (#02-#09).
