---
model: sonnet
effort: high
why: small request/confirm workflow
depends: [17]
---
# 19 Site supervisor booking
## Goal
Sales book a site supervisor for a purpose and date; the supervisor confirms or declines; both see the booking on the installation calendar.
## Context
- Read `docs/loops/03-crm-features/assets/conventions.md` first; it applies in full.
- Spec: `docs/loops/03-crm-features/assets/prototype-spec.md`.
- Prototype anchors (grep): `book`, `Awal`, `shooting`, `meet client`
- Decisions: see `docs/loops/03-crm-features/loop.md` (D1-D12).
## Files to touch
- supabase/migrations/<ts>_site_bookings.sql
- src/app/(app)/installation/booking-actions.ts (+ test)
- src/app/(app)/installation/booking-form.tsx
- src/app/(app)/installation/page.tsx
## Steps
1. Table `site_bookings` (supervisor_id, requested_by, purpose check of 6, project_id or mof_id, date, time, notes, status requested/confirmed/declined, decline_reason). RLS: read all; insert by sales/managers; decide only the booked supervisor.
2. Pending bookings count for site role.
## Acceptance
- Tests: only the booked supervisor decides; declined needs a reason if the prototype requires one.
- `pnpm check && pnpm typecheck && pnpm test` pass; PR checks green; merged per conventions "Done".
## Out of scope
Supervisor availability checks.
