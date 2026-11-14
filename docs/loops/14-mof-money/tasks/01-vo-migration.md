---
model: opus
effort: medium
why: Backfill plus trigger on a money column read by commission and RLS SQL
depends: []
---
# 01 VO migration
## Goal
`mof_variation_orders` (no, client ref, confirmed date, signed amount, description, qty, cost, needs_work) with RLS,
backfill per D1, trigger keeping `mofs.vo_amount` = sum, VO cost included in MOF cost.
## Context
- `docs/office-parity/drift-money-reports.md` "MOF Register" VO bullet; demo `sheetVO`, `p.vos[]`.
- `vo_amount` is read in `20261105130000_cap_commission_payouts.sql` and `20261114140000_team_scoping_money.sql`;
  `save_mof` RPC in `20261105100000_save_mof.sql` writes it: stop writing it there.
- MOF cost: `mof_costs`, `src/lib/domain/mof-totals.ts`.
## Files to touch
- `supabase/migrations/<ts>_variation_orders.sql` (new), `supabase/tests/variation-orders.test.ts` (new)
- `src/lib/domain/mof-totals.ts` (+ test), generated DB types
## Acceptance
- `pnpm check`, `pnpm typecheck`, `pnpm test`, `pnpm guard:migrations` pass. Tests: backfill keeps every MOF total;
  trigger updates on insert/update/delete; RLS matches `mofs`.
