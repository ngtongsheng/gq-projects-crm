---
model: sonnet
effort: high
why: small workflow with permission rules
depends: [05]
---
# 07 Ownership requests
## Goal
A salesperson can request ownership of someone else's customer; the director or MD approves (owner changes) or rejects; the requester sees the outcome.
## Context
- Read `docs/loops/03-crm-features/assets/conventions.md` first; it applies in full.
- Spec: `docs/loops/03-crm-features/assets/prototype-spec.md`.
- Prototype anchors (grep): `ownership`, `request`
- Decisions: see `docs/loops/03-crm-features/loop.md` (D1-D12).
## Files to touch
- supabase/migrations/<ts>_ownership_requests.sql
- src/app/(app)/customers/ownership/page.tsx
- src/app/(app)/customers/ownership/actions.ts (+ test)
- src/app/(app)/customers/page.tsx
## Steps
1. Table `ownership_requests` (contact_id, requested_by, reason, status pending/approved/rejected, decided_by, decided_at). RLS: requester and managers read; anyone inserts their own; only md/director decide.
2. Approve runs in one database function (security definer, checks md/director) that replaces the owners and marks the request.
3. Requests page for md/director with pending count shown in nav; customer list enables the 'Request ownership' button.
## Acceptance
- Tests: only md/director can decide; approving swaps owners; a second pending request for the same contact by the same person is rejected.
- `pnpm check && pnpm typecheck && pnpm test` pass; PR checks green; merged per conventions "Done".
## Out of scope
Notifications outside the app.
