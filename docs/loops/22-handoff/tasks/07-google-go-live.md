---
tier: standard
why: live-app auth settings plus a GCP console flow in the browser
depends: [01]
---
# 07 Google sign-in go-live
## Goal
Anyone added in People with a `gqprojects.com.my` Google account can sign in to the live app; everyone else is
refused. The consent screen is published (not Testing).
## Context
- Loop D1, D13. Current state: `docs/environments.md` "Google sign-in" (consent screen in Testing; `auth-config.yml`
  never run for prod). Workflow: `.github/workflows/auth-config.yml` → `scripts/push-auth-config.ts`. The workflow
  file must be on `main` (it is).
- GCP project `gqp-office`, OAuth client and consent screen "GQP Office", scopes openid/email/profile only (no Google
  review needed). Branding needs: app home page (`https://gq-projects-crm.vercel.app`), privacy policy link
  (`https://gq-projects-crm.vercel.app/privacy`), authorised domain (`gq-projects-crm.vercel.app`; if Google rejects a
  `vercel.app` subdomain, log it as a decision and publish without an authorised domain if allowed, else park as
  `blocked: owner` with the exact message).
- `/privacy` must be public (outside the signed-in layout; check `src/proxy.ts` or middleware for public paths) and
  live before publishing: it ships with this loop's merge, so do the GCP publish in #10 after merge if Google checks
  the URL; otherwise now.
- Browser: Claude in Chrome, profile "Agent" (owner pre-signed). Memory allows GCP/Supabase/Vercel setup in Chrome
  while prod is not live.
## Files to touch
- `src/app/privacy/page.tsx` (short plain privacy notice: who runs it, what is stored (name, email, work records),
  Google sign-in only for email/name, contact = company; use design-system components)
- public-path list file if one exists
- `docs/environments.md` "Google sign-in" status
## Steps
1. Add `/privacy`; check it on `pnpm dev` signed out.
2. `gh workflow run auth-config.yml`; wait with `gh run watch`; expect success for dev and prod.
3. In GCP: fill Branding, then Audience → Publish app. Record the result.
4. Update `docs/environments.md` status lines.
## Acceptance
- `pnpm check`, `pnpm typecheck`, `pnpm test` pass.
- Latest `auth-config.yml` run is green (`gh run list --workflow auth-config.yml -L1`).
- GCP Audience shows "In production" (or the parked reason is logged).
- After merge (#10 checks): live `/privacy` returns 200 signed out; live sign-in with a non-added Google account is
  refused.
## Out of scope
Adding staff (Vicky). seed-admin (owner action).
