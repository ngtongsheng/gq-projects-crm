---
tier: standard
why: changes a shared function signature across 5 call sites and their test mocks
depends: []
---
# 02 Cache `getLastCompletedDays` per request
## Goal
The `customer_last_activity` view is fetched once per request however many components ask for it.
## Context
Audit P2, verified: `getLastCompletedDays(supabase)` in `src/app/(app)/activities/last-activity.ts` queries the view with
no limit and no caching. Callers (5): `customers/company-detail.ts:72`, `customers/customer-data.ts:43`,
`customers/company-data.ts:40`, `dashboard/quiet-customers.tsx:33`, `dashboard/customer-data.ts:24`. A dashboard or
company page makes 2-3 of these in one render. The repo already uses React `cache()` for holidays, the team directory
and the profile: copy that pattern (find it with `grep -rn "cache(" src/lib`). Decision D4: no-argument function that
creates its own client via `createClient()` inside the cached function.
## Files to touch
- `src/app/(app)/activities/last-activity.ts` and `last-activity.test.ts`
- the 5 caller files above (drop the argument; remove a `supabase` variable only if it becomes unused)
## Steps
1. Read `last-activity.ts` and its test, and one existing `cache()` helper.
2. Wrap in `cache(async () => ...)`, create the client inside, same parsing and error message.
3. Update the 5 callers and any test mock of `getLastCompletedDays` or the client.
## Acceptance
- `pnpm check`, `pnpm typecheck`, `pnpm test` pass.
- `grep -rn "getLastCompletedDays(supabase" src` returns nothing.
## Out of scope
Adding a limit to the view query, the P3 dashboard fan-out, other views.
