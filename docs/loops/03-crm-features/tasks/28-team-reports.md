---
model: sonnet
effort: high
why: read views over #27
depends: [27]
---
# 28 Team + director reports
## Goal
Managers see Team Reports (everyone's status for a month, open to review); the director writes a director report reviewed by the MD.
## Context
- Read `docs/loops/03-crm-features/assets/conventions.md` first; it applies in full.
- Spec: `docs/loops/03-crm-features/assets/prototype-spec.md`.
- Prototype anchors (grep): `Team Reports`, `Director Report`
- Decisions: see `docs/loops/03-crm-features/loop.md` (D1-D12).
## Files to touch
- src/app/(app)/reports/team/page.tsx
- src/app/(app)/reports/director/page.tsx
- src/app/(app)/reports/actions.ts
- src/lib/auth/nav-sections.ts
## Steps
1. Director report reuses `monthly_reports` with kind `director` (add to the check in a new migration if #27 did not include it) and team-level stats from report-stats.
2. Visible to md, director, bd, accounts per the prototype.
## Acceptance
- Tests: director report review only by md.
- `pnpm check && pnpm typecheck && pnpm test` pass; PR checks green; merged per conventions "Done".
## Out of scope
PDF export.
