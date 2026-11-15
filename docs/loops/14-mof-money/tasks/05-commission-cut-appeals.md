---
model: opus
effort: medium
why: Commission rules change for unpaid money; appeals alter cuts
depends: []
---
# 05 Commission 180-day cut + appeals rules
## Goal
D3 and the data and rules for D4: appeal (Pending / Approved / Rejected, reason 10+ chars, by, decision, reply);
approved sets that late cut to 0.
## Context
- `src/lib/domain/commission-settings.ts` (default 120 at ~73), `commission.ts`, `commission-balance.ts`.
- Demo `late2`, `p.lateWaive[who]`. Who decides: md (and accounts if the demo says so; check).
## Files to touch
- `supabase/migrations/<ts>_commission_appeals.sql` (new: table + RLS + settings update only where 120) + test
- `src/lib/domain/commission-settings.ts`, `commission.ts` (+ tests), `src/app/(app)/commission/appeal-actions.ts` (new) + test
## Acceptance
- Checks and `pnpm guard:migrations` pass; tests: 179/180/181 days; approved appeal zeroes the cut; paid payouts unchanged.
