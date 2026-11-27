---
tier: standard
why: designs a shared component API from 8 copies; the first 3 call sites prove it covers all variants
depends: []
---
# 05 DeleteConfirm component and the first 3 dialogs (B2)
## Goal
One `DeleteConfirm` footer (Save, then Delete, then "Yes, delete" / "Keep") in `src/components/app/`, shown on
`/dev/components`, used by the two sample dialogs and the marketing expense dialog. Same wording, order, styles
and behaviour as now.
## Context
Read `00-shared-context.md` and `docs/design-system.md`. Audit row B2 lists all 8 copies (36 identical lines
each). Diff all 8 before designing the props, so task 06 needs no API change. Wording comes from the existing
i18n keys; keep using them.
## Files to touch
- new `src/components/app/delete-confirm.tsx`
- `src/app/dev/components/page.tsx` (add a demo, following the existing demos)
- `src/app/(app)/custom-samples/record-sample-dialog.tsx`
- `src/app/(app)/samples/sample-dialog.tsx`
- `src/app/(app)/marketing/marketing-expense-dialog.tsx`
## Steps
1. Read the 8 footers (paths in audit B2); note every difference (labels, pending state, disabled rules).
2. Build `DeleteConfirm` with the smallest props covering all 8. Theme tokens only.
3. Add the demo, then replace the footer in the 3 dialogs.
## Acceptance
- The 3 dialogs no longer contain the confirm-footer JSX; `grep -n "Yes, delete"` (or its i18n key) hits only the
  component and the 5 dialogs left for task 06.
- Existing tests for these dialogs pass. `pnpm check && pnpm typecheck && pnpm test && pnpm build` pass.
## Out of scope
The other 5 marketing dialogs (task 06). `FormDialog`/`useSubmit` (round 1 R1).
