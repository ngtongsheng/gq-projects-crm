# Code audit, round 2 — 2026-11-16

Scope: `main` at `2600205` (after loop 23 fixed round 1). Aspects not covered in round 1:
security & access control, data & schema integrity, dependencies & supply chain, observability &
failure modes, client bundle weight. Report only — nothing was changed.

Headline: **no high-severity hole found.** The security model is layered and disciplined; findings
are hardening gaps. The two items worth acting on first are the missing security headers (S1) and
the silent auth-outage failure mode (O1).

## Security — database side (RLS, policies, storage)

All 80 migrations read. Every table has RLS enabled, `revoke all` from anon/authenticated, column
grants, `set search_path = ''` on every SECURITY DEFINER function, and a restrictive
"left people: no access" policy. Both views are `security_invoker = true`.

| # | Finding | Evidence | Severity |
|---|---|---|---|
| S-DB1 | Storage insert policy checks owner/path-shape/is_active but **not record permission**: any active staff can upload a file into another person's `claims/<id>/` or `leave/<id>/` folder, where it renders for viewers of that record (spoofed receipt/MC slip). No read exposure — reads are signed-URL only | `20261114160000_storage_attachments.sql:19-28` | Low-med |
| S-DB2 | `weekly_reports` insert policy checks job role only — a **left** salesperson (active=false keeps their role) can still submit and read reports; no restrictive policy on this table | `20261115130000_sales_calendar.sql:361-374` | Low |
| S-DB3 | `activity_invitees`: a left invitee can still read invitation rows and update status — same missing restrictive policy | `20261115130000_sales_calendar.sql:235-252` | Low |
| S-DB4 | `grant update (key)` on `app_settings` lets the MD's update policy rename a settings key, silently orphaning every reader of it | `20261120110000_app_settings_upsert.sql:6` | Info |
| S-DB5 | `mof_lines: read all` is `using (true)` — deliberate (no money columns on lines), recorded here so it is not mistaken for an oversight later | `20261102190000_mofs.sql:136-139` | Info (by design) |

## Security — application side (actions, impersonation, middleware, secrets)

Every IDOR candidate traced end to end (claims steps, expenses/receipts, tasks, payments, MOF
save, leave, appeals, HR) ended in either an app-level ownership check or an RLS zero-row result.
Impersonation is sound: admin+MD only, HMAC-signed httpOnly cookie, fails closed, read-only
enforced centrally in `view-only-fetch.ts`, log row per session. Dev sign-in is gated server-side.

| # | Finding | Evidence | Severity |
|---|---|---|---|
| S1 | **No security headers or CSP anywhere**: no `headers()` in next.config, none in middleware — no CSP, no frame-ancestors (sign-in page can be iframed → clickjacking), no Referrer-Policy | `next.config.ts`, `src/lib/supabase/middleware.ts` | Medium |
| S2 | `.env.development` (test-copy URL + publishable key) committed to the public repo in `75a2e19`. Not a secret, but the test copy mirrors live PII; its anon surface is probeable | git history | Low |
| S3 | Impersonation HMAC secret falls back to `""` when the service key env is missing; verify fails closed, but it should fail loudly | `people/impersonate-actions.ts:83` | Low |
| S4 | Signing out mid-impersonation never sets `impersonation_log.ended_at` — audit row stays open | `sign-out.ts` | Low |
| S5 | `requestOrigin()` trusts `x-forwarded-host` for OAuth redirectTo — fine on Vercel, a host-injection risk only if ever self-hosted | `src/lib/request-origin.ts` | Low |
| S6 | No app-side rate limiting on server actions — RLS makes blind id iteration harmless; completeness only | | Info |

## Data & schema integrity

All 80 migrations read against the writers in `src`. Money types are right end-to-end
(`numeric(14,x)`, zero float columns, cents math, `for update` locks on every cross-record cap).
Invariants (reservation state machine, VO sync, one-admin, MYT date guards, DO numbering) live in
the database with matching PGlite tests.

| # | Finding | Evidence | Severity |
|---|---|---|---|
| D1 | **Order total can drop below payments already received.** `cap_payments` guards INSERTs only; changing the contract sum has no floor at the received sum. Result: permanent overpayment display, commission threshold auto-met on the smaller base, and every further payment insert rejected until the total is raised. No corruption | `20261105120000_cap_payments.sql` (BEFORE INSERT only) vs `20261115210000_variation_orders.sql:197-247` | Medium |
| D2 | **Installer POs still key the installer as free text** (case-sensitive unique). "Ali" vs "ali" on one MOF = two POs, each with its own claim ceiling — combined claims can exceed the one real agreement | `20261102210000_installer_claims.sql:13,19`, `mofs/installer-actions.ts:39` | Medium |
| D3 | Installer directory renames leave already-scheduled `jobs.installer` text stale (sync fires only on job write, no AFTER UPDATE trigger) | `20261118100000_installers.sql` | Low-med |
| D4 | `contacts.mobile UNIQUE` includes archived rows — an archived contact permanently holds the number; re-adding fails with raw 23505 | `20261102140000_customers.sql:29` | Low-med |
| D5 | Deleting an auth user is a resting FK wall (~120 FKs, NO ACTION). Safe but undocumented; the "left" flow means it never needs to succeed | `20261101120000_profiles.sql` | Low |
| D6 | `tasks.assigned_on` and costing `enquiry_date` default to UTC-day, not MYT — a 00:30 MYT task is "assigned yesterday" and its due floor loosens a day | `20261115143000_tasks.sql:29`, `20261115120000_costing.sql:162` | Low |
| D7 | Receipt numbering allocates `max(receipt_no)+1` without locking the claim row — concurrent expense inserts collide on the unique index; retry succeeds | `20261119100000_monthly_claims.sql:385-391` | Low |
| D8 | DO numbers exhaust at 9999 with a cryptic CHECK message instead of "extend to 5 digits" | `20261118120000` | Low, years away |
| D9 | Commission engine exists in 4–5 SQL copies + TS; only the parity test stands between them | 20261105130000 / 20261115210000 / 20261115240000 | Low (debt) |

## Observability & failure modes

| # | Finding | Evidence | Severity |
|---|---|---|---|
| O1 | **Auth errors swallowed in middleware**: `getClaims()` error discarded; a Supabase auth outage bounces the whole company to sign-in with zero log lines — undiagnosable from Vercel logs | `src/lib/supabase/middleware.ts:42`, `current-profile.ts:51-53` | High (failure-mode) |
| O2 | **No timeouts on any Supabase call** (no AbortSignal/signal anywhere): a slow (not down) Supabase hangs server components until the Vercel function timeout, indistinguishable in logs | `view-only-fetch.ts:78`, `browser.ts`, `admin.ts` | Medium |
| O3 | **Commission payout deletion is untraceable**: hard delete, no audit of who removed what — payroll-adjacent dispute has no forensic trail | `commission/actions.ts:114-131` | Med-high |
| O4 | Error logs lack who/which-record context (~10 paths sampled: message + raw DB error, no user/record id) | e.g. `customers:238`, `claims:115`, `leave:84` | Medium |
| O5 | No `error.tsx`/`global-error.tsx` — uncaught server throws land on the bare Next default page | src-wide find | Medium |
| O6 | Fire-and-forget uploads: `void onPick(file)` with no catch — a thrown network error leaves the button stuck on "Uploading…", invisible in prod | `components/app/file-upload.tsx:66`, `expense-dialog.tsx:360` | Medium |
| O7 | Missing `ALLOWED_EMAIL_DOMAINS` silently locks everyone out: `parseAllowedDomains(undefined)` → `[]` → all Google sign-ins refused, domain-refusal path unlogged | `auth/callback/route.ts:52`, `sign-in-decision.ts:39-40` | Medium |
| O8 | `session-sync.mjs` fails silent by design — if `gh` auth expires, instructions silently stop flowing, nothing watches the watcher | `session-sync.mjs:4,171-180,291` | Medium |
| O9 | Zod `.catch()` substitutes silent defaults for report/reminder settings — schema drift changes late-classification with no log | `report-stats.ts:49-52`, `site-reminders.ts:67-75` | Low |
| O10 | No cron exists; yearly-target rollover is request-driven and stale-on-failure by documented tradeoff; site-reminder sending delegated to the future Integration loop | `yearly-targets.ts:9-16` | Low |

## Dependencies & supply chain + client bundle

| # | Finding | Evidence | Severity |
|---|---|---|---|
| X1 | `pnpm audit`: 2 advisories, both **dev-only** via the `shadcn` CLI (`minimatch` moderate DoS, `deepmerge` low prototype pollution). Prod audit clean | | Low (noise) |
| X2 | Routine patch lag: next 16.4.3→16.4.6, react 19.3.0→19.3.1, supabase-js 2.118→2.119. Zero majors behind on runtime core | `pnpm outdated` | Info |
| X3 | Licenses: 533 packages, 0 GPL/AGPL; the 2 LGPL are server-only native sharp binaries | | Clean |
| X4 | Bundle: supabase-js imported in zero client files; no chart lib (team chart is hand-rolled SVG in a server component); fonts via `next/font` with CJK subset; `public/` is one 6.3 KB PNG; no raw `<img>` | | Clean |

Not done: no production build was run, so final client chunk composition was not measured
(nothing suggested by static analysis makes it likely to matter).

## If you act on anything

Ranked: **S1** (security headers + CSP in next.config — small, closes the biggest gap), **O1**
(log middleware auth errors — small), **D1/D2** (payment-floor + installer key — need a small
migration each), **O3/O4** (audit table for payout deletes + richer error context), **S-DB1/S2**
(storage insert permission check, untrack `.env.development`). Everything else is low or noise.
