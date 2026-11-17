---
tier: standard
why: list, two dialogs and a detail sheet on a ready schema
depends: [06]
---
# 07 Custom samples list, record/edit, borrow, detail
## Goal
The Custom samples page shows tiles, filters and the list; admins record and edit samples with a photo; sellers
borrow; anyone with access opens the detail with loan history.
## Context
Read `00-shared-context.md`. Spec `demo-changes.md` §3.2-3.5, §3.8. Patterns: `src/app/(app)/samples/` (list,
dialogs, filters + tests).
## Files to touch
New `src/app/(app)/custom-samples/` (page, data, actions + test, list, record dialog, borrow dialog, detail sheet,
status helper + test); flip `tuft` to built in `pages.ts`; i18n.
## Steps
1. Status and overdue helper (Given away > Returned – to confirm > On loan > Available; days overdue) with tests.
2. List per §3.3 (tiles, search, filter incl. "Borrowed by me", sort most overdue first).
3. Record/edit per §3.4 with photo upload through the storage helper (resize like other image uploads in the app).
4. Borrow per §3.5 (due = borrow date + loanDays; salesperson select only for admin non-sellers).
5. Detail sheet per §3.8 without return/give-away buttons (08).
## Acceptance
- Helper and action tests pass; `pnpm check && pnpm typecheck && pnpm test` pass.
- In `pnpm dev`: designer records TS-001 with a photo, salesperson borrows it.
- Parity (designer, sales, md).
## Out of scope
Return, give away, reminders, settings (08).
