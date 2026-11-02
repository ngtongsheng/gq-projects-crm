---
model: sonnet
effort: high
why: standard CRUD screen on the #04 pattern
depends: [02, 03, 04]
---
# 05 Customer list + add/edit
## Goal
Customers screen lists all contacts with company, owners, rating and account type; anyone can add one; owners and managers can edit; a duplicate mobile shows who already owns that customer.
## Context
- Read `docs/loops/03-crm-features/assets/conventions.md` first; it applies in full.
- Spec: `docs/loops/03-crm-features/assets/prototype-spec.md`.
- Prototype anchors (grep): `renderCustomers`, `Customers`
- Decisions: see `docs/loops/03-crm-features/loop.md` (D1-D12).
## Files to touch
- src/app/(app)/customers/page.tsx
- src/app/(app)/customers/actions.ts (+ test)
- src/app/(app)/customers/contact-form.tsx
- src/lib/auth/nav-sections.ts
## Steps
1. List with search (name, company, mobile) and filters (owner, rating, account type), using DataTable.
2. Add/edit dialog; company picked from existing or created inline.
3. On a duplicate mobile, the action returns the existing contact and owner names; UI offers 'Request ownership' (wired in #07, disabled until then).
4. Add the Customers nav entry.
## Acceptance
- Tests: action rejects edits by a non-owner non-manager; duplicate mobile returns owner info.
- `pnpm check && pnpm typecheck && pnpm test` pass; PR checks green; merged per conventions "Done".
## Out of scope
Health flags, detail page.
