---
model: opus
effort: medium
why: Bulk ownership change across customers and projects; must leave commission untouched
depends: []
---
# 07 Resignation handover
## Goal
When marking a person as left (loop 11 flow), admin picks who receives their customers and open projects. One RPC
moves ownership in a transaction and writes a handover list (what moved, to whom, when) shown on both people.
Commission and MOF salesperson fields unchanged (D5).
## Files to touch
- `supabase/migrations/<ts>_resignation_handover.sql` (new) + test, People leave flow component, handover list view
## Acceptance
- `pnpm check`, `pnpm typecheck`, `pnpm test`, `pnpm guard:migrations` pass. Tests: customers and open projects move;
  closed projects and MOF commission do not; only admin may run it.
