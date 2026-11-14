---
model: opus
effort: medium
why: Auth change with GCP and Supabase setup in Chrome, config as code for a later account move
depends: [03]
---
# 09 Google sign-in
## Goal
People sign in with Google only. Only invited, active people on an allowed domain get in. Auth config lives in the repo
and is pushed by script, so it moves to Vicky's accounts unchanged.
## Context
- D2, D12, D13 in `loop.md`. Owner consent to do the GCP and Supabase dashboard steps in Chrome (profile "Agent"); load
  the `claude-in-chrome` skill. Secrets go only to GitHub secrets (`gh secret set`) and Supabase; never git, never
  printed in logs.
- Supabase refs: `docs/environments.md`. Sign-ups are off on both projects; keep them off. Check the installed
  `@supabase/supabase-js` / `@supabase/ssr` docs in `node_modules` for the OAuth + PKCE callback, and Supabase docs for
  how a Google identity links to an existing user with the same email.
- Today: password sign-in (`src/app/(auth)/sign-in`), set-password link (`src/app/(auth)/set-password`), invite share
  in People (`invite-message.ts`, `invite-share.tsx`, `new-link-dialog.tsx`). The laptop dev role panel
  (`src/app/dev/dev-sign-in-actions.ts`) keeps working on the test copy.
## Files to touch
- `src/app/(auth)/sign-in/*`, new `src/app/auth/callback/route.ts`, delete `src/app/(auth)/set-password/`
- `src/app/(app)/people/` invite files (an invite becomes "add the person, then share the app link")
- `supabase/config.toml` and/or `scripts/push-auth-config.ts` (new) that sets the Google provider, site URL and
  redirect allow-list per project from env; CI or a documented one-off run
- `docs/environments.md`, `docs/handover-migration.md`, `docs/debt.md` (GCP project lives in the owner's account)
## Steps
1. GCP (Chrome): project "gqp-office", OAuth consent External, app name "GQP Office", scopes email and profile,
   publish to production. OAuth client "Web application", redirect URIs `https://<dev-ref>.supabase.co/auth/v1/callback`
   and `https://<prod-ref>.supabase.co/auth/v1/callback`. Store id and secret as GitHub secrets.
2. Auth config as code: prefer `supabase config push` with `env()` values if the installed CLI supports per-project
   values; otherwise the Management API script. Apply to dev and prod.
3. Code: "Sign in with Google" button styled to the design system; callback exchanges the code, then refuses (signs out
   with a plain message) when the email domain is not in `ALLOWED_EMAIL_DOMAINS` (env; dev also allows
   `example.invalid`) or the person has no active profile. Remove the password and set-password flow.
4. Read prod profile emails (dashboard SQL editor, read-only). Any not on `gqprojects.com.my`: list them under Owner
   actions in `loop.md`.
5. Tests for the callback's refuse/allow decision (domain, missing profile, left person).
6. Try it on the dev project in Chrome with the owner's Google account added as a test person if needed, then remove
   that test person.
## Acceptance
- `pnpm check`, `pnpm typecheck`, `pnpm test` pass.
- Google sign-in works on the test copy; a non-invited account is refused with the plain message.
- `grep -rn "<dev-ref>\|<prod-ref>" src scripts supabase/config.toml` (actual refs) finds nothing.
## Out of scope
Moving the GCP project to Vicky's org (owner action at handover).
