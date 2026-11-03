---
model: sonnet
effort: high
why: owner-only; executor only parks it and reads the filled sheet
depends: [02]
---
# 03 Owner: run the rehearsal

## Goal
The owner runs the full setup in a fresh macOS admin user and fills `../assets/rehearsal-sheet.md`.

## Context
Owner-only (macOS user creation, Claude and GitHub sign-ins). Executor: mark `blocked: owner — run rehearsal per
assets/rehearsal-runbook.md`, list it under Owner actions, and continue nothing that depends on it.

## Files to touch
- `../assets/rehearsal-sheet.md` (owner fills)

## Steps
Follow `../assets/rehearsal-runbook.md`.

## Acceptance
- Sheet has a Result in every row. On resume, executor summarises fails into the Log, one line each.

## Out of scope
Fixes (task 04). Deleting the rehearsal user (task 06, after the re-paste check).
