---
model: sonnet
effort: high
why: availability and expiry logic
depends: [14]
---
# 23 Stock items + reservations
## Goal
Stock lists items with available quantity; sales request reservations for a project; the stock arranger confirms; reservations expire after the hold days with a warning before.
## Context
- Read `docs/loops/03-crm-features/assets/conventions.md` first; it applies in full.
- Spec: `docs/loops/03-crm-features/assets/prototype-spec.md`.
- Prototype anchors (grep): `Stock reserved`, `SKU`, `hold`, `Released`, `arrange`
- Decisions: see `docs/loops/03-crm-features/loop.md` (D1-D12).
## Files to touch
- supabase/migrations/<ts>_stock.sql
- src/app/(app)/stock/page.tsx
- src/app/(app)/stock/actions.ts (+ test)
- src/lib/domain/reservation.ts (+ test)
- src/lib/auth/nav-sections.ts
## Steps
1. Tables `stock_items` (sku unique, supplier, collection, qty, unit), `stock_reservations` (item_id, qty, project_id, reserved_by, status check of 6, reserved_at, expires_on), and `app_settings` (key text pk, value jsonb, admin/md write, all read) seeded with `stock_hold_days`=14, `stock_warning_days`=3. Later tasks reuse app_settings.
2. Writes: canEditStock (md/director/support or arranges_stock). Sales insert requests only.
3. `reservation.ts`: available = qty - live reservations - sold; expiring soon; expired. Expiry is derived on read (no cron).
## Acceptance
- Tests: availability, live statuses, expiry and warning boundaries.
- `pnpm check && pnpm typecheck && pnpm test` pass; PR checks green; merged per conventions "Done".
## Out of scope
Supplier emails beyond mailto.
