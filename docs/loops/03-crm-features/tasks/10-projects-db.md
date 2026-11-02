---
model: sonnet
effort: high
why: table + form on established patterns
depends: [06]
---
# 10 Projects (pipeline) data + form
## Goal
Sales create and edit pipeline projects for a customer, with stage, value, quantity, PIC, next action and lead source.
## Context
- Read `docs/loops/03-crm-features/assets/conventions.md` first; it applies in full.
- Spec: `docs/loops/03-crm-features/assets/prototype-spec.md`.
- Prototype anchors (grep): `Quotation Sent`, `Negotiation`, `SOURCES`, `nextAction`, `commission type`
- Decisions: see `docs/loops/03-crm-features/loop.md` (D1-D12).
## Files to touch
- supabase/migrations/<ts>_projects.sql
- src/app/(app)/projects/schemas.ts
- src/app/(app)/projects/actions.ts (+ test)
- src/app/(app)/projects/project-form.tsx
- src/app/(app)/customers/[id]/page.tsx
## Steps
1. Table `projects` (contact_id, name, lead_source, stage check of the 8 stages, qty_sqft, value, pic_id, support_id, passed_by, next_action, next_action_date, commission_type, notes, stage_changed_at, updated_at trigger). RLS: all read; PIC/support/managers write.
2. Lead sources from the prototype SOURCES list as a zod enum.
3. Customer detail lists its projects.
## Acceptance
- Test: validation, stage_changed_at set only on stage change, permission.
- `pnpm check && pnpm typecheck && pnpm test` pass; PR checks green; merged per conventions "Done".
## Out of scope
Board view (#11).
