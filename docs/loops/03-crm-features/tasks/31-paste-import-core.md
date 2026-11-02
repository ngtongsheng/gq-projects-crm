---
model: opus
effort: medium
why: shared parse/validate/preview flow that touches live data
depends: [04]
---
# 31 Paste import: parser + companies
## Goal
Admins paste rows copied from a spreadsheet, see a preview with per-row errors, and save only valid rows; first used for companies and contacts.
## Context
- Read `docs/loops/03-crm-features/assets/conventions.md` first; it applies in full.
- Spec: `docs/loops/03-crm-features/assets/prototype-spec.md`.
- Prototype anchors (grep): `Paste from sheet`, `paste`
- Decisions: see `docs/loops/03-crm-features/loop.md` (D1-D12).
## Files to touch
- src/lib/import/parse-tsv.ts (+ test)
- src/lib/import/import-plan.ts (+ test)
- src/components/app/paste-import-dialog.tsx
- src/app/(app)/customers/import-actions.ts (+ test)
## Steps
1. `parse-tsv.ts`: tab-separated, quoted cells from Excel/Sheets, header row mapped by fuzzy header names to fields.
2. `import-plan.ts`: validate each row with the zod schema; mark duplicates (by name/mobile) as skip or update per the dialog choice; returns a plan.
3. Dialog: paste, preview table with errors, confirm. Server action re-validates the plan and inserts in one transaction (database function or batched insert with rollback on error).
4. Admin/manager only.
## Acceptance
- Tests: parser edge cases (quoted tabs, trailing blank rows, CRLF), duplicate handling, server re-validation rejects tampered rows.
- `pnpm check && pnpm typecheck && pnpm test` pass; PR checks green; merged per conventions "Done".
## Out of scope
Other lists (#32).
