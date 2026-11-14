---
model: sonnet
effort: high
why: Normal UI feature with URL-param state and parity check
depends: [01]
---
# 02 Companies / All people toggle + Companies table
## Goal
`/customers` shows the demo's Companies / All people toggle; Companies is the table from task 01 with filters.
## Context
- Demo `vCust()` ~2151-2180. All people = today's contact table, unchanged.
- Toggle and filters live in URL params (pattern: `customer-filters.ts`, `calendar/calendar-params.ts`).
- Reuse `/dev/components` pieces and `rating-badge.tsx`, `customer-health-badge.tsx`; theme tokens only.
## Files to touch
- `src/app/(app)/customers/page.tsx`
- `src/app/(app)/customers/companies-table.tsx` (new)
- `src/app/(app)/customers/customer-filters.ts` (+ test) for the view param
## Steps
1. View param `view=companies|people`, default as the demo. 2. Table + filter bar. 3. Row click opens the company
sheet (task 03; link to `?company=<id>` now).
## Acceptance
- Checks pass. Parity per `docs/office-parity/parity.md` for md, director, bd, sales (desktop + 390px).
## Out of scope
Company sheet contents.
