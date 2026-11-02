---
model: sonnet
effort: high
why: jobs table and derived delivery status
depends: [14]
---
# 17 Delivery + installation jobs, DOs
## Goal
Purchasing schedules delivery, installation and site-measurement jobs per MOF, records DOs with transporter and signed-returned flag, and the MOF shows its delivery status.
## Context
- Read `docs/loops/03-crm-features/assets/conventions.md` first; it applies in full.
- Spec: `docs/loops/03-crm-features/assets/prototype-spec.md`.
- Prototype anchors (grep): `DO`, `Lalamove`, `Partially delivered`, `Site measurement`, `Postponed`
- Decisions: see `docs/loops/03-crm-features/loop.md` (D1-D12).
## Files to touch
- supabase/migrations/<ts>_jobs.sql
- src/app/(app)/installation/actions.ts (+ test)
- src/app/(app)/installation/job-form.tsx
- src/lib/domain/delivery-status.ts (+ test)
- src/app/(app)/mofs/[id]/page.tsx
## Steps
1. Tables `jobs` (mof_id, type, status, scheduled_on, time, crew/installer, assigned site supervisor, notes) and `delivery_orders` (mof_id, job_id, running_no, do_no, transporter, delivered_on, signed_returned). RLS: read all; write md/director/support; site role updates status of jobs assigned to them.
2. `delivery-status.ts`: Not delivered / Delivery scheduled / Partially delivered / Fully delivered from jobs and DOs (verify the prototype's rule for 'fully').
## Acceptance
- Tests: delivery status derivation; DO number format.
- `pnpm check && pnpm typecheck && pnpm test` pass; PR checks green; merged per conventions "Done".
## Out of scope
Calendar (#18).
