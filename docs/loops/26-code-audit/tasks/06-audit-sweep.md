---
tier: frontier
why: tool output is noisy; separating real dead code and duplication from false positives takes judgment
depends: [05]
---
# 06 Audit B: repo-wide sweep
## Goal
Report section B: repo-wide dead code, duplication, comment noise, oversized files, error-handling patterns.
Read only, no code changes.
## Context
Read `00-shared-context.md` and section A of the report (don't duplicate it).
Tools (run once, not added as deps): `pnpm dlx knip` (unused files, exports, deps), `pnpm dlx jscpd src scripts
--min-lines 10 --reporters console`. Next.js routes, `page.tsx`/`layout.tsx`/`route.ts`, shadcn `components/ui`
and i18n dictionaries are entry points or vendored: verify before calling them unused.
## Files to touch
`docs/audits/2026-11-27-code-audit-round-3.md` (section B, plus a "Dependencies" table: package, current, latest,
action taken in 02-04 or deferred).
## Steps
1. knip: verify each unused export/file/dependency by grep; list only confirmed ones.
2. jscpd: group clones by what they do; propose the existing helper to reuse or a new one-responsibility module.
3. Comments: grep for commented-out code and what-comments in `src/`; list files with the most.
4. Size: files > ~400 lines with mixed responsibilities (skip tests, i18n dictionaries, `key-parity-known-gaps.ts`
   unless it is itself dead weight; check).
5. Errors: `catch` blocks that swallow, `console.error` outside `logServerError` on money/HR paths.
6. Tag each finding `fix: 07|08|09` or `debt`; rank.
## Acceptance
Section B and Dependencies table exist; every finding verified with evidence; no source changes. `pnpm check` passes.
## Out of scope
Fixing anything.
