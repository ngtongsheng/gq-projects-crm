# Shared context for every task in loop 24
- Read `CLAUDE.md` (engineering bar, database rules) and `docs/design-system.md` for UI.
- Checks: `pnpm check`, `pnpm typecheck`, `pnpm test`. All must pass before a task is done.
- Database changes: one new file in `supabase/migrations/`, timestamp after the newest file there
  (newest at planning time: `20261120110000_app_settings_upsert.sql`). Never edit an applied migration.
- Database tests are PGlite tests in `supabase/tests/*.test.ts` (see `claim-people.test.ts` for the pattern).
- Every table: RLS on, `revoke all` from anon/authenticated, column grants, the restrictive
  "left people: no access" policy, `set search_path = ''` on SECURITY DEFINER functions.
- User-facing messages go through the existing i18n dictionaries (en, zh, bm); the zh/bm key-parity test must pass.
- Next.js 16: read `node_modules/next/dist/docs/` before using an API you are unsure of.
- Audit with evidence lines: `docs/audits/2026-11-16-code-audit-round-2.md`.
