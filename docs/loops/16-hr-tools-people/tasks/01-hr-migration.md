---
model: opus
effort: medium
why: Salary data; RLS must hold for md/accounts only, including against admin and View as
depends: []
---
# 01 HR migration
## Goal
Tables: policy documents (category, title, version, effective date, file or link, replaces), extra rules log, staff
packages (person, effective date, basic, allowances, claim cap, hotel level, grade), standard packages (sales, site),
outstation rules (meal and hotel by level), sales grades (J1-M2: basic, annual target, description; seed per D6).
RLS per D1.
## Context
- `docs/office-parity/drift-new-modules.md` "HR"; demo `vHR` ~4437, `HR_GRADES` ~4368, `hotelLvl` ~4380.
- View as is read-only and runs as the viewed person: check it cannot read these tables (`docs/decisions.md`).
## Files to touch
- `supabase/migrations/<ts>_hr.sql` (new), `supabase/tests/hr.test.ts` (new), generated DB types
## Acceptance
- `pnpm check`, `pnpm typecheck`, `pnpm test`, `pnpm guard:migrations` pass. Tests: md and accounts read/write;
  admin-only staff, director, sales and a left person get nothing.
