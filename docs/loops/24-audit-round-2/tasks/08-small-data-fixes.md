---
tier: standard
why: three contained fixes, one migration, clear expected behaviour
depends: []
---
# 08 Small data fixes (D6, D7, D4)
## Goal
Dates default to the Malaysian day, receipt numbers never collide, and a re-used archived mobile gives a clear message.
## Context
Read `00-shared-context.md`. Decision D7.
- D6: `tasks.assigned_on` (`20261115143000_tasks.sql:29`) and costing `enquiry_date`
  (`20261115120000_costing.sql:162`) default to UTC day. New default:
  `(now() at time zone 'Asia/Kuala_Lumpur')::date`. Check for an existing MYT date helper in migrations first.
- D7: receipt numbering `20261119100000_monthly_claims.sql:385-391` uses `max(receipt_no)+1` without lock. Lock the
  parent claim row `for update` before reading max (redefine the function).
- D4: creating/updating a contact whose mobile matches an archived contact hits raw 23505. In
  `src/app/(app)/customers/actions.ts` (duplicate check ~line 181) look up the holder including archived and return
  "This number belongs to archived contact <name>. Restore them instead of adding a new one." If no restore action
  exists, say "Ask an admin to restore them." Add i18n keys.
## Files to touch
One new migration; a PGlite test; `customers/actions.ts` + its test; dictionaries.
## Acceptance
- PGlite: default date at 00:30 MYT (16:30 UTC prior day) is the MYT date; the receipt function takes the claim row
  lock (concurrent inserts get distinct numbers).
- Action test: archived-holder message returned.
- `pnpm check && pnpm typecheck && pnpm test` pass.
## Out of scope
D8, D9, other UTC defaults not named here (note any found in Log).
