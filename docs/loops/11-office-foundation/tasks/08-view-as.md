---
model: opus
effort: medium
why: Security-relevant: every write must be refused while viewing, from one place
depends: [07]
---
# 08 Read-only View as
## Goal
MD's "Sign in as" becomes the demo's "View as": MD sees exactly what the person sees, and nothing can be saved.
## Context
- Demo: `VIEWAS` (~1799), `save()` refusing with a toast, banner at the top of main (~5146): "Viewing as X · title —
  this is exactly what X sees. View only: nothing you click here is saved.", button "Back to Vicky". Started from People.
- Today: signed-cookie impersonation that writes as the target (`src/lib/auth/impersonation.ts`,
  `src/app/(app)/people/impersonate-actions.ts`, `sign-in-as-button.tsx`, `src/components/app/impersonation-bar.tsx`,
  `impersonation_log`). D1 in `loop.md`.
- The demo's banner is purple (#7c3aed); add a theme token for it.
## Files to touch
- `src/lib/auth/impersonation.ts` (+ test), `src/app/(app)/people/impersonate-actions.ts`, `sign-in-as-button.tsx`
- `src/components/app/impersonation-bar.tsx` → `view-as-banner.tsx`
- The one place writes pass through (the server Supabase client factory in `src/lib/supabase/`, or a server-action
  wrapper if that is where writes funnel), `src/app/globals.css`
## Steps
1. Find where every write goes through. Refuse any insert, update, delete or rpc that writes while viewing, there, with
   the demo's message. If writes do not funnel through one place, make them, rather than guarding each action.
2. Rename the button and banner to the demo's words; keep `impersonation_log`.
3. Tests: a server action called while viewing fails and writes nothing; reads return the viewed person's data.
4. Parity check of the banner per `docs/office-parity/parity.md`.
## Acceptance
- `pnpm check`, `pnpm typecheck`, `pnpm test` pass.
## Out of scope
Changing who may use View as (md only stays).
