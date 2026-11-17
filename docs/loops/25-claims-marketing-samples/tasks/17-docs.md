---
tier: economy
why: writing given content into existing docs
depends: [01, 02, 03, 04, 05, 06, 07, 08, 09, 10, 11, 12, 13, 14, 15, 16]
---
# 17 Docs
## Goal
Docs reflect loop 25.
## Context
Read `00-shared-context.md` and the loop log in `../loop.md`.
## Files to touch
`docs/decisions.md` (loop 25 section: D1-D14 and deviations logged by tasks), `docs/features.md`,
`docs/whats-new.md` (plain words for Vicky: travel claim, marketing expense, custom samples), `docs/debt.md`
(claim receipt files left in storage; anything tasks logged), `docs/office-parity/roadmap.md` (row for loop 25),
`docs/glossary.md` (custom sample, prepaid account, release).
## Acceptance
- `pnpm check` passes.
## Out of scope
Code.
