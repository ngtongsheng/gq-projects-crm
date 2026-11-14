---
model: opus
effort: medium
why: Number issuing must be race-free and never reuse voided numbers
depends: []
---
# 04 DO numbering + lines migration
## Goal
Per D2: DO table (job, number, void flag, date, passed to supplier, partial/final), DO lines (product, code,
description, batch, unit, qty, covers), void list, next-number setting, `issue_do_number` function, delivered-to-date
per item. RLS.
## Acceptance
- `pnpm check`, `pnpm typecheck`, `pnpm test`, `pnpm guard:migrations` pass. Tests: concurrent issue gives distinct numbers; voided never reused; next number must exceed last used;
delivered-to-date sums across DOs.
