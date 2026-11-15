---
model: sonnet
effort: high
why: Normal list + create flow with URL-param filters and parity
depends: [03]
---
# 04 Register + New quote
## Goal
`/costing` Register (search, status filter, sort) and New quote (project, customer, salesperson, optional project
link) as in the demo; the `cost` page in `src/lib/auth/pages.ts` is marked built.
## Context
- Demo GQC app register/new screens (~436-1450; `vCost` ~1920 mounts it). Reuse `data-table.tsx`, `page-header.tsx`,
  `status-badge.tsx`; theme tokens only.
## Files to touch
- `src/app/(app)/costing/page.tsx` (new), `register-table.tsx` (new)
- `src/app/(app)/costing/new/page.tsx` (new), `quote-actions.ts` (new) + test
- `src/lib/auth/pages.ts` (flip `built` for `cost` only)
## Acceptance
- Checks pass; action test: quote no assigned, Zod rejects bad input. Parity for md, sales, support (desktop + 390px).
## Out of scope
Quote record.
