---
tier: standard
why: UI error boundaries and upload error handling; needs design-system reuse
depends: []
---
# 09 Error pages and upload failures (O5, O6)
## Goal
An unexpected server error shows a plain branded page with a retry, and a failed upload resets the button and says
so instead of sticking on "Uploading…".
## Context
Read `00-shared-context.md` and `docs/design-system.md`. Next 16 docs: `node_modules/next/dist/docs/` for
`error.tsx` and `global-error.tsx` (client components, props shape for this version).
- O5: add `src/app/(app)/error.tsx` (inside the app shell) and `src/app/global-error.tsx`. Plain message via i18n
  ("Something went wrong. Try again." + retry button). Log digest only.
- O6: `src/components/app/file-upload.tsx:66` and `src/app/(app)/claims/expense-dialog.tsx:360` do `void onPick(file)`;
  catch the rejection, reset uploading state, show the existing error message pattern.
## Files to touch
The two new error files, the two upload files, dictionaries.
## Acceptance
- Test for the upload component: rejected `onPick` resets state and shows the error.
- `pnpm dev`: a temporary throw in a page shows the new error page (remove the throw afterwards).
- `pnpm check && pnpm typecheck && pnpm test` pass.
## Out of scope
`not-found.tsx`, error reporting service.
