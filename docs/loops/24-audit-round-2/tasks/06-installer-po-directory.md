---
tier: frontier
why: data migration with abort guard plus a form change on a money record
depends: []
---
# 06 Link installer POs to the installer directory (D2)
## Goal
Each installer PO points at one installer in the directory, so one MOF cannot hold two POs for the same installer
under different spellings.
## Context
Read `00-shared-context.md`. Decision D5. `installer_pos.installer` is free text with `unique (mof_id, installer)`
(`20261102210000_installer_claims.sql:13,19`). The directory `public.installers` (`20261118100000_installers.sql`)
has `name_key = lower(regexp_replace(name, '\s+', ' ', 'g'))` and already backfilled names from installer_pos;
jobs got `installer_id` the same way, copy that pattern.
Migration: add `installer_id uuid references installers(id)`; insert any missing directory names; backfill via
name_key; if any `(mof_id, installer_id)` repeats, `raise exception` listing mof id, PO nos and names (no merge);
set not null; add unique `(mof_id, installer_id)`; keep the `installer` text column for now, written from the
directory name by trigger or the action (decide, log it). Grant column insert/update per existing grants.
Form: `src/app/(app)/mofs/installer-actions.ts:39` takes `installer` text; switch to `installerId` validated as uuid
and pick from the directory with the existing installer picker used by jobs (find it; reuse, don't copy).
## Files to touch
New migration; `supabase/tests/installer-po-directory.test.ts`; `mofs/installer-actions.ts` + its test; the PO form
component; i18n if a new string.
## Acceptance
- PGlite: backfill links rows; duplicate spellings on one MOF make the migration raise with the names; second PO
  for the same installer on one MOF is rejected.
- `pnpm check && pnpm typecheck && pnpm test` pass; PO form shows the picker (`pnpm dev`, look at an MOF).
## Out of scope
Dropping the `installer` text column (needs data-loss approval), D3 rename sync.
