---
model: opus
effort: medium
why: RLS change on a live table; must not hide projects from selling site supervisors or operations roles
depends: []
---
# 09 Projects: site role scoping
## Goal
The site role sees only projects where they are PIC or support; chips use the team-filtered list (drift-money-reports
"Projects").
## Context
- Current policy: `supabase/migrations/20261114130000_team_scoping_sales.sql` ~115-128 gives `site` all projects.
- A site supervisor with `sells` (e.g. Sarah) also keeps their own sales projects (owner / passed_by), per drift-shell-sales
  "Roles and access".
- `src/app/(app)/projects/project-access.ts` (+ test), `project-filters.ts` (chips).
## Files to touch
- `supabase/migrations/<ts>_projects_site_scoping.sql` (new)
- `supabase/tests/` project RLS test
- `src/app/(app)/projects/project-access.ts`, `project-filters.ts` (+ tests)
## Acceptance
- Checks and `pnpm guard:migrations` pass; RLS tests for site, site+sells, support, ssup, md.
## Out of scope
Site Work screens.
