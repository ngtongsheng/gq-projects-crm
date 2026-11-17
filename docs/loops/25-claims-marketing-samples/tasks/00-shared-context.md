# Shared context for every task in loop 25
- Read `CLAUDE.md` (engineering bar, database rules) and `docs/design-system.md`; reuse what `/dev/components` shows.
- Spec: the demo `docs/mockup/gqp-office-demo.html` (after task 01) and the change spec `../assets/demo-changes.md`.
  The section named in your task is the source for fields, columns, buttons, states and texts. Copy labels exactly.
- Roadmap rules: `docs/office-parity/roadmap.md` ("Rules for every parity loop"). Where the demo cannot work for
  real, or has a prototype bug (`demo-changes.md` §6, loop decision D8), deviate and log it in `docs/decisions.md`.
- Checks: `pnpm check`, `pnpm typecheck`, `pnpm test`. All must pass before a task is done.
- Database: one new file in `supabase/migrations/`, timestamp after the newest file there (newest at planning time:
  `20261120180000_small_data_fixes.sql`). Never edit an applied migration. `pnpm guard:migrations` must pass except
  for task 05's intended drop.
- Database tests: PGlite tests in `supabase/tests/*.test.ts` (pattern: `claim-people.test.ts`).
- Every table: RLS on, `revoke all` from anon/authenticated, column grants, the restrictive "left people: no access"
  policy, `set search_path = ''` on SECURITY DEFINER functions. Role checks use existing helpers
  (`public.has_job_role`, `src/lib/auth/job-role.ts`). Accounts is read-only (`isReadOnly`) except travel-claim release.
- User-facing text goes through the i18n dictionaries (en, zh, bm); the key-parity test must pass.
- Money: `numeric(12,2)`, RM, never floats in sums (follow existing money helpers in `src/lib/format`/domain).
- Dates: Malaysia time (MYT) like the rest of the app; the claim month rule is in `demo-changes.md` §1.1.
- WhatsApp links: reuse the existing wa.me helper (grep `wa.me` in `src/`).
- Print: reuse the existing print layout (the old claim print sheet and `formShell` equivalents in the app).
- UI tasks: run a parity check per `docs/office-parity/parity.md` for each role that sees the screen when the test copy
  and Chrome are available; otherwise log "parity not run" and why.
- Next.js 16: read `node_modules/next/dist/docs/` before using an API you are unsure of.
