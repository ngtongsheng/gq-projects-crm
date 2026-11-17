---
tier: standard
why: one form with live total, validation and a print sheet, on a schema already built
depends: [02]
---
# 03 My travel claim: form, submit/update, print
## Goal
A claimant opens "My travel claim", picks a month, keys in the summary, submits to Jany, updates until released,
and prints the claim form.
## Context
Read `00-shared-context.md`. Spec `demo-changes.md` §1.1 (month selector: claim month of today + 5 previous,
label "Nov 2026 (26 Oct – 25 Nov)"), §1.2 (fields, hints, status pill, buttons, validation, toasts), §1.5 (print),
§1.8 (entitlement `clCap` and hotel budget `hotelCap` from HR packages and outstation rules, which exist:
`src/app/(app)/hr/package-*.ts`, `outstation_rules`). Old page for patterns: `src/app/(app)/claims/my-claim*.tsx`,
`claim-print-sheet.tsx`.
## Files to touch
New files under `src/app/(app)/claims/` (e.g. `travel-claim-form.tsx`, `travel-claim-actions.ts` + test,
`travel-claim-data.ts`, `travel-claim-print.tsx`, `claim-month.ts` + test); `page.tsx` routes claimants to it; i18n.
## Steps
1. Claim-month helpers (claim month of a date, period from/to) with tests at cut-off edges (25th, 26th, Dec->Jan).
2. Server action: validate with zod (at least one amount > 0; description when others > 0); submit sets status
   submitted; "Update" keeps it submitted.
3. Form per §1.2 incl. entitlement and "over by" warning, OT only for site, live total, report status line, Jany's
   final amount/note banner.
4. Print per §1.5.
## Acceptance
- Tests: claim-month edges; action validation and own-claim only.
- `pnpm check && pnpm typecheck && pnpm test` pass; in `pnpm dev` a salesperson submits and prints a claim.
- Parity (salesperson, site supervisor) per shared context.
## Out of scope
Accounts list (04); removing the old page code (05).
