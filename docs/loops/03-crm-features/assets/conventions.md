# Loop 03 conventions (every task reads this)

## Before building
- Read `CLAUDE.md`, `docs/design-system.md`, `docs/glossary.md`. Reuse `src/components/app/*` (AppShell, PageHeader,
  EmptyState, DataTable, StatusBadge) and `src/components/ui/*`; add shadcn components with
  `pnpm dlx shadcn@latest add <name>` then `pnpm format`. Theme tokens only.
- The prototype `docs/mockup/gq-crm-mockup.html` is the spec input, not the data model. Read only the part your task
  names: `grep -n "<anchor>" docs/mockup/gq-crm-mockup.html`, then `sed -n` around it. Never read the whole file.
  Summary of the prototype: `assets/prototype-spec.md`.
- Next.js 16: check `node_modules/next/dist/docs/` before using a Next API you are unsure of.
- Match the pattern of `src/app/(app)/people/` (page.tsx server component, `actions.ts` server actions,
  `schemas.ts` zod schemas, `actions.test.ts`), `src/lib/auth/require-role.ts` and `current-profile.ts`.

## Database
- One new file per task in `supabase/migrations/`, named `YYYYMMDDHHMMSS_<slug>.sql`, timestamp later than every
  existing file. Additive only (the guard blocks drops, renames, retypes, deletes).
- Every new table: `enable row level security`, explicit `revoke all ... from anon, authenticated`, grants, and
  policies in the same migration, using the helpers from #01 (`public.is_admin()`, `public.has_job_role(...)`,
  `public.is_manager()`). Follow `20261101120000_profiles.sql`.
- Columns: `id uuid primary key default gen_random_uuid()`, `created_at timestamptz not null default now()`,
  `created_by uuid references public.profiles(id) default auth.uid()`. Status/stage values as `text` + `check (...)`.
  Money `numeric(14,2)`, quantities `numeric(12,2)`, percentages `numeric(5,2)`, calendar days `date`.
- Generated DB types: if the repo has a types file under `src/lib/supabase/`, regenerate or extend it the way it is
  done there; otherwise type query results through the zod schema.

## Code
- Domain words from the prototype: customer, company, contact, activity, project (pipeline), MOF, supplier PO,
  installer PO, claim, DO, job, site log, follow-up, OT claim, stock item, reservation, leftover, collection,
  payment, commission. Kebab-case files, camelCase functions, PascalCase types.
- Money/dates/areas only through `src/lib/format/*` and `src/lib/domain/*` from #03. Malaysia time
  (`Asia/Kuala_Lumpur`, no DST). RM amounts.
- Pure logic (derivations, calculations, permissions) goes in its own file with a vitest test next to it.
  Skip tests for markup.
- Errors: show a plain message (toast), log details server-side. No `any`, no lint disables, no stray logs.
- Screens site supervisors use (site work, OT, installation calendar, bookings) must work at 390px width.
- Navigation entries are added to the nav config from #02, gated by job role, not hard-coded in the shell.
- Reminders and overdue flags are in-app only (no email, push or WhatsApp).
- Files are not uploaded; Drive links are a validated URL text field.

## Done (every task)
1. `pnpm check && pnpm typecheck && pnpm test` pass locally.
2. Open a PR from `loop/03-crm-features-NN-<slug>`; `gh pr checks --watch` all green (migration applies to the test copy).
3. Squash-merge (owner-approved per D6), delete the branch and worktree; confirm `migrate-prod` succeeded on main.
4. Log one line in `loop.md`.
