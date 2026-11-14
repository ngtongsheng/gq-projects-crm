---
model: opus
effort: medium
why: Stage mapping and computed banners touch existing stage logic
depends: [01]
---
# 02 Site log rules
## Goal
Pure functions + server action: save a multi-activity log; stage move per D6; installation % lower than last warns;
visit count vs target per month; missed days and planned-but-unrecorded (working days Mon-Sat minus holidays, approved
leave and site_off); stock-return WhatsApp text.
## Files to touch
- `src/lib/domain/site-log.ts`, `src/lib/domain/site-stage.ts` (+ tests), `src/app/(app)/site-work/actions.ts`
## Acceptance
- `pnpm check`, `pnpm typecheck`, `pnpm test` pass. Tests: stage mapping incl. never backwards; missed days around leave and holidays; warning on lower %.
