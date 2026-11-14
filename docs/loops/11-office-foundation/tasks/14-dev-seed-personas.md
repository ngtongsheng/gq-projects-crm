---
model: sonnet
effort: medium
why: Seed data rewrite across several files; parity checks depend on matching people
depends: [03, 04, 06]
---
# 14 Dev seed: demo people as test personas
## Goal
The test copy has the demo's people (same names, roles, titles, teams, flags, left staff), each with a test sign-in,
and the dev role panel lists them like the demo's "Signed in as" dropdown.
## Context
- Demo `PEOPLE0` (~1455): Vicky md, Eddie director, Vanessa bd, Vernice / Vanisha / Cavan / Crystal sales (leads per
  the demo seed), Jany accounts, Awal / Akmal site, Sarah site + sells, Jess ssup + arrange, Wai Mun support + margin,
  Lisa support (left 2026-11-10, resigned), Marketing Exec marketing (left, vacant), Affifa / Liza designer.
- Seed: `scripts/seed-example-data.ts`, `scripts/example-data/people.ts` and the files that reference people,
  `scripts/reset-test-sign-ins.ts`; dev panel `src/components/app/dev-role-panel.tsx`,
  `src/app/dev/dev-sign-in-actions.ts`. Test emails stay `@example.invalid`.
## Files to touch
- `scripts/example-data/people.ts` (+ references), `scripts/reset-test-sign-ins.ts`
- `src/components/app/dev-role-panel.tsx`, `src/app/dev/dev-sign-in-actions.ts` (+ test)
- `docs/environments.md` (seed section)
## Steps
1. Replace the per-role test people with the demo's people; keep example records consistent (owners, PICs, teams).
2. Dev panel: list active people as "Name — title", sign in as that person.
3. Run `pnpm seed:example` against the test copy (needs `.env.seed.dev`; create from the dev secret key via the
   Supabase dashboard in Chrome, delete afterwards).
## Acceptance
- `pnpm check`, `pnpm typecheck`, `pnpm test` pass; `scripts/example-data/dataset.test.ts` passes.
- On `pnpm dev`, the panel signs in as Eddie and the sidebar matches the demo as Eddie.
## Out of scope
Prod people (added by admins).
