---
model: opus
effort: medium
why: Changes read policies on money tables and SQL commission functions; must not break the payout cap
depends: [04]
---
# 05 Team scoping: MOFs, payments, commission, reports
## Goal
Directors and BD see only their team's MOF sales figures, payments, commission and monthly reports. md and accounts
see all. Purchasing, site and ssup keep their operational reads.
## Context
- Helpers `my_team()` / `in_my_team()` from task 04. Demo: `tmP`, `inTeam`, `allMoney()`, `seeProj` (~1813-1836);
  reports: `vRep` team table filtered by `inTeam` (~4612).
- The commission payout cap and the MOF cost rule are SQL functions with parity tests
  (`supabase/tests/commission-parity.test.ts`, `mof-cost-rule.test.ts`); they must stay green.
## Files to touch
- `supabase/migrations/<ts>_team_scoping_money.sql` (new)
- `supabase/tests/team-scoping-money.test.ts` (new)
- Any page query that assumed directors read all and now needs the TS filter from `src/lib/auth/team.ts` (expect
  `src/app/(app)/performance`, `reports/team`; at most 3 files, else note them for the lane loops)
## Steps
1. Narrow the director/bd branch of read policies on mofs (sales and money columns), payments, commission payouts and
   monthly reports to `in_my_team(...)` on the salesperson column.
2. Keep the operational reads (purchasing, site, ssup) intact.
3. Tests per role as in task 04.
## Acceptance
- `pnpm check`, `pnpm typecheck`, `pnpm test`, `pnpm guard:migrations` pass, including the existing parity tests.
## Out of scope
Report review flow changes (lane MOF & money).
