---
model: haiku
effort: low
why: writing given content into a page
depends: [29]
---
# 34 In-app guide
## Goal
A Guide page explains each screen in the team's words, adapted from the prototype's guide.
## Context
- Read `docs/loops/03-crm-features/assets/conventions.md` first; it applies in full.
- Spec: `docs/loops/03-crm-features/assets/prototype-spec.md`.
- Prototype anchors (grep): `guide`, `Guide`
- Decisions: see `docs/loops/03-crm-features/loop.md` (D1-D12).
## Files to touch
- src/app/(app)/guide/page.tsx
- src/lib/auth/nav-sections.ts
## Steps
1. Adapt the prototype guide text; remove mentions of example data and the demo user switcher. Plain words per `docs/glossary.md`.
## Acceptance
- Visible to all roles.
- `pnpm check && pnpm typecheck && pnpm test` pass; PR checks green; merged per conventions "Done".
## Out of scope
Videos.
