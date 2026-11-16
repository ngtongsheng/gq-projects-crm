---
tier: economy
why: two config lines, one doc paragraph, three scripted commands
depends: []
---
# 01 Seed access, migrate and seed test copy
## Goal
The executor can seed the test copy itself, the test copy has every migration, and every persona signs in from the
dev role panel.
## Context
- Loop decision D5. `.env.local` holds `SUPABASE_SERVICE_ROLE_KEY` for the test copy (written by `pnpm connect:test-copy`).
  Never open, cat or grep any `.env*` file; only scripts read them.
- `docs/environments.md` sections "Example data on the test copy" and "Trying database changes from a laptop".
## Files to touch
- `package.json` (`seed:example` script)
- `.claude/settings.json` (allow list)
- `docs/environments.md` (Example data section, step 1)
## Steps
1. Worktree `loop/21-parity-sweep` from `main` per D7. Run `pnpm copy-env` (copies `.env.local` from the main checkout). If
   it reports no source file, mark blocked: owner (see Owner actions) and stop.
2. `seed:example` → `node --env-file=.env.development --env-file-if-exists=.env.local --env-file-if-exists=.env.seed.dev scripts/seed-example-data.ts`.
   Confirm the seed script still refuses a non-test-copy URL (read its guard, don't change it).
3. Add `"Bash(pnpm seed:example)"` to the allow list in `.claude/settings.json`, next to `pnpm reset:sign-ins`.
4. Update `docs/environments.md` step 1: `.env.seed.dev` is optional once the laptop is connected to the test copy.
5. Run `pnpm db:test-copy` (expect up to date; if it applies migrations, log which), then `pnpm seed:example` (do not
   echo the printed passwords into the log).
6. `pnpm dev`, open `/dev` in Chrome profile "Agent", sign in as three personas (Vicky, Jany, Akmal) and see the
   dashboard. If Chrome is unreachable, log it and leave the sign-in check to #02.
## Acceptance
- `pnpm db:test-copy` prints up to date; `pnpm seed:example` exits 0 with row counts.
- `pnpm check` and `pnpm typecheck` pass.
## Out of scope
Changing seed data, the dev panel, or any other script.
