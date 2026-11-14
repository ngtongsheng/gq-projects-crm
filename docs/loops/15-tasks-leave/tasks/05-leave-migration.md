---
model: opus
effort: medium
why: Schema plus settings and approval-aware RLS (team lead, accounts sees MC)
depends: []
---
# 05 Leave migration
## Goal
Leave requests (person, type, from, to, half-day flags, days, reason, status Pending/Approved/Rejected/Cancelled,
approval steps, slip attachment, "original given to HR"), per-person per-year entitlement overrides (al, carry, mc),
leave policy in `app_settings` (D7). RLS: own rows; approvers per D4; md, director, accounts read team leave.
## Context
- `docs/office-parity/drift-new-modules.md` "Leave"; demo `vLeave` ~3206, `entDefault` ~3188, `lvBal` ~3191.
- 8 leave types listed in the drift doc; only Annual and Emergency deduct annual leave.
## Files to touch
- `supabase/migrations/<ts>_leave.sql` (new), `supabase/tests/leave.test.ts` (new), generated DB types
## Acceptance
- `pnpm check`, `pnpm typecheck`, `pnpm test`, `pnpm guard:migrations` pass. Tests: RLS per role incl. team lead and
  accounts-MC; nobody approves own leave.
