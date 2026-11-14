---
model: opus
effort: medium
why: Extends live leftover rows; allocations must not exceed balance
depends: []
---
# 09 Leftover migration + rules
## Goal
Per D5: new status, return method, transport (Lalamove / lorry, date, cost, delivered to), supplier, keep-why (+ who),
WhatsApp sent, supervisor collected audit, `sold` allocations, credit note (number, amount, who, when);
`suggestDest`/`keepWhyGuess` defaults as pure functions.
## Context
- `src/app/(app)/stock/leftover/`, `src/lib/domain/leftover.ts`.
## Acceptance
- `pnpm check`, `pnpm typecheck`, `pnpm test`, `pnpm guard:migrations` pass. Tests: existing rows unchanged; allocation over balance refused; defaults match demo.
