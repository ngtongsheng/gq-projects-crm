---
model: opus
effort: medium
why: ownership-based RLS is the template for every later table
depends: [01]
---
# 04 Companies + contacts in the database
## Goal
Companies and contacts exist in the database with ownership, and the rules let everyone read all, owners and managers edit, and nobody delete.
## Context
- Read `docs/loops/03-crm-features/assets/conventions.md` first; it applies in full.
- Spec: `docs/loops/03-crm-features/assets/prototype-spec.md`.
- Prototype anchors (grep): `companyType`, `rating`, `acctType`, `Pass-down`, `passedBy`, `owners`
- Decisions: see `docs/loops/03-crm-features/loop.md` (D1-D12).
## Files to touch
- supabase/migrations/<ts>_customers.sql
- src/app/(app)/customers/schemas.ts (+ test)
## Steps
1. Read the prototype's customer and company records (anchors) first; note anything the spec missed in loop.md Log.
2. Tables: `companies` (name unique case-insensitive, company_type, address, notes); `contacts` (company_id, name, mobile unique after normalising to digits, title, rating 1-5, account_type check own/pass_down/company, passed_by uuid profile, notes, archived_at); `contact_owners` (contact_id, profile_id, primary key both) so a contact can have two owners.
3. RLS: select for all authenticated; insert for all (creator becomes owner via trigger); update where caller is an owner or `is_manager()`; contact_owners changes only by managers or by the insert trigger. No delete grants (archive instead).
4. `schemas.ts`: zod schemas for company and contact forms, mobile normaliser (Malaysian formats: +60, 60, 0 prefixes) as a pure tested function.
## Acceptance
- Test: mobile normaliser; schema rejects bad rating/account type.
- SQL check on the test copy (via PR checks): migration applies.
- `pnpm check && pnpm typecheck && pnpm test` pass; PR checks green; merged per conventions "Done".
## Out of scope
UI.
