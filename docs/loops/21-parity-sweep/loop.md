# Loop 21: Parity sweep
Orchestrator: standard
## Goal
Run the browser parity check (`docs/office-parity/parity.md`) that loops 14, 16, 17, 18 and 19 deferred, against the
laptop app on the test copy, for every role that sees each screen at 1280 and 390 px. Small UI drift is fixed in this
loop; larger drift is listed for loop 22. Done when every screen has a checklist report, deviations are logged, and
the branch is merged to `main`.
## Decisions
| ID | Decision | Why | Rejected |
|---|---|---|---|
| D1 | Scope: loops 14, 16, 17, 18, 19. Loops 12, 13, 15 already passed (`docs/decisions.md`). Integration (roadmap step 5) becomes loop 22; the roadmap's "loop 20" label is renumbered in #08 | Owner: parity before Integration; 20 was used for opencode browser | Integration with parity as task 01; Integration only |
| D2 | Depth: every role that sees the screen (page registry `src/lib/auth/pages.ts`), 1280 and 390 px, structure diff + screenshots, same bar as loops 12/15 | Owner choice | Main role only; screenshots main role only |
| D3 | Target: `pnpm dev` in the worktree against the test copy (`gq-crm-dev`), signed in through the dev role panel; demo served from `docs/mockup`; Chrome profile "Agent" via Claude in Chrome | Live app has no example data and is Google-only | Live app with View as |
| D4 | Fix policy: fix in-loop when UI-only and at most ~3 files. Drift needing a migration, a new rule, a business answer, or more files goes to `docs/office-parity/drift-after-sweep.md` (screen, role, width, what differs, size) for loop 22. Deliberate deviations go to `docs/decisions.md` "Loop 21" | Owner: fix small, list large | Fix all; report only |
| D5 | Seeding: `seed:example` also loads `.env.local` (`--env-file-if-exists`), which already holds the test-copy secret from `connect:test-copy`; the seed script still refuses any URL but the test copy. Allow rule `Bash(pnpm seed:example)` in `.claude/settings.json`. No agent reads a `.env*` file | Owner chose an allow rule over an owner action; reuses the existing key, no secret copying | Owner runs seed; `cp .env.local .env.seed.dev` |
| D6 | Preflight: the allow rule (D5) is task 01. PR merge deploys and runs migrate-prod as in loops 07-19 (no migration expected). Claude in Chrome sign-in is an owner action | Plan-loop 1b | - |
| D7 | One branch `loop/21-parity-sweep` from `main` (loop 19 merged), one commit per task, one PR, rebase before merge | Established path | - |
| D8 | Each parity task first runs its drift doc's "check first" list (embeds, RPCs, RLS) by using the screen as the listed role; a server error there is a bug fix, not drift, and is fixed in-loop when ≤3 files | These were only proven in PGlite | Skipping them |
## Tasks
| # | Task | Status | Depends | Tier |
|---|---|---|---|---|
| 01 | Seed access, migrate and seed test copy | done | - | economy |
| 02 | Parity: loop 14 money and reports | done | 01 | standard |
| 03 | Parity: loop 16 People, HR, Tools | done | 01 | standard |
| 04 | Parity: loop 17 Log work, Site Work | done | 01 | standard |
| 05 | Parity: loop 18 Installation and DOs | done | 01 | standard |
| 06 | Parity: loop 18 Stock, Samples, Leftover | done | 01 | standard |
| 07 | Parity: loop 19 Claims | done | 01 | standard |
| 08 | Drift list, docs, merge | in-progress | 02-07 | standard |
<!-- status: todo | in-progress | done | blocked: <reason> -->
## Owner actions
- Before #02: Chrome profile "Agent" open with Claude in Chrome connected. If a task cannot reach Chrome it parks
  (blocked: owner) and the executor reports it.
- If #01 reports the test copy is not connected (`.env.local` missing in the main checkout): run `pnpm connect:test-copy`
  in the main checkout (paste the `gq-crm-dev` secret key and DB password), then resume `/execute-loop`.
## Log
<!-- one line per event: YYYY-MM-DD · #NN · result · next -->
2026-11-16 · plan · loop written; loop 19 merged; parity sweep before Integration (now loop 22) · next: #01
2026-11-16 · exec · worktree ../gq-projects-crm-loops/21-parity-sweep on loop/21-parity-sweep · next: #01
2026-11-16 · #01 · in-progress · delegated (economy)
2026-11-16 · #01 · decision · db:test-copy applied monthly_claims and monthly_claim_steps migrations (were pending) · expected after loop 19
2026-11-16 · #01 · decision · seed cleanup now deletes installers by name_key (migration backfill left rows that broke re-seed); insert/upsert use defaultToNull:false so omitted columns take defaults; 4 files, regression test added · seed was not re-runnable on the test copy
2026-11-16 · #01 · note · defaultToNull option not checked against postgrest-js docs (node_modules/@supabase read denied); typecheck and live seed pass
2026-11-16 · #01 · note · subagent printed one run of test sign-in passwords; they rotate every seed, already stale
2026-11-16 · #01 · done · check, typecheck, 2984 tests, db:test-copy up to date, seed:example exit 0 twice; Chrome sign-in left to #02 · next: #02
2026-11-16 · #02 · in-progress · delegated (standard)
2026-11-16 · #02 · decision · fixed /mofs 500 for Marketing Director (DO rows with unreadable MOF now skipped) plus 4 heading fixes; 13 drift rows to drift-after-sweep.md · bug and UI-only drift
2026-11-16 · #02 · decision · 390 px checked in a 390 px frame (Chrome window min ~500); side-by-side screenshots for a sample of cells, rest structure/overflow only · coverage thinner than D2, listed in report
2026-11-16 · #02 · note · test copy changed: Oct reports for Vanisha and Vernice, VO2 on MOF-2026-009; re-seed resets
2026-11-16 · #02 · done · check, typecheck, 2986 tests pass · next: #03
2026-11-16 · #03 · in-progress · delegated (standard)
2026-11-16 · #03 · decision · fixed Work commencement form A4 overflow, HR policy row and scheme summary wrap at 390; drift PE1-PE4, H1 to drift-after-sweep.md · UI-only fixes, bigger items for loop 22
2026-11-16 · #03 · note · some cells structure-only (Tools for 8 personas at 1280, HR as Jany at 390); A4 forms measured, not printed; test copy re-seeded clean
2026-11-16 · #03 · done · check, typecheck, 2986 tests pass · next: #04
2026-11-16 · #04 · in-progress · delegated (standard)
2026-11-16 · #04 · decision · fixed Log work wizard crash in Chrome 157 (useEffect returned a Promise), 7 UI fixes, 25 BM strings aligned to demo; drift LW1-2, SW1-5 · bug plus UI-only drift
2026-11-16 · #04 · note · Marketing persona unreachable (only a vacant Marketing Exec); 390 px not run for Akmal, Jess, Wai Mun, Vanessa; wizard steps 3-4 at 390 overflow-only · coverage gaps in report
2026-11-16 · #04 · done · check, typecheck, 2986 tests pass; test copy re-seeded · next: #05
2026-11-16 · #05 · in-progress · delegated (standard)
2026-11-16 · #05 · decision · BLOCKING live bug: issue_do_number, set_next_do_number, set_next_sample_pickup_number, save_sample_pickup updated a one-row table with no WHERE; Supabase (pg-safeupdate) refuses it, PGlite did not. Fixed by migration 20261119120000_numbering_where_clause.sql (same bodies plus `where id`), applied to test copy; test scripts/migrations-update-where.test.ts guards new migrations · D6 expected no migration; deploys on merge, no data loss
2026-11-16 · #05 · decision · fixed /installation crash for Eddie and Vanessa (mofs!inner), week default, headings, DO print scroll at 390 (shared print-layout); drift IN1-IN6, DO1 · bug plus UI-only drift
2026-11-16 · #05 · note · DO print/numbering/items dialog have app screenshots only (demo needs saved items); samples functions fixed here, #06 must recheck Samples in browser
2026-11-16 · #05 · done · check, typecheck, 2989 tests pass; test copy re-seeded · next: #06
2026-11-16 · #06 · in-progress · delegated (standard)
2026-11-16 · #06 · decision · fixed Sales Director 500 on /stock/leftover (mofs!inner), table overflow at 1280, print toolbar title at 390; drift ST1-ST6 · bug plus UI-only drift
2026-11-16 · #06 · note · Samples pickup/next-number saves re-run in browser after #05 migration, all pass; scan of every .update/.delete in src and migrations found no other unfiltered write
2026-11-16 · #06 · done · check, typecheck, 2989 tests pass; test copy re-seeded · next: #07
2026-11-16 · #07 · in-progress · delegated (standard)
2026-11-16 · #07 · decision · 3 bugs fixed: HR & Accounts 500 on All claims/review (profiles embed null; new security-definer claim_people() limited to md/accounts, migration 20261120100000), review page crash for every role (client helper called from server page), MD could not save claim/commission settings (app_settings upsert writes key; migration 20261120110000 grants update (key); policies still decide who writes which key, accounts policy pins key='claims') · no data loss, reviewed by orchestrator
2026-11-16 · #07 · note · stock settings and site reminders share the app_settings upsert but were not re-run in browser; CL1-CL4 drift; CL2 appeal/decide dialogs and CL3 BM/Chinese labels not run (no example data / no language switch)
2026-11-16 · #07 · done · check, typecheck, 2997 tests, guard:migrations pass; test copy re-seeded · next: #08
2026-11-16 · #08 · in-progress · delegated (standard)
