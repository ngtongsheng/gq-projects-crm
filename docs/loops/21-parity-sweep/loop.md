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
| 01 | Seed access, migrate and seed test copy | in-progress | - | economy |
| 02 | Parity: loop 14 money and reports | todo | 01 | standard |
| 03 | Parity: loop 16 People, HR, Tools | todo | 01 | standard |
| 04 | Parity: loop 17 Log work, Site Work | todo | 01 | standard |
| 05 | Parity: loop 18 Installation and DOs | todo | 01 | standard |
| 06 | Parity: loop 18 Stock, Samples, Leftover | todo | 01 | standard |
| 07 | Parity: loop 19 Claims | todo | 01 | standard |
| 08 | Drift list, docs, merge | todo | 02-07 | standard |
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
