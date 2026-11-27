---
tier: economy
why: mechanical swap of console.error calls for the existing logger, same pattern in every file
depends: []
---
# 04 Money-path writes onto logServerError (B8)
## Goal
Every raw `console.error` in the MOF and costing money writes uses `logServerError` with the user and record id.
## Context
Read `00-shared-context.md`. Audit row B8. Pick the context ids that the function already has in scope (MOF id, PO
id, claim id, user id). Do not add queries to get them.
## Files to touch
- `src/app/(app)/mofs/installer-actions.ts`, `src/app/(app)/mofs/supplier-po-actions.ts`,
  `src/app/(app)/mofs/[id]/vo-actions.ts`, `src/app/(app)/mofs/actions.ts`, `src/app/(app)/mofs/change-stage.ts`
- `src/app/(app)/costing/[id]/approval-actions.ts`, `src/app/(app)/costing/use-as-project-value-action.ts`
(seven files, one-line swaps each)
## Steps
1. Per call: `console.error("msg", error)` → `logServerError("msg", error, { ...ids in scope })`. Keep the message
   text and the return value unchanged.
2. If a test asserts on `console.error` output for these files, update the assertion to the new JSON line.
## Acceptance
- `grep -n "console.error" <the seven files>` returns nothing.
- `pnpm check && pnpm typecheck && pnpm test && pnpm build` pass.
## Out of scope
Other `console.error` callers (debt O4).
