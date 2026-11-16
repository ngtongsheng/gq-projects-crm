---
tier: standard
why: CSP must allow Supabase, Google OAuth, next/font and signed storage URLs without breaking a page
depends: []
---
# 01 Security headers and CSP (S1)
## Goal
Every response carries a CSP and standard security headers; the sign-in page cannot be framed. No page breaks.
## Context
Read `00-shared-context.md`. Decision D3: static `headers()` in `next.config.ts`, no nonces, no middleware change.
Headers: `Content-Security-Policy` (default-src 'self'; script-src 'self' 'unsafe-inline' plus 'unsafe-eval' only in
development; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: + Supabase origin; connect-src 'self' +
Supabase origin incl. wss; font-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self' + Google
accounts if the OAuth flow posts there; object-src 'none'), `X-Frame-Options: DENY`, `Referrer-Policy:
strict-origin-when-cross-origin`, `X-Content-Type-Options: nosniff`, `Strict-Transport-Security` (max-age 2 years,
includeSubDomains), `Permissions-Policy` (camera=(self) only if a screen uses the camera, else none).
Derive the Supabase origin from `NEXT_PUBLIC_SUPABASE_URL`. Check how attachments are shown (signed URLs, PDF
preview) and how Google sign-in redirects, and allow exactly what they need.
## Files to touch
`next.config.ts`; optionally a small `src/lib/security-headers.ts` builder with a unit test.
## Steps
1. Inventory external origins: grep `src` for `https://`, `supabase`, `<iframe`, `<embed`, `object`.
2. Build the header list; wire `headers()` for `source: "/:path*"`.
3. `pnpm dev`, `curl -sI http://localhost:3000/sign-in` shows the headers. Open the sign-in page and a claims page
   with an attachment in Chrome (agent profile) and read the console for CSP violations.
## Acceptance
- `curl -sI http://localhost:3000/sign-in` lists all six headers.
- Browser console shows no CSP violation on sign-in, dashboard, a claim with an attachment.
- `pnpm check && pnpm typecheck && pnpm test` pass.
## Out of scope
Nonce CSP, middleware changes, report-uri endpoint.
