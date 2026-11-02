---
model: sonnet
effort: high
why: one page plus a tested derivation
depends: [05]
---
# 06 Customer detail + health flags
## Goal
Each customer has a detail page (contact info, owners, company's other contacts, activity and projects placeholders), and lists show a Quiet / No activity flag.
## Context
- Read `docs/loops/03-crm-features/assets/conventions.md` first; it applies in full.
- Spec: `docs/loops/03-crm-features/assets/prototype-spec.md`.
- Prototype anchors (grep): `Quiet`, `No activity`
- Decisions: see `docs/loops/03-crm-features/loop.md` (D1-D12).
## Files to touch
- src/app/(app)/customers/[id]/page.tsx
- src/lib/domain/customer-health.ts (+ test)
- src/app/(app)/customers/page.tsx
## Steps
1. `customerHealth(lastCompletedActivityDate, today)`: >60 days Quiet, >90 days No activity, none yet = New.
2. Until #08, the last-activity date is null for everyone; the function and badge are in place.
3. Detail page sections that later tasks fill (Activities, Projects) render EmptyState.
## Acceptance
- Test: health thresholds at 60/61/90/91 days.
- `pnpm check && pnpm typecheck && pnpm test` pass; PR checks green; merged per conventions "Done".
## Out of scope
Activities data.
