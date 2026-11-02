---
model: sonnet
effort: high
why: list screen with stage changes
depends: [13]
---
# 14 MOF register list + stages
## Goal
MOF Register (My Sales for salespeople) lists MOFs with stage, total, salesperson and delivery date; editors move stages; managers filter by stage and person.
## Context
- Read `docs/loops/03-crm-features/assets/conventions.md` first; it applies in full.
- Spec: `docs/loops/03-crm-features/assets/prototype-spec.md`.
- Prototype anchors (grep): `MOF Register`, `My Sales`, `Pending order`, `Closed`
- Decisions: see `docs/loops/03-crm-features/loop.md` (D1-D12).
## Files to touch
- src/app/(app)/mofs/page.tsx
- src/lib/domain/mof-stages.ts (+ test)
- src/lib/auth/nav-sections.ts
## Steps
1. `mof-stages.ts`: ordered stages, labels, StatusBadge tone per stage; on-hold/cancelled reachable from any open stage.
2. Moving out of 'Pending delivery' warns when 'payment checked before delivery' is unticked (warning, not a block, as in the prototype; verify).
3. Salespeople see only MOFs where they are salesperson or second.
## Acceptance
- Test: stage order and allowed moves.
- `pnpm check && pnpm typecheck && pnpm test` pass; PR checks green; merged per conventions "Done".
## Out of scope
Collections, POs.
