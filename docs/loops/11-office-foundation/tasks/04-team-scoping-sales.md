---
model: opus
effort: medium
why: Changes read policies on core sales tables; a mistake leaks or hides customers
depends: [03]
---
# 04 Team scoping: helpers + customers, activities, projects
## Goal
Directors and BD see only their own team's customers, activities and projects. md and accounts see everyone.
Everyone else is unchanged.
## Context
- Demo rules (`docs/mockup/gqp-office-demo.html` ~1809-1836): `leadOf`, `teamOf(L) = [L, ...sales whose lead is L]`,
  `myTeam()` = null (all) for md and accounts, `teamOf(me)` for director and bd, own only otherwise. `tmC(c)`: a company
  is visible when an owner or its `passedBy` is in my team. `tmP(p)`: a project is visible when its pic, support or
  passedBy is in my team. `seeAct`: the activity's person is in my team, or I am invited.
- Decision D6 in `loop.md`. `reports_to` comes from task 03. Today `is_manager()` (md, director, accounts) reads all.
  Loop 07 D1 made salespeople read only their own projects; keep that.
## Files to touch
- `supabase/migrations/<ts>_team_scoping_sales.sql` (new)
- `src/lib/auth/team.ts` (+ test, new): TS mirror for UI filters (`myTeam`, `inMyTeam`)
- `supabase/tests/team-scoping-sales.test.ts` (new)
## Steps
1. SQL: `public.my_team()` returning profile ids (null meaning all) and `public.in_my_team(profile_id)`,
   `security definer`, `stable`, execute revoked from anon.
2. Replace the director-reads-all branch of the read policies on companies/customers, contacts, activities and
   projects with `in_my_team(...)` on the owner columns the demo uses. Site and support reads stay as they are.
3. TS mirror and tests: Eddie's team, Vanessa's team, md, accounts, a salesperson, a site supervisor.
## Acceptance
- `pnpm check`, `pnpm typecheck`, `pnpm test`, `pnpm guard:migrations` pass.
- The tests show a director cannot read another team's company, activity or project, and md can.
## Out of scope
MOFs, payments, commission, reports (task 05). UI team filters on screens (lane loops).
