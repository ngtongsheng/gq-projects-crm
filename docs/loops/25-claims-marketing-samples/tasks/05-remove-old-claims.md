---
tier: frontier
why: drops money tables with storage policies and removes a 6k-line feature without breaking Commission or Overtime
depends: [04]
---
# 05 Remove the old monthly claim
## Goal
Nothing of the old monthly claim remains: tables, functions, triggers, storage policies, settings keys, code, tests.
Commission, Overtime and Reports still work.
## Context
Read `00-shared-context.md`. Decisions D1, D2, D7. Old migrations: `20261119100000_monthly_claims.sql`,
`20261119110000_monthly_claim_steps.sql`, `20261120100000_claim_people.sql`, parts of `20261120170000` and
`20261120180000`. Old code: most of `src/app/(app)/claims/` (keep what 03/04 created), `src/lib/domain/claim-flow.ts`,
the `claims` storage area in `src/lib/storage/`. `commission_appeals` and the Commission page's appeal UI stay (D2).
`ot_claims` and the Overtime page stay.
## Files to touch
New migration; old claims files (delete); `src/lib/storage/` area list; tests referencing old claims; i18n keys no
longer used.
## Steps
1. Migration: drop old claim tables, functions, triggers, storage policies for the `claims` area. Existing files in
   the bucket are left; log in `docs/debt.md` (remove by hand later, needs Tong Sheng).
2. Delete old code; grep for `monthly_claim`, `claim-flow`, `appeals-tab`, `claim-settings` until clean.
3. `pnpm guard:migrations` will flag the drop: expected; note it in the loop log for the owner's
   `data-loss-approved` label.
## Acceptance
- `grep -rn "monthly_claim" src supabase/tests` empty; PGlite suite runs all migrations from scratch.
- `pnpm check && pnpm typecheck && pnpm test` pass; in `pnpm dev` Commission and Overtime pages load.
## Out of scope
Commission self-claim; deleting stored receipt files.
