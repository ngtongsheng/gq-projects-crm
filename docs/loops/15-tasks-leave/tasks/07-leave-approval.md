---
model: opus
effort: medium
why: Multi-step approval chain by role with server-side enforcement
depends: [05]
---
# 07 Leave approval + slip rules
## Goal
Domain module + server actions: apply, cancel, approve, reject. Chain per D4 (sales: team lead then md; bd/site:
director then md; others: md; md: director). MC and hospitalisation need a slip upload before approval, and the
"original given to HR" tick by accounts.
## Files to touch
- `src/lib/domain/leave-approval.ts` (+ test), leave server actions under `/leave`
## Acceptance
- `pnpm check`, `pnpm typecheck`, `pnpm test` pass. Tests: each chain, own-leave refused, missing slip refused,
  rejected stops the chain.
