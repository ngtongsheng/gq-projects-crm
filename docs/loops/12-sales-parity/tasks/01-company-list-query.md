---
model: sonnet
effort: high
why: Data transform with date rules (last visit, Quiet / No visit Nd) that drives filters; needs tests
depends: []
---
# 01 Company list query + status rules
## Goal
A server function returns the Companies table rows the demo shows, team-scoped by existing RLS.
## Context
- Demo `vCust()` ~2151-2180 and status rules ~1855, ~2160-2178: columns Company, Type (+ rating, account),
  Salespeople, People, Last visit, Status (Active / Quiet / No visit Nd). Copy the day thresholds exactly.
- D1: salespeople = distinct owners of the company's contacts (`contact_owners`), first two shown.
- Tables: `companies`, `contacts`, `contact_owners`, `activities` (completed visits give "last visit").
- Existing contact list loader: `src/app/(app)/customers/customer-data.ts`; filters: `customer-filters.ts`.
## Files to touch
- `src/app/(app)/customers/company-data.ts` (new) + `company-data.test.ts`
- `src/app/(app)/customers/company-status.ts` (new, pure) + test
## Steps
1. Pure `companyStatus(lastVisit, today)` with the demo thresholds. 2. Loader: one query per table, join in memory
or a view if simpler; no N+1. 3. Filters: search, salesperson, type, status (pure, tested).
## Acceptance
- `pnpm check`, `pnpm typecheck`, `pnpm test` pass; tests cover status boundaries and salesperson derivation.
## Out of scope
UI (task 02).
