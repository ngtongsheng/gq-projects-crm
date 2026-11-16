---
tier: standard
why: ordered outward steps (merge, deploy check, issue, PR close) and doc updates
depends: [07, 08, 09]
---
# 10 Hand-off: what's new, bootstrap issue, close #31, docs, merge
## Goal
Everything is live and her laptop will update itself the next time she opens Claude.
## Context
- Loop D5, D6, D7, D11, D13, D14. Order matters: merge and verify live first, then open the issue.
- `docs/whats-new.md` (from #03): rewrite in Vicky's words, 3-5 lines, version today. Topics: the new GQP Office app
  with all areas; Google sign-in on the live app and adding staff in People; her laptop updates itself; older drafts
  saved; how to see the app as someone else.
## Files to touch
- `docs/whats-new.md`, `docs/handover-migration.md` (add `gq-dev-private` row: what moves, steps),
  `docs/onboarding.md` (3a: catch-up replaces WhatsApp; WhatsApp only as fallback), `docs/environments.md`
  (gq-dev-private), `docs/debt.md` (Vercel Hobby non-commercial, D11), `docs/decisions.md` ("Loop 22" section,
  short), `~/work/AGENTS.md` project table row
## Steps
1. Docs above; `pnpm check`, `pnpm typecheck`, `pnpm test`.
2. Merge `loop/22-handoff` to `main` and push (if push to main is refused: park `blocked: owner`, as loop 21).
3. Wait for Vercel prod and any workflow (`gh run list -L3`). Check live `/privacy` 200 and the sign-in refusal
   (task 07 acceptance). If #07 deferred the GCP publish, do it now.
4. Close PR #31 with comment: "Superseded by the new GQP Office app (loops 11-21). The draft is saved as tag
   archive/pre-parity/feat/database-for-preview2." Tag that branch first, then delete it on origin.
5. Open the bootstrap issue from `assets/bootstrap-issue.md`: `gh issue create --label for:vicky-claude --title
   "Update your laptop for the new app" --body-file ...`.
6. Vault session note and loop log.
## Acceptance
- `origin/main` contains the loop; Vercel prod deployment for that commit is Ready.
- PR #31 closed; tag exists on origin; issue open with label `for:vicky-claude` authored by `ngtongsheng`.
## Out of scope
Messaging Vicky (owner action). seed-admin (owner action).
