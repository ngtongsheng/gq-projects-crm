# Loop 24: Audit round 2 fixes
Orchestrator: frontier
## Goal
The chosen findings from `docs/audits/2026-11-16-code-audit-round-2.md` are fixed on `loop/24-audit-round-2`. That
means security headers and CSP, loud auth failures, richer error logs on money and HR paths, a payout-removal audit
trail, the order-total floor, installer POs linked to the directory, storage and RLS hardening, small data fixes,
error pages, and sign-out closing impersonation. Every other finding is in `docs/debt.md`. Owner pushes to `main`.

## Decisions
| ID | Decision | Why | Rejected |
|---|---|---|---|
| D1 | Scope: S1, O1, O3, O4, O5, O6, O7, D1, D2, D4, D6, D7, S-DB1, S-DB2, S-DB3, S3, S4 | Ranked items plus cheap lows; owner picked | Audit's ranked list only; all non-Info findings |
| D2 | Skip S2 (untrack `.env.development`) | `scripts/seed-admin.ts` and laptop setup read it; the key is a public publishable key | Untracking now |
| D3 | S1: static enforced CSP + standard headers via `headers()` in `next.config.ts`, script-src allows `'unsafe-inline'` (no nonces) | Keeps pages statically renderable; closes clickjacking and referrer gaps now | Nonce CSP in middleware (forces dynamic); Report-Only first |
| D4 | D1: BEFORE UPDATE trigger on `mofs` rejects `contract_sum + vo_amount` below the sum of payments received, message "The order total can't go below RM X already received." | Fixes the stuck-payments case at the source; DB is where money invariants live | Allow with warning |
| D5 | D2: add `installer_pos.installer_id` FK to `installers`, backfill via `name_key`, unique `(mof_id, installer_id)`. If case-duplicates exist on one MOF the migration raises naming them; nothing is merged | A silent merge reshapes money records; owner resolves by hand | Auto-merge; case-insensitive text unique |
| D6 | O4: `logServerError(message, error, context)` helper; adopt in claims, payments/collection, commission, leave, HR, overtime actions only | Payroll and money paths are where forensics matter; others adopt when touched (debt.md) | Sweep all 190 calls; helper only |
| D7 | D4: keep `contacts.mobile` unique incl. archived; replace the raw 23505 with a message naming the archived contact | No duplicate people; no migration | Partial unique on active rows |
| D8 | O3: append-only `commission_payout_removals` row (who, when, full payout snapshot) written by an AFTER DELETE trigger; readable by roles that can pay out commission | Forensic trail without changing the delete flow | Soft delete (every payout reader must filter) |
| D9 | O7/S3: missing required env is logged as a config error on use (and S3 throws), not at boot | Boot-time throws break the laptop "can't be tried" flows | Startup validation of all env |
| D10 | Preflight: push to `main` deploys and applies migrations live; repo `.claude/settings.json` denies `git push *:main*`. Owner action | Owner wants to look before live migrations; D2 may abort on live duplicates | Allow rule for the executor |
| D11 | Loop runs in worktree on `loop/24-audit-round-2`; executor merges `main` in, runs checks, pushes the branch, stops | D10 | |

## Tasks
| # | Task | Status | Depends | Tier |
|---|---|---|---|---|
| 01 | Security headers and CSP (S1) | done | | standard |
| 02 | Log auth failures loudly (O1, O7, S3) | done | | standard |
| 03 | `logServerError` helper on money and HR paths (O4) | done | | standard |
| 04 | Audit trail for payout removals (O3) | done | 03 | standard |
| 05 | Order total floor at payments received (D1) | done | | frontier |
| 06 | Link installer POs to the installer directory (D2) | done | | frontier |
| 07 | Storage and RLS hardening (S-DB1, S-DB2, S-DB3) | done | | frontier |
| 08 | Small data fixes: MYT defaults, receipt lock, archived mobile message (D6, D7, D4) | done | | standard |
| 09 | Error pages and upload failures (O5, O6) | done | | standard |
| 10 | Sign-out closes the impersonation log row (S4) | done | | standard |
| 11 | Log deferred findings in debt.md and the audit | in-progress | 01-10 | economy |
<!-- status: todo | in-progress | done | blocked: <reason> -->

## Owner actions
- Before execution: push the loop-24 planning commit on `main` (`git push origin main`); the classifier denied it
  for the planner.
- After #11: look over the branch, then from the worktree run `git push origin HEAD:main`. That deploys the app and
  applies migrations to the live app. If CI reports the #06 migration aborting on duplicate installer POs, merge
  those POs by hand (needs Tong Sheng; live data) and re-run.

## Log
<!-- one line per event: YYYY-MM-DD · #NN · result · next -->
2026-11-16 · plan · loop written from audit round 2 · next: /execute-loop docs/loops/24-audit-round-2
2026-11-16 · plan · decision · worktree branched from local main, not origin/main · planning commit not yet pushed (owner action)
2026-11-16 · plan · decision · skipped issue #50 and catch-up hook · they target Vicky's laptop, this is the owner's machine
2026-11-16 · plan · planner tab w7:t14 answered YES; closed
2026-11-16 · #01 · in-progress · delegated (standard)
2026-11-16 · #01 · decision · Permissions-Policy camera=() (no screen uses camera); form-action adds accounts.google.com + Supabase origin for OAuth redirects; Supabase origins omitted when env missing so build works
2026-11-16 · #01 · done · six headers on /sign-in; no CSP violations on sign-in, dashboard, claim + receipt (orchestrator, test sign-in); check/typecheck/test pass (3040)
2026-11-16 · #02 · in-progress · delegated (standard)
2026-11-16 · #02 · decision · secret check placed before log insert/verifyOtp (not old line 83) so a throw never leaves a half-switched session; refusal log covers every reason, domain only, never the address
2026-11-16 · #02 · done · check/typecheck/test pass (3045); getClaims no-session returns error null (auth-js source), so signed-out requests don't log
2026-11-16 · #03 · in-progress · delegated (standard)
2026-11-16 · #03 · decision · helper copies only code/message/details; private fail/finish helpers take profile+record ids; hr mayChangeHr returns Profile|null; create-path failures log no record id
2026-11-16 · #03 · done · 44 calls in 23 files moved; grep clean; check/typecheck/test pass (3048)
2026-11-16 · #04 · in-progress · delegated (standard)
2026-11-16 · #04 · decision · no FK on payout_id (row is gone), indexed instead; removed_by nullable so service-role deletes still record; actions.ts unchanged (already logs via #03)
2026-11-16 · #04 · done · read policy matches payout delete roles (md, accounts); PGlite 4 tests; check/typecheck/test pass (3052)
2026-11-16 · #05 · in-progress · delegated (frontier)
2026-11-16 · #05 · decision · trigger refuses only a lowering, so orders already below payments can still be raised; no i18n entries (MOF/VO screens show raw error, same as cap_payments); commission-parity test disables trigger around its deliberate below-payments setup
2026-11-16 · #05 · done · PGlite 7 tests + 2 app tests; check/typecheck/test pass (3061)
2026-11-16 · #06 · in-progress · delegated (frontier)
2026-11-16 · #06 · decision · migration adds PO-only installer names to the directory (most-used spelling), keeps typed text; installer text now set by trigger from the directory, app write on it revoked; old unique (mof_id, installer) kept until the text column is dropped
2026-11-16 · #06 · decision · example data gains "Steady Hands Flooring" installer; fixtures and two DB tests insert installer_id
2026-11-16 · #06 · done · PGlite tests pass; check/typecheck/test pass (3072). Open check: PO picker in pnpm dev only after CI applies the migration to the test copy
2026-11-16 · #07 · in-progress · delegated (frontier)
2026-11-16 · #07 · decision · alter policy instead of drop/recreate (migration guard refuses drop policy); can_attach follows each area's table rule; hr-policies md/accounts only since the row is saved after upload
2026-11-16 · #07 · done · upload order verified (leave applies then uploads; claims/tasks existing records); check/typecheck/test pass (3087). Out of scope: commission_appeals, mof_changes lack "left people" policy → #11 debt
2026-11-16 · #08 · in-progress · delegated (standard)
2026-11-16 · #08 · decision · receipt trigger now security definer (authenticated lacks UPDATE on monthly_claims, so FOR UPDATE needs it); lock tested by function source (PGlite is single-connection); archived message says "Ask an admin to restore them" (no restore action exists), translated via two zh/bm fragments
2026-11-16 · #08 · done · check/typecheck/test pass (3092). Out of scope → #11 debt: samples.form_date/moved_on and variation_orders vo_date still use UTC current_date
2026-11-16 · #09 · in-progress · delegated (standard)
2026-11-16 · #09 · decision · upload test targets new attachFile() (no jsdom/testing-library; adding one needs a dependency); digest shown on page, server already logs it; global-error English only (no language provider above root layout)
2026-11-16 · #09 · done · error page seen in dev with temporary throw (removed); retry prop matches Next 16 docs; check/typecheck/test pass (3098)
2026-11-16 · #10 · in-progress · delegated (standard)
2026-11-16 · #10 · decision · shared closeImpersonationLog in its own file (a "use server" export would become a callable action); cookie deleted before the log write (viewOnlyFetch refuses writes while viewing as); expired cookie leaves the row open, same as endViewAs → #11 debt
2026-11-16 · #10 · done · check/typecheck/test pass (3100)
2026-11-16 · #11 · in-progress · delegated (economy)
