---
model: opus
effort: medium
why: Backfill plus trigger on a column loop 14 Performance reads; must not change any current number
depends: [01]
---
# 05 Per-year targets migration
## Goal
Per D3: per-year targets table with RLS (md, director, accounts write; the person and their team lead read),
backfill current year from `profiles.yearly_target`, effective-target resolution (row, else grade), trigger keeping
`yearly_target` in sync.
## Context
- Readers of `yearly_target`: grep `supabase/migrations` and `src/lib/domain/sales-performance.ts`.
## Files to touch
- `supabase/migrations/<ts>_yearly_targets.sql` (new), `supabase/tests/yearly-targets.test.ts` (new),
  `src/lib/domain/sales-target.ts` (+ test), generated DB types
## Acceptance
- `pnpm check`, `pnpm typecheck`, `pnpm test`, `pnpm guard:migrations` pass. Tests: backfill keeps every current
  target; grade fallback; trigger on insert/update/delete and grade change.
