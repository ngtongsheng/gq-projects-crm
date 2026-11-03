---
model: haiku
effort: low
why: mechanical checks and git
depends: [01, 02, 03]
---
# 04 Final checks, links, PR, merge
## Goal
Loop branch merged to main (D6).
## Files to touch
- docs/loops/08-readme-features/loop.md (log)
## Steps
1. Check every relative link in README.md and docs/features.md resolves to a file.
2. `pnpm check && pnpm typecheck && pnpm test`.
3. Open PR, wait for checks, merge, delete branch and worktree. Log the result in loop.md.
## Acceptance
- All three commands pass; PR merged; `git log main -1` shows the merge.
## Out of scope
Any content rewrite.
