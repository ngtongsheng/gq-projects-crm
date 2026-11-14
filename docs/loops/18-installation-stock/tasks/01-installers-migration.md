---
model: opus
effort: medium
why: Backfill that links existing jobs; name matching must not merge different people
depends: []
---
# 01 Installers migration + backfill
## Goal
Per D1: `installers` (name, company, two phones, skills, area, notes, active) with RLS, backfill, `jobs.installer_id`.
## Context
- `supabase/migrations/20261102220000_jobs.sql`, `20261102210000_installer_claims.sql`, `20261102190000_mofs.sql` (`installer_name`).
## Acceptance
- `pnpm check`, `pnpm typecheck`, `pnpm test`, `pnpm guard:migrations` pass. Tests: every job with a name gets linked; names differing only in case/spaces map to one installer; text kept.
