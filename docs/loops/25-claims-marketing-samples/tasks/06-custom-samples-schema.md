---
tier: frontier
why: two-step return and give-away state rules per role in RLS, plus a new storage area
depends: [01]
---
# 06 Custom samples schema, photo storage, loan-days setting
## Goal
Tables for hand-tufted custom samples and their loans, with the demo's states and role rights in the database.
## Context
Read `00-shared-context.md`. Decision D11. Spec `demo-changes.md` §3.1-3.7. Separate from the existing stock
`samples` table (different thing). Storage helper: `src/lib/storage/` (areas, `can_attach` per area, see migration
`20261120170000_storage_rls_hardening.sql`).
## Files to touch
New migration; `supabase/tests/custom-samples.test.ts`; storage area registration.
## Steps
1. `custom_samples`: code (unique, default next `TS-###`), received_on, design_name, design_no, supplier, size,
   qty (>=1), photo path, notes, recorded_by; gift fields (given_on, given_to, gift_reason (>= 5 chars), given_by).
2. `custom_sample_loans`: sample, salesperson, customer (text; link to company if the app's pattern allows),
   project, out_on, due_on, returned_marked_on (borrower step), back_on, back_by, given_away bool, log of
   "not received" (column or table; decide, log).
3. Rules: one open loan per sample; borrow only when Available; give away only once, closes the open loan.
4. RLS: admins = md, designer, support, ssup, marketing, director (not accounts) record/edit/delete (delete only with
   no loans and not given); sellers (sales, bd, director, `sells`) and md borrow; borrower marks returned; admins
   confirm/deny; admin or current borrower gives away. All except site read (match page access).
5. `app_settings` key `customSamples` `{ loanDays: 14 }`; changing it doesn't touch existing loans.
6. Storage area `custom-samples` for the photo (image types only).
## Acceptance
- PGlite tests for each rule and role above, incl. accounts read-only and site no access.
- `pnpm check && pnpm typecheck && pnpm test` pass.
## Out of scope
UI.
