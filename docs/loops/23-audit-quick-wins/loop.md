# Loop 23: Audit quick wins
Orchestrator: standard
## Goal
The verified quick wins from `docs/audits/2026-11-16-code-audit.md` are fixed and live: the app layout, last-activity
lookups and MOF detail page stop waiting on independent queries in sequence, the leave-entitlement race shows the right
result, dead code and one misplaced dependency are gone, and a zh/bm key-parity test guards the dictionaries.
No behaviour change for the team. All other audit findings are logged in `docs/debt.md`.

## Decisions
| ID | Decision | Why | Rejected |
|---|---|---|---|
| D1 | Scope is quick wins only: P1, P2, P4, B1, B3, Q3, Q4, R6 | Nothing is broken today; high payoff per diff line; owner picked it | Adding P3/P5 dashboard work, R1 dialog hook, full i18n sweep: bigger blast radius, separate loops |
| D2 | Verification corrected the audit: Q3 holds for `effectiveSalesTarget` only (`sqftToM2`, `landedPerM2`, `lineAreaM2`, `totalAreaM2` have production callers); the `cn` wrapper claim in Q4 is wrong (UI files import the `cn` package directly); P7 runs on the sales dashboard, `/people` and `/performance`, not every dashboard | Checked against `main` at `ffc1ee0` | Acting on the audit text as written |
| D3 | B2 (monthly "late" flag judged by today's due time) is not fixed here | Changing it needs a stored due time plus a business-rule call from Vicky; logged in `docs/debt.md` | Migration to store the due time at submit |
| D4 | P2 fix: `getLastCompletedDays` becomes a no-argument React `cache()` function that creates its own client | Same pattern as holidays and team directory; dedupes within one request without threading a client | Passing a shared client or a module-level cache (leaks across requests) |
| D5 | B1 fix: when the insert hits 23505 (another editor inserted first), re-run the update; the table has no upsert grant on its key | Smallest change that returns the correct result; no migration | Adding an upsert grant (database change) |
| D6 | R6 test ships with a snapshot allowlist of today's zh/bm gaps; new gaps fail | Fixing real translation gaps needs a native-speaker pass, not part of this loop | Filling gaps with machine translation |
| D7 | Ship: executor merges `loop/23-audit-quick-wins` to `main` and pushes (deploys live) | Owner approved; no migrations, checks gate every task | Stopping on a branch |
| D8 | Preflight: the only outward step is the push to `main` (allowed by global rule `git push origin HEAD:main`, approved in D7) | | |

## Tasks
| # | Task | Status | Depends | Tier |
|---|---|---|---|---|
| 01 | Layout: run independent awaits in parallel (P1) | done | | standard |
| 02 | Cache `getLastCompletedDays` per request (P2) | done | | standard |
| 03 | MOF detail: parallelise post-load queries (P4) | todo | | standard |
| 04 | Leave entitlement: handle the concurrent insert (B1) | todo | | standard |
| 05 | Cleanup: dead skeleton, dead export, `shadcn` to devDependencies (B3, Q3, Q4) | todo | | economy |
| 06 | zh/bm key-parity test (R6) | todo | | standard |
| 07 | Log deferred findings, add verification notes to the audit | todo | | economy |
<!-- status: todo | in-progress | done | blocked: <reason> -->

## Owner actions
None.

## Log
<!-- one line per event: YYYY-MM-DD · #NN · result · next -->
2026-11-16 · plan · loop written after verifying the audit · next: /execute-loop docs/loops/23-audit-quick-wins
2026-11-16 · planner · YES, tab w7:t12 closed · worktree ready, deps installed
2026-11-16 · #01 · in-progress · delegated (standard)
2026-11-16 · #01 · done · check/typecheck/test pass (3034 tests) · next: #02
2026-11-16 · #02 · in-progress · delegated (standard)
2026-11-16 · #02 · done · all checks pass · next: #03
