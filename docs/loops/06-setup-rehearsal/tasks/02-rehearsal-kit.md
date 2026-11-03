---
model: sonnet
effort: high
why: owner follows it alone in a fresh account; gaps waste his rehearsal hour
depends: [01]
---
# 02 Rehearsal runbook + observation sheet

## Goal
Two files the owner uses in task 03: a runbook to set up and run the rehearsal, and a sheet to record what happened
at each setup step, aimed at the break points.

## Context
- Break points: `../assets/break-points.md`. SETUP.md: `~/work/projects/gq-setup/SETUP.md`.
- Onboarding script: `docs/onboarding.md` section 2 (mirror it: Code tab, `GQ` folder, Manual permissions, paste link).
- Decisions D1-D3 in `../loop.md`. Rehearsal user is a macOS **admin** user (mirrors a typical owner's Mac).
- Sign-in on the test copy during rehearsal: an example sign-in from `pnpm seed:example` (environments.md "Example
  data on the test copy"); the owner runs the seed in his own account beforehand and notes one password.
- Throwaway GitHub: Gmail +alias, e.g. `ngtongsheng+gqtest@gmail.com`.

## Files to touch
- `docs/loops/06-setup-rehearsal/assets/rehearsal-runbook.md`
- `docs/loops/06-setup-rehearsal/assets/rehearsal-sheet.md`

## Steps
1. Runbook, numbered, one action per step: before (seed example data, check test copy awake, `gh` ready in owner
   account), create admin user (System Settings > Users & Groups), log in, install/open Claude Desktop, sign in, make
   `GQ` folder, paste link; during (send invite at step 7 from owner account: fast user switching); after hand-off
   (restart, open `GQ/gq-projects-crm`, "show me the app", sign in, ask one tiny change, preview, stop before
   deploy, close PR); how to capture evidence (screenshots, copy Claude's messages). Also: note Claude usage % before
   and after (B6).
2. Sheet: one row per SETUP.md step (0, 0b, 1-14) + "first preview", "sign-in", "first change", "re-paste repair".
   Columns: Step · Watch for (from break points) · Result (pass/fail) · Time taken · Notes. Pre-fill "Watch for".
3. Keep both short. No commands for the owner beyond what onboarding.md already uses.

## Acceptance
- Every break point B1-B12 appears in at least one sheet row's "Watch for" (or is marked "not testable here" with the
  reason, B4 and B9).
- `pnpm check` passes (Biome ignores md, but run it).

## Out of scope
Running the rehearsal; fixing anything.
