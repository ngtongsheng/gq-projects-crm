---
model: sonnet
effort: high
why: seed script across all tables, never prod
depends: [32]
---
# 33 Test-copy example data
## Goal
One command fills the test copy with realistic fictional records for every module so previews show a working CRM.
## Context
- Read `docs/loops/03-crm-features/assets/conventions.md` first; it applies in full.
- Spec: `docs/loops/03-crm-features/assets/prototype-spec.md`.
- Prototype anchors (grep): `seed`, `Reset example data`
- Decisions: see `docs/loops/03-crm-features/loop.md` (D1-D12).
## Files to touch
- scripts/seed-example-data.ts
- package.json (script `seed:example`)
- docs/environments.md
## Steps
1. Uses the dev URL and a dev secret from an untracked `.env.seed.dev`; refuses to run if the URL is the prod project ref (check `docs/environments.md`).
2. Also create one test sign-in per job role on the test copy (Supabase admin API, fixed emails like `test-sales@example.invalid`, passwords printed once to the terminal, never committed), so #35 can sign in as each role.
3. Fictional names only; deterministic. Idempotent: deletes only rows it created (tagged in notes).
## Acceptance
- Run against the test copy; record row counts in loop.md Log. If the dev secret is not available, park as owner action.
- `pnpm check && pnpm typecheck && pnpm test` pass; PR checks green; merged per conventions "Done".
## Out of scope
Prod data.
