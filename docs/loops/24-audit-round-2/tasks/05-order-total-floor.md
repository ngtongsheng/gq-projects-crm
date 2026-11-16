---
tier: frontier
why: money invariant interacting with VO sync, payment cap and commission triggers
depends: []
---
# 05 Order total floor at payments received (D1)
## Goal
An order's `contract_sum + vo_amount` can never drop below the payments already received. Attempts get a plain
message and nothing changes.
## Context
Read `00-shared-context.md`. Decision D4. `cap_payments` (`20261105120000_cap_payments.sql`) guards payment INSERTs
only, locking the `mofs` row. `vo_amount` is maintained by triggers in `20261115210000_variation_orders.sql:197-247`,
so removing/lowering a VO can also lower the total: the floor must cover that path and its message must surface on
the VO screen too. Message: "The order total can't go below RM X already received." Formatted RM with 2 decimals,
matching how `cap_payments` builds its message so the app shows it as is. Use a dedicated SQLSTATE or the same one
`cap_payments` uses; find how the app maps that error and map the new one the same way (MOF save, VO actions).
## Files to touch
New migration (BEFORE UPDATE OF contract_sum, vo_amount ON mofs, SECURITY DEFINER, sums payments);
`supabase/tests/order-total-floor.test.ts`; the MOF save and VO action files that map DB errors; i18n dictionaries.
## Acceptance
- PGlite: lowering contract_sum below received raises; to exactly received succeeds; deleting a VO that would breach
  raises; raising works; orders with no payments unaffected.
- App test: the error maps to the plain message.
- `pnpm check && pnpm typecheck && pnpm test` pass.
## Out of scope
Existing orders already below received (the trigger only blocks further lowering; note any found in test data in Log).
