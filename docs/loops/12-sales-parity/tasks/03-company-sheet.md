---
model: sonnet
effort: high
why: New sheet with owner-gated actions; reuses existing forms
depends: [02]
---
# 03 Company sheet
## Goal
A company row opens the demo's company sheet: people, visits, Edit company, Add person, Log visit.
## Context
- Demo `sheetCo*` ~2183-2210.
- D1: Add person only for derived owners (and md); server action enforces it, not just the button.
- Reuse `contact-form.tsx`, existing company save action in `customers/actions.ts`, `calendar/add-activity-dialog.tsx`.
## Files to touch
- `src/app/(app)/customers/company-sheet.tsx` (new)
- `src/app/(app)/customers/actions.ts` (+ test) for the owner check on add person
- `src/app/(app)/customers/page.tsx`
## Acceptance
- Checks pass; test: non-owner adding a person to a company is refused. Parity for md, sales (desktop + 390px).
## Out of scope
Changing ownership rules or `/customers/ownership`.
