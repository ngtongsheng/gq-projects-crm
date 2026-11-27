---
tier: frontier
why: judgment-heavy review of ~24k changed lines; findings drive tasks 07-09
depends: [04]
---
# 05 Audit A: delta deep review (loops 23-25)
## Goal
Report section A: ranked, evidence-backed findings for code changed since `132f454`. Read only, no code changes.
## Context
Read `00-shared-context.md`. Changed files: `git diff --stat 132f454...HEAD -- src scripts supabase`.
Dimensions: bugs and robustness (unhandled errors, silent catches, races, missing input validation at boundaries),
performance (serial awaits, N+1, unbounded queries, missing indexes for new filters, client bundle weight),
duplication with existing helpers, dead code, noise comments (what-not-why, stale, commented-out code), naming,
oversized files (> ~400 lines or mixed responsibilities), strict types (`any`, casts, ts-ignore).
Delegate file batches to economy subagents for locating candidates if needed; verify every finding yourself.
## Files to touch
`docs/audits/2026-11-27-code-audit-round-3.md` (create: header with scope, base commit, baseline checks; section A).
## Steps
1. Baseline: run checks, record results in the header.
2. Review by feature area (travel claims, marketing, custom samples, reminders, loop 23-24 changes).
3. Write findings per the shared-context row format; mark `fix: 07|08|09` only when D3 allows.
   Add a short "Done well" line per area.
## Acceptance
Report exists; every finding has `file:line` evidence and a fix/debt tag; no source file changed
(`git status --short -- src scripts supabase` empty). `pnpm check` passes.
## Out of scope
Fixing anything. Re-reporting rounds 1-2 findings or debt.md items.
