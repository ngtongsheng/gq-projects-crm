---
model: opus
effort: medium
why: Central permission model every later loop builds on; replaces hard-coded nav arrays
depends: [03]
---
# 06 Page registry + access matrix
## Goal
All 21 demo pages are registered once. What each role can open comes from defaults in code plus MD's overrides in the
database, enforced in the nav and on the server. MD edits the overrides in People, as in the demo.
## Context
- Demo: `PAGES`, `ACCESS0`, `accDefault`, `accAllowed`, `tabsDef` (~1939-1954), `tabsDefBase` (~1925) for default
  pages, order and per-role labels; People "What each role can see" in `vPeople` (~4995), including the "See margin %
  and cost" row. MD is always allowed. Role keys include `arrange` (a salesperson with `arranges_stock`).
- Today: `src/lib/auth/nav-sections.ts` (hard-coded `allowed` arrays, `canOpenSection`), `require-section.ts`,
  `can_see_mof_cost()` SQL and `canSeeMofCost` in `job-role.ts`.
- D5: the matrix gates pages and the margin flag only. D7: register every page with `built`; unbuilt pages are hidden
  and their routes 404. Existing routes not in the demo (`/overtime`, `/guide`, `/mofs/summary`,
  `/customers/ownership`, `/commission/settings`) map to the demo page they belong to.
## Files to touch
- `src/lib/auth/nav-sections.ts` → rename to `src/lib/auth/pages.ts` if it reads better (+ test)
- `src/lib/auth/require-section.ts`
- `supabase/migrations/<ts>_role_page_access.sql` (new): `role_page_access(role_key, page_key, allowed)`, RLS read for
  signed-in people, write md only; `can_see_mof_cost()` reads the margin row and the person's `sees_margin`
- `src/app/(app)/people/role-access.tsx` + action (new): the matrix editor, laid out as in the demo
- `supabase/tests/role-page-access.test.ts` (new)
## Steps
1. Registry: key, label per role (demo labels), icon key, default role keys, group (main or after the divider:
   perf, people, tasks, tools, leave), `built`.
2. Resolve: `canOpenPage(person, key)` = md → true; else override ?? default; `built` must be true.
3. Server gate and nav use it. Margin flag feeds cost visibility in TS and SQL.
4. Matrix editor in People for md; parity check against the demo's People matrix per `docs/office-parity/parity.md`.
## Acceptance
- `pnpm check`, `pnpm typecheck`, `pnpm test`, `pnpm guard:migrations` pass.
- Tests: defaults per role match `tabsDefBase` for built pages; an override hides a page in nav and server gate; md
  always allowed; margin override changes `can_see_mof_cost()`.
## Out of scope
Sidebar visuals (07). Building the unbuilt pages.
