---
tier: economy
why: mechanical swap onto the component task 05 built
depends: [05]
---
# 06 DeleteConfirm in the other 5 marketing dialogs (B2)
## Goal
The remaining copies of the delete-confirm footer use `src/components/app/delete-confirm.tsx`.
## Context
Read `00-shared-context.md` and the component from task 05 with its 3 call sites as the pattern. If a dialog
needs a prop the component lacks, add it in the component without changing the other call sites' behaviour.
## Files to touch
- `src/app/(app)/marketing/marketing-event-cost-dialog.tsx`
- `src/app/(app)/marketing/marketing-event-dialog.tsx`
- `src/app/(app)/marketing/marketing-giveaway-dialog.tsx`
- `src/app/(app)/marketing/marketing-prepaid-entry-dialog.tsx`
- `src/app/(app)/marketing/marketing-vendor-dialog.tsx`
## Steps
1. Replace each footer with `DeleteConfirm`, passing the same handlers, labels and pending state.
## Acceptance
- The "Yes, delete" text or its i18n key is used only in `delete-confirm.tsx`.
- `pnpm check && pnpm typecheck && pnpm test && pnpm build` pass.
## Out of scope
Any other change to these dialogs.
