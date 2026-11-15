---
model: sonnet
effort: high
why: Two views of one entity with a purchasing reply flow
depends: [05]
---
# 07 FOB Enquiry
## Goal
Global FOB Enquiry table for purchasing (support role) and a per-quote panel; salesperson raises an enquiry, purchasing
replies (FOB, currency, fx, shipping, notes), reply feeds the item's landed cost.
## Context
- Demo GQC FOB enquiry screens; entity fields in the drift doc.
## Files to touch
- `src/app/(app)/costing/enquiries/page.tsx` (new), `enquiry-panel.tsx` (new)
- `src/app/(app)/costing/enquiry-actions.ts` (new) + test
## Acceptance
- Checks pass; tests: only purchasing replies; reply records who/when. Parity for support and sales.
## Out of scope
Supplier POs.
