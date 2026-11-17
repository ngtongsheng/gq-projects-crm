---
tier: frontier
why: money table with per-role RLS, a release gate across three report tables and state rules in the database
depends: [01]
---
# 02 Travel claims schema, RLS, cut-off setting
## Goal
`public.travel_claims` holds one claim per person per claim month with the demo's states and rules enforced in the
database.
## Context
Read `00-shared-context.md`. Decisions D1, D3, D7. Spec `demo-changes.md` §1.1-1.7. Old shape for reference:
`supabase/migrations/20261119100000_monthly_claims.sql` (claim month, eligibility, report kinds). Do NOT drop old
tables here (task 05).
## Files to touch
New migration; `supabase/tests/travel-claims.test.ts`; generated DB types if the repo keeps them.
## Steps
1. Table: `profile_id` (default auth.uid()), `month` (first of month), unique (profile_id, month); amounts
   `petrol_parking_toll`, `outstation`, `hotel`, `others`, `overtime` (numeric(12,2) >= 0, nullable = not keyed);
   `others_description` (required when others > 0); `remark`; `status` draft|submitted|released;
   `submitted_on`, `updated_on`; `final_amount` + `final_note` (Jany's note, shown to the person);
   `verified_with_vicky_on` date; `released_on`, `released_by`; created_at.
2. `overtime` only for job role `site` (check via trigger or action; decide, log).
3. RLS: eligible claimants (sales, bd, director, site, or `sells`; reuse the old eligibility helper if it exists)
   read/insert/update their own row while not released, only claimant columns. md and accounts read all and update
   only `final_amount`, `final_note`, `verified_with_vicky_on`, `status` (submitted->draft Return, submitted->released).
   Released is final.
4. Release gate in the database: release refused unless that person's monthly report for the SAME month is
   Submitted or Reviewed (report table by kind: site, director/bd, else sales; reuse existing report helpers).
5. `app_settings` `claims` check: only `cutOffDay` (number) required; keep the stored value (D7). Update the
   upsert/validator code that reads it if this breaks typecheck.
## Acceptance
- PGlite tests: own claim CRUD; another staff cannot read it; accounts can release only when the same-month report
  is submitted; release refused otherwise; released row cannot be changed; Return goes to draft; overtime refused
  for non-site; others without description refused.
- `pnpm check && pnpm typecheck && pnpm test` pass.
## Out of scope
UI; dropping old tables.
