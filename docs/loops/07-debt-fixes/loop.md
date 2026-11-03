# Loop 07: Loop 05 debt fixes
Orchestrator: sonnet/high
## Goal
Loop 05 debt findings 3, 14, 20, 31, 45, 49, 55, 59, 64 are fixed (not re-logged), with database rules covered by
PGlite tests in `pnpm test`. Their rows are gone from `docs/debt.md`, finding 55 is recorded in `docs/decisions.md`,
and the loop PR is merged. Prototype screens (findings 54, 56-58, 65, 66) are out of scope: they wait for Vicky.
## Decisions
| ID | Decision | Why | Rejected |
|---|---|---|---|
| D1 | Finding 55: salespeople (bd, sales) read only projects where they are `pic_id`, `support_id` or `passed_by`; md, director, accounts, site, support (purchasing) still read all. Narrow the existing `"projects: read all"` policy with `alter policy ... using (...)` (the migration guard blocks `drop policy`) and `comment on policy` to explain the old name. Projects page filters the same way | Owner choice 2026-11-03; matches prototype | Keep all-read; all-read with money hidden |
| D2 | Add `@electric-sql/pglite` as a devDependency. DB tests in `supabase/tests/*.test.ts`, run by `pnpm test`; harness applies every migration to a fresh in-memory DB with stubbed `auth.uid()` and roles | Owner approved 2026-11-03; closes finding 3 | No SQL tests |
| D3 | Payout cap (20): SQL function computing payable-now per MOF + before-insert trigger on `commission_payouts`; a parity test runs the same cases through TS `calculateCommission` and the SQL function | Owner choice; DB enforces, parity test stops drift | App-only lock + recheck |
| D4 | Stock (64): on hand below held stays allowed; Stock items table shows "over-held by N" | Owner choice; the count is the truth | Refuse the edit |
| D5 | Atomic saves (14, 31) via SQL functions with `security invoker` so RLS and triggers still apply; called with `supabase.rpc` | supabase-js has no transactions; invoker keeps permission rules in one place | security definer; client-side compensation |
| D6 | No new debt. A subagent "debt" is sent back unless it needs an owner decision, a new dependency or a D4-type blocked migration | Loop 05 lesson: 8 of 14 debt rows had known fixes | Accepting debt rows |
| D7 | One branch `loop/07-debt-fixes` in a worktree, one commit per fix, one PR; merge pre-approved once local and PR checks pass. If auto mode denies the merge, park it as an owner action | Same as loop 05 D6 | Per-task PRs |
| D8 | New migrations are additive (`create or replace`, `alter policy`, new functions/triggers) and pass `pnpm guard:migrations`; trigger functions get `revoke execute ... from public, anon, authenticated` | Migration guard; loop 05 pattern | Drops |
## Tasks
| # | Task | Status | Depends | Model/Effort |
|---|---|---|---|---|
| 01 | PGlite harness + first test | done | - | opus/medium |
| 02 | Tests for loop 05 database rules | done | 01 | sonnet/high |
| 03 | Atomic MOF save (14) | done | 01 | opus/medium |
| 04 | Atomic customer + new company save (31) | done | 01 | sonnet/high |
| 05 | Payment cap in the database (49) | done | 01 | sonnet/high |
| 06 | Payout cap in SQL + parity test (20) | in-progress | 01 | opus/medium |
| 07 | Set-password retry (45) + 3 forms keep values (59) | todo | - | sonnet/high |
| 08 | Stock over-held display (64) | todo | - | sonnet/medium |
| 09 | Projects own-only for salespeople (55) | todo | 01 | opus/medium |
| 10 | Final checks, debt.md and decisions.md cleanup | todo | 02, 03, 04, 05, 06, 07, 08, 09 | haiku/low |
<!-- status: todo | in-progress | done | blocked: <reason> -->
## Owner actions
- End: if auto mode denies `gh pr merge` (D7), merge the loop PR yourself.
## Log
<!-- one line per event: YYYY-MM-DD · #NN · result · next -->
2026-11-03 · plan · loop written (10 tasks) · /execute-loop
2026-11-03 · #01 · started · subagent opus/medium
2026-11-03 · #01 · done · checks pass, test fails without the guard migration · #02
2026-11-03 · #01 · decision · actAs(null) = service role, not anon · matches how the guard skips service role
2026-11-03 · #02 · started · subagent sonnet/high
2026-11-03 · #02 · done · 96 files, 837 tests pass · #03
2026-11-03 · #02 · decision · added supabase/tests/fixtures.ts for shared setup · avoids duplication
2026-11-03 · #03 · started · subagent opus/medium
2026-11-03 · #03 · done · 97 files, 847 tests pass, guard clean · #04
2026-11-03 · #03 · decision · cost refusal message keyed on error text containing mof_costs; unknown line ids still update nothing (old behaviour kept) · smallest change
2026-11-03 · #04 · started · subagent sonnet/high
2026-11-03 · #04 · done · 98 files, 860 tests pass, guard clean · #05
2026-11-03 · #04 · decision · not-owner update raises 42501, action shows generic retry message · pre-checks already give the specific message
2026-11-03 · #05 · started · subagent sonnet/high
2026-11-03 · #05 · done · 99 files, 865 tests pass, guard clean · #06
2026-11-03 · #05 · decision · payment cap trigger is security definer (execute revoked): accounts lack update on mofs and read on all payments · needed for for-update lock and sum
2026-11-03 · #06 · started · subagent opus/medium
