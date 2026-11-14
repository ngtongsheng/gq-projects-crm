---
model: opus
effort: medium
why: Schema change on profiles and job roles with RLS consequences for three new roles across existing tables
depends: []
---
# 03 Roles and people fields
## Goal
The app knows the demo's ten job roles and the person fields later loops need, and People can edit them.
## Context
- Demo people and roles: `PEOPLE0` in `docs/mockup/gqp-office-demo.html` (~line 1455); per-role pages in
  `tabsDefBase` (~1925). Drift summary: `docs/office-parity/drift-shell-sales.md` → "Roles and access".
- New job roles: `ssup` (Sales support), `marketing` (Marketing Executive), `designer` (Designer). Labels follow the
  demo titles: md Managing Director, director Sales Director, bd Marketing Director, sales Salesperson, accounts HR &
  Accounts, site Site Supervisor, ssup Sales support, support Purchasing, marketing Marketing Executive, designer
  Designer.
- New person fields: `title` (free text, e.g. "Purchasing · MOF, installation, delivery, PO"), `joined_on`, `active`,
  `left_on`, `left_reason`, `reports_to` (profile id; a salesperson's team lead, a director or bd), `sells` (site
  supervisor who also sells), `sees_margin` (person-level margin flag), `whatsapp` (E.164 digits), `language`
  (`en` | `bm` | `zh`, default `en`). `arranges_stock` exists already.
- Existing role helpers: `src/lib/auth/job-role.ts` mirrors SQL helpers in the job_roles migration; RLS is the gate.
  DB tests: PGlite harness in `supabase/tests/` (`harness.ts`, `fixtures.ts`).
## Files to touch
- `supabase/migrations/<ts>_office_roles_people.sql` (new)
- `src/lib/auth/job-role.ts` (+ test), `src/lib/auth/current-profile.ts`
- `src/app/(app)/people/` (schemas.ts, add-person-dialog.tsx, person-settings-dialog.tsx, actions.ts + tests)
- `supabase/tests/office-roles.test.ts` (new)
## Steps
1. Migration: widen the job role check, add the columns with safe defaults, and give the three new roles read access
   on existing tables that matches their demo pages (ssup: jobs, site work, stock like Purchasing reads them;
   marketing: site logs and stock read-only; designer: nothing beyond the shared reads). Additive, passes
   `pnpm guard:migrations`. A left person (`active = false`) can no longer sign in (enforced where the session is
   resolved, and by RLS helpers treating them as no role).
2. Update `JobRole`, labels, helpers and `getCurrentProfile`.
3. People: add and edit the new fields; "reports to" lists active directors and bd only.
4. Tests: the new roles' reads, a left person reads nothing, `reports_to` must point to a director or bd.
## Acceptance
- `pnpm check`, `pnpm typecheck`, `pnpm test`, `pnpm guard:migrations` pass.
## Out of scope
Team scoping (04, 05), access matrix (06), resignation handover and targets per year (lane People & HR).
