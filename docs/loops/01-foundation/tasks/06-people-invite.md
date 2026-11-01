---
model: sonnet
effort: high
why: auth-adjacent feature using the admin API; clear spec from #05
depends: [05]
---
# 06 People admin + invite link
## Goal
Admins add a person (name, email, role) and get a one-time "set your password" link to copy and send; the person sets a password and lands in the app.
## Context
- D3, D7. Service-role key exists only on Vercel; locally the Add person action must show a plain message:
  "Adding people works on the preview link or the live site." No crash, no jargon.
- Use Supabase admin `generateLink` (type `invite` or `recovery`, per current docs) server-side; never expose the service key to the client.
- Validate input with zod at the server action; derive types from the schema.
## Files to touch
`src/app/(app)/people/page.tsx`, `src/app/(app)/people/actions.ts` (+ test for validation/permission), `src/app/(auth)/set-password/page.tsx`, `src/lib/supabase/admin.ts`
## Steps
1. People page (admin only via `requireRole`): DataTable of profiles (name, email, role, joined), "Add person" Dialog.
2. Action: validate, create invite link, set role on the profile, return link; UI shows it with a Copy button and a
   ready-to-send WhatsApp message text.
3. Set-password page: consumes the link session, sets password, redirects to `/`.
4. Admin can change a person's role (admin/staff); cannot demote themselves if they're the last admin.
## Acceptance
- Tests pass for: input validation, staff calling the action is rejected, last-admin guard.
- On a Vercel preview: add a test person, open the link in a private window, set password, sign in; then remove the test user.
- `pnpm check && pnpm typecheck && pnpm test && pnpm build` pass.
## Out of scope
Email delivery, deactivating users.
