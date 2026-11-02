---
model: sonnet
effort: high
why: composition of existing queries
depends: [11, 14, 20, 24, 27]
---
# 29 Dashboards per role
## Goal
Home is a dashboard per job role: MD (sales activity / MOF and projects toggle), director (team), sales (personal targets and pace), support (MOF), site (bookings and jobs), with attention counts.
## Context
- Read `docs/loops/03-crm-features/assets/conventions.md` first; it applies in full.
- Spec: `docs/loops/03-crm-features/assets/prototype-spec.md`.
- Prototype anchors (grep): `Dashboard`, `attention`, `pace`, `Sales activity`
- Decisions: see `docs/loops/03-crm-features/loop.md` (D1-D12).
## Files to touch
- src/app/(app)/page.tsx
- src/app/(app)/dashboard/*-dashboard.tsx (one per role, max 4 files)
- src/lib/domain/attention.ts (+ test)
## Steps
1. Use the pure functions already built (pace, flags, collection, reservation expiry); no new tables.
2. Stat tiles with `font-mono tabular-nums`; achieved % colours at 90/70 via theme tokens.
## Acceptance
- Test: attention counts from fixtures.
- `pnpm check && pnpm typecheck && pnpm test` pass; PR checks green; merged per conventions "Done".
## Out of scope
Charts libraries.
