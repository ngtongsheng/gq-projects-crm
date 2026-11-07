---
model: sonnet
effort: high
why: Explains the new flow to two audiences (developers, Vicky) without jargon leaking to her
depends: [01, 02, 03, 04, 05, 06, 07, 08, 09, 10, 11, 13]
---
# 12 Docs and plain note for Vicky
## Goal
Docs match the new reality; Vicky gets a short plain note of what changed for her.
## Files to touch
`docs/environments.md` (CI table: backup, health, dump; label; local test-copy access; hooks), `docs/decisions.md`
(D1-D17 summary entries), `docs/debt.md` (remove fixed rows: no backups partially, shared dev DB note update),
`docs/onboarding.md`, new `docs/whats-new-2026-11.md` (Vicky-facing, plain style, glossary words).
## Steps
1. Update developer docs.
2. Vicky note, max 12 lines: changes go live after you say the preview looks right; Tong Sheng can fix things through
   your Claude; try other roles with "Sign in as" or "show me test sign-ins"; when stuck, Claude tells Tong Sheng with
   everything he needs.
3. Update the `~/work/AGENTS.md` project table status line for the CRM.
## Acceptance
- `grep -rn "owner-approved" docs --include=*.md` only in loops history.
- Links resolve (`pnpm check` for md if configured; else manual).
## Out of scope
In-app guide changes.
