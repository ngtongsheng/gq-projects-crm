---
model: opus
effort: medium
why: money rules with tiers, splits, late cuts and exceptions
depends: [01, 24]
---
# 25 Commission settings + calculation
## Goal
Commission is calculated by one tested function from settings the MD can change on a Commission settings screen.
## Context
- Read `docs/loops/03-crm-features/assets/conventions.md` first; it applies in full.
- Spec: `docs/loops/03-crm-features/assets/prototype-spec.md`.
- Prototype anchors (grep): `commission`, `margin`, `late`, `bonus`, `Pass-down`
- Decisions: see `docs/loops/03-crm-features/loop.md` (D1-D12).
## Files to touch
- src/lib/domain/commission.ts (+ test)
- src/lib/domain/commission-settings.ts (+ test)
- src/app/(app)/commission/settings/page.tsx
- src/app/(app)/commission/settings/actions.ts
- src/app/(app)/projects/pipeline-board.tsx (est. commission)
## Steps
1. Read the prototype's commission code fully (anchors) before writing; record any rule that differs from `assets/prototype-spec.md` in loop.md Log.
2. `commission-settings.ts`: zod schema for base rates per account type, margin tiers, late cut days and percents, claim threshold 90%, split share; defaults from the prototype; stored in `app_settings` under `commission`.
3. `commission.ts`: pure `calculateCommission({mof, cost, payments, people, settings, today})` returning per person earned, claimable flag, and a breakdown line list. Handles two salespeople split, excluded person, flat pass-down person.
4. Settings screen: md only; validates and saves.
## Acceptance
- Tests: each tier boundary, late cuts at 90/91/120/121 days, split, excluded, flat pass-down, not claimable under 90%, cost missing.
- `pnpm check && pnpm typecheck && pnpm test` pass; PR checks green; merged per conventions "Done".
## Out of scope
Payout records (#26).
