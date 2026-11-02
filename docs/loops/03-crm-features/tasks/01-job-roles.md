---
model: opus
effort: medium
why: permission architecture every later RLS policy depends on
depends: []
---
# 01 Job roles + per-person settings
## Goal
Each person has a job role and per-person settings, stored in the database, editable by admins on the People screen, with SQL helpers later policies use.
## Context
- Read `docs/loops/03-crm-features/assets/conventions.md` first; it applies in full.
- Spec: `docs/loops/03-crm-features/assets/prototype-spec.md`.
- Prototype anchors (grep): `role()`, `PEOPLE`, `isMgr`, `canReg`, `canSite`, `canStock`
- Decisions: see `docs/loops/03-crm-features/loop.md` (D1-D12).
## Files to touch
- supabase/migrations/<ts>_job_roles.sql
- src/lib/auth/job-role.ts (+ test)
- src/lib/auth/current-profile.ts
- src/app/(app)/people/* (job role select + settings)
## Steps
1. Migration: add to `profiles` `job_role text not null default 'sales' check (in md, director, bd, sales, accounts, site, support)`, `arranges_stock boolean not null default false`, `commission_mode text not null default 'standard' check (in standard, excluded, flat_pass_down)`, `yearly_target numeric(14,2)`. Grant update on the new columns to authenticated (admin policy already limits updates).
2. SQL helpers (security definer, `set search_path = ''`, like `is_admin`): `public.job_role()` returns the caller's job role; `public.has_job_role(variadic text[])`; `public.is_manager()` = md, director or accounts. Revoke from public/anon, grant to authenticated.
3. `src/lib/auth/job-role.ts`: zod enum `JobRole`, `JobRoleLabel` map (MD, Sales Director, BD Director, Sales, HR & Accounts, Site Supervisor, Purchasing), and pure capability functions mirroring the prototype: `isManager`, `canEditRegister`, `canEditSite`, `canEditStock(profile)`, `canEnterPayments`, `isReadOnly`. Extend `current-profile.ts` to return the new fields.
4. People screen: job role select, 'arranges stock' toggle, commission mode select, yearly target input, admin-only through the existing action pattern with zod validation.
## Acceptance
- Tests: capability functions for every job role; people action rejects staff and invalid values.
- `pnpm check && pnpm typecheck && pnpm test` pass; PR checks green; merged per conventions "Done".
## Out of scope
Screens per role (#02).
