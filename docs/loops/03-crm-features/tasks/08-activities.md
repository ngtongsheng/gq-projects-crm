---
model: sonnet
effort: high
why: CRUD plus feeding customer health
depends: [06]
---
# 08 Activities (visits, calls)
## Goal
Sales log and plan activities against a customer; the customer page lists them and the health flag uses the last completed one.
## Context
- Read `docs/loops/03-crm-features/assets/conventions.md` first; it applies in full.
- Spec: `docs/loops/03-crm-features/assets/prototype-spec.md`.
- Prototype anchors (grep): `Walk-in`, `Online meeting`, `purpose`, `outcome`
- Decisions: see `docs/loops/03-crm-features/loop.md` (D1-D12).
## Files to touch
- supabase/migrations/<ts>_activities.sql
- src/app/(app)/activities/actions.ts (+ test)
- src/app/(app)/activities/activity-form.tsx
- src/app/(app)/customers/[id]/page.tsx
- src/app/(app)/customers/page.tsx
## Steps
1. Table `activities` (contact_id, owner_id, type, purpose, outcome, starts_at timestamptz, status planned/completed/cancelled). RLS: all read; owner and managers write.
2. Form from customer page and a 'Log activity' button; complete/cancel quick actions.
3. Customer list and detail compute health from the latest completed activity (one query, not N+1).
## Acceptance
- Test: status transitions; non-owner cannot edit.
- `pnpm check && pnpm typecheck && pnpm test` pass; PR checks green; merged per conventions "Done".
## Out of scope
Calendar view (#09).
