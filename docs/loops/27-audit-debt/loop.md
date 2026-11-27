# Loop 27: Clear loop 26 audit debt
Orchestrator: standard
## Goal
Fix the round 3 audit debt that needs no owner decision, all behaviour-preserving. First, `loadEventCosts` reads past
1000 rows so dashboard totals stay right through the marketing history import. Then the file-cap deferrals
(A3, A4, A10, A14, A15, A17), logging (B8, B9) and duplication (B2, B4, B5, paging loops). debt.md and the audit
outcome show what is left. The branch passes every check and is ready for the owner to push.
## Decisions
| ID | Decision | Why | Rejected |
|---|---|---|---|
| D1 | Branch `loop/27-audit-debt` in a worktree off local `main` (dfeb00f plus this plan commit, which agents cannot push). The owner pushes the branch to `main`, plan included | Agents are denied pushing `main`, and a push to `main` deploys and runs migrations in CI | Allow rule for pushing `main` |
| D2 | Behaviour-preserving only, the same policy as loop 26 D3. Anything that would change behaviour, schema, RLS, routes or the UI people see goes to `docs/debt.md` | Live app the team uses daily; this loop has no review step with Vicky | Fixing behaviour items too |
| D3 | Include B8 and B9 (logging only) beyond the requested list | Nobody sees a difference, and the files are small. B9 sits in a file task 01 already touches | Leave in debt |
| D4 | Out: B7 (costing split), A2 (server-side year filter), A5, A6, A12, A13, A16, Supabase CLI 3, TypeScript 7. They stay in debt.md with their current "when to fix", and no owner questions are written | B7 is a risky refactor with no feature to test it against; the rest change behaviour, schema or UI | Owner question list; B7 at frontier tier |
| D5 | `loadEventCosts` moves onto `readAllRows` with no year filter | `marketing_event_costs` has no date, and the dashboard events panel shows every event. A year filter would change what it shows | Filter by event year (debt.md hint) |
| D6 | `DeleteConfirm` goes in `src/components/app/` with a demo on `/dev/components` | Design system: shared UI lives there and is shown there before reuse | Feature-local copy |
| Preflight | Push to `main` → owner action. No secret reads, sign-ins or installers. Only `pnpm` scripts and git on the loop branch | | |
## Tasks
| # | Task | Status | Depends | Tier |
|---|---|---|---|---|
| 01 | Event costs and paging loops onto readAllRows, log the failed rollback (B9) | done | | standard |
| 02 | Marketing page reads in parallel, log workbook parse failures, handle the photo rejection (A3, A4, A10) | done | | standard |
| 03 | Travel claim reads and logs, ready-to-release reads (A14, A15, A17) | done | | standard |
| 04 | Money-path writes onto logServerError (B8) | done | | economy |
| 05 | DeleteConfirm component and first 3 dialogs (B2) | todo | | standard |
| 06 | DeleteConfirm in the other 5 marketing dialogs (B2) | todo | 05 | economy |
| 07 | mofPeople helper for the salesperson join (B4) | todo | | standard |
| 08 | MOF register column factory (B4) | todo | 07 | standard |
| 09 | Shared project picker loader (B5) | todo | | standard |
| 10 | Close out debt.md and the audit outcome | todo | 01-09 | economy |
<!-- status: todo | in-progress | done | blocked: <reason> -->
## Owner actions
- After #10: push `loop/27-audit-debt` to `main` (`git push origin loop/27-audit-debt:main` once it is rebased on the
  latest main, or merge the PR). CI runs checks and deploys.
## Log
<!-- one line per event: YYYY-MM-DD · #NN · result · next -->
2026-11-27 · - · planner tab w7:t1P answered YES, closed · start #01
2026-11-27 · - · baseline in worktree: check, typecheck, 3337 tests pass · -
2026-11-27 · #01 · delegated (standard) · wait
2026-11-27 · #01 · decision · allIds and installer loader order by id on every page · keeps their previous queries
2026-11-27 · #01 · decision · no permanent test added for the paged import or rollback log · test file outside the listed files
2026-11-27 · #01 · done; check, typecheck, 3337 tests, build pass · #02
2026-11-27 · #02 · delegated (standard) · wait
2026-11-27 · #02 · decision · A10 stays open in debt.md · custom-sample-sheet.tsx has no error UI and step 3 says leave it open
2026-11-27 · #02 · decision · marketing views became async functions the page calls · categories read runs beside each view and still fails the whole page
2026-11-27 · #02 · done (A3, A4); check, typecheck, tests, build pass · #03
2026-11-27 · #03 · delegated (standard) · wait
2026-11-27 · #03 · decision · people are now read even with no submitted claim, so that failure path throws instead of returning 0 · required by the A17 parallel read
2026-11-27 · #03 · done (A14, A15, A17); check, typecheck, 3341 tests, build pass · #04
2026-11-27 · #04 · delegated (economy) · wait
2026-11-27 · #04 · decision · dbMessage helpers gained an id context parameter; the approval load catch logs the revision id only · no ids in scope otherwise
2026-11-27 · #04 · done (B8); check, typecheck, 3341 tests, build pass · #05
