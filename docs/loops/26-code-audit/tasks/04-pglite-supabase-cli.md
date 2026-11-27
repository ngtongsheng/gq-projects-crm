---
tier: frontier
why: supabase CLI drives prod migrations and backups; a wrong call breaks the deploy path
depends: [03]
---
# 04 pglite 0.6 and supabase CLI 3
## Goal
pglite 0.6 with database tests green. supabase CLI 3 only if every command the repo runs still works; otherwise
stay on 2.x and record why.
## Context
Read `00-shared-context.md`. CLI users: `.github/workflows/{checks,migrate-prod,backup,health}.yml`,
`scripts/{migration-guard,db-test-copy,connect-test-copy,push-auth-config,seed-admin,seed-example-data,reset-test-sign-ins}.ts`.
Database tests: `supabase/tests/*.test.ts` (PGlite). Agents must never run `supabase db push` (denied).
## Files to touch
`package.json`, `pnpm-lock.yaml`, PGlite test helpers if the API changed, workflow files only for flag renames.
## Steps
1. Read pglite 0.6 changelog/release notes (node_modules after install, else GitHub releases). Upgrade, fix test helpers.
2. Read supabase CLI 3 breaking changes. List every `supabase` command and flag the workflows and scripts use; check
   each against `pnpm exec supabase <cmd> --help` on v3.
3. All commands compatible (or a pure flag rename): upgrade and adjust. Any removed command, changed default or
   behavior you can't verify offline: revert to 2.x, note it in the loop Log for task 10's debt list.
## Acceptance
`pnpm test` passes (incl. `supabase/tests`). `pnpm check && pnpm typecheck && pnpm build` pass. Loop Log states the
CLI outcome and the command list checked.
## Out of scope
Running any command against the dev or prod database.
