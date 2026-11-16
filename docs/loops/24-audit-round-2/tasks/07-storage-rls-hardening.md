---
tier: frontier
why: security policy judgment across storage and two tables; must not lock out legitimate uploads
depends: []
---
# 07 Storage and RLS hardening (S-DB1, S-DB2, S-DB3)
## Goal
A person can only upload into an attachment folder of a record they may change; people who have left cannot touch
weekly reports or activity invitations.
## Context
Read `00-shared-context.md`.
- S-DB1: storage insert policy `20261114160000_storage_attachments.sql:19-28` checks owner, path shape and
  is_active, not the record. Folders are `<area>/<record-uuid>/<file>` (e.g. `claims/`, `leave/`; grep `src` for
  every upload area prefix). Add a SECURITY DEFINER `public.can_attach(area text, record_id uuid)` returning whether
  the caller may change that record (mirror each area's existing update/insert rule; unknown area = false), and
  replace the insert policy to require it. Drop + recreate the policy in the new migration.
- S-DB2: `weekly_reports` (`20261115130000_sales_calendar.sql:361-374`) and S-DB3 `activity_invitees` (`:235-252`)
  lack the restrictive "left people: no access" policy. Add it, same text as other tables.
## Files to touch
New migration; `supabase/tests/storage-attach-permission.test.ts` (or extend the existing storage test);
a `supabase/tests/` test for left people on the two tables.
## Acceptance
- PGlite: owner uploads to own claim folder ok; another staff to someone else's claim folder rejected; same for
  leave and every other area found; a left salesperson cannot insert/select weekly reports or update invitations.
- `pnpm check && pnpm typecheck && pnpm test` pass.
## Out of scope
S-DB4 (key rename), read-side signed URLs.
