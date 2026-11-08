---
model: opus
effort: medium
why: A password-free sign-in path; the gate must hold in production builds
depends: []
---
# 05 Dev role panel with one-click sign-in
## Goal
On a laptop running `pnpm dev` against the test copy, a floating panel on every page, including sign-in, signs in as any of the 7 job roles with one click. It cannot work on the live app or on Vercel previews.
## Context
Decisions D7 and D8. Reuse the pattern in `src/app/(app)/people/impersonate-actions.ts` (`admin.auth.admin.generateLink` type `magiclink`, then `verifyOtp` with `hashed_token`). Test user emails come from `scripts/example-data/test-users.ts`; the test-copy check is in `scripts/example-data/seed-guard.ts`. Server actions are callable in production builds, so the refusal belongs in the action, before any admin call. Vercel previews run with `NODE_ENV=production`. Without the server secret key, `createAdminClient()` returns null: show `ADMIN_UNAVAILABLE_MESSAGE`.
## Files to touch
- `src/lib/auth/dev-sign-in.ts` and a test beside it (gate and role-to-email lookup)
- `src/app/dev/dev-sign-in-actions.ts` (server action)
- `src/components/app/dev-role-panel.tsx`
- `src/app/layout.tsx`
## Steps
1. Read `docs/design-system.md` and the Next 16 docs for server actions.
2. Write a pure gate that is true only for `NODE_ENV === "development"` plus the test-copy URL. Share the existing test-copy check and the email list instead of copying them; if a script-only module cannot be imported by the app, move the shared part to `src/lib` and update the script.
3. The action validates the job role with a schema, checks the gate first, clears `IMPERSONATION_COOKIE`, signs in, and redirects to `/`. A missing test user gives a plain message saying the test sign-ins need setting up.
4. Render the panel from the root layout only when `NODE_ENV === "development"`. Collapsible, theme tokens only, shows the current role, works at phone width and does not cover the sign-in button.
5. Tests: the gate refuses production `NODE_ENV`, the live URL and a missing URL; the action makes no admin call when the gate refuses; an unknown job role is rejected.
## Acceptance
`pnpm check`, `pnpm typecheck`, `pnpm test`, `pnpm build` pass. With `.env.local` connected: from the sign-in page, each of the 7 roles lands signed in with that role's sidebar. Not connected on this machine: confirm the plain message appears and log that the signed-in path needs an owner check.
## Out of scope
Any live-app sign-in change. Changes to "Sign in as".
