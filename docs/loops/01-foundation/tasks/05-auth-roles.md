---
model: opus
effort: medium
why: security-critical: session handling, RLS policies, role checks
depends: [03, 04]
---
# 05 Auth, profiles, roles, RLS
## Goal
Email + password sign-in, protected app routes, `profiles` with `admin|staff` role enforced by RLS. No self sign-up.
## Context
- D7. Use `@supabase/ssr` per current Supabase Next.js docs (read installed version + docs first; cookie API changes between versions).
- Public sign-up is disabled in Supabase (#03); the app must also have no sign-up UI.
- First admin: owner + Vicky are seeded by a one-off script, not a migration (no personal data in migrations).
## Files to touch
`supabase/migrations/<ts>_profiles.sql`, `src/lib/supabase/{server,browser,middleware}.ts`, `src/middleware.ts`,
`src/app/(auth)/sign-in/page.tsx` + server action, `src/lib/auth/require-role.ts` (+ test), `scripts/seed-admin.ts`
## Steps
1. Migration: `profiles(id uuid pk references auth.users on delete cascade, full_name text, role text check in ('admin','staff') default 'staff', created_at)`;
   trigger creates a profile on new auth user; RLS: users read own profile; admins read all; only admins update role;
   nobody inserts directly (trigger only). Helper SQL function `is_admin()` (security definer, stable).
2. Supabase clients + middleware refreshing sessions; unauthenticated → `/sign-in`; signed in on `/sign-in` → `/`.
3. Sign-in page using design-system Form/Input/Button; sign-out in `AppShell` header; nav shows People only to admins.
4. `requireRole(role)` server helper; unit-test its decision logic (admin passes, staff blocked, no session redirects).
5. `scripts/seed-admin.ts` (run with service key from env, never committed): creates a user + sets role admin. Document usage in `docs/environments.md`.
6. Apply migration to dev manually once to test (`supabase db push` with dev ref) only if #08 isn't done; otherwise via CI.
## Acceptance
- `pnpm check && pnpm typecheck && pnpm test && pnpm build` pass.
- On dev DB: a staff user cannot select other profiles or update roles (verify with SQL as that user or a Vitest
  integration test against dev using two test users; delete test users after).
- Visiting `/` signed out redirects to `/sign-in`.
## Out of scope
Adding people UI (#06), password reset by email.
