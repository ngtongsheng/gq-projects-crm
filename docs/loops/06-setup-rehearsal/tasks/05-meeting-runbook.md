---
model: sonnet
effort: high
why: the owner's script for the real meeting; must fold rehearsal evidence into a scannable checklist
depends: [04]
---
# 05 Meeting runbook in onboarding.md

## Goal
`docs/onboarding.md` section 2 tells the owner exactly what to prepare the night before, what to check in the first
5 minutes, and what to do when each step breaks.

## Context
- Current section 2: `docs/onboarding.md`. Evidence: `../assets/rehearsal-sheet.md`, fixes in `../loop.md` Log.
- Break points: `../assets/break-points.md`. Decisions D3-D5 in `../loop.md`.

## Files to touch
- `docs/onboarding.md`

## Steps
1. "Night before" checklist: test copy awake (sign in once at localhost or dashboard); Vicky's test-copy admin made
   (task 06) and temporary password ready; her Claude usage fresh (Opus default, D4: she avoids heavy Claude use that
   day); owner `gh auth status` ok and invite command ready; real time per step from the sheet.
2. "First 5 minutes": the preflight (step 0b) result, her GitHub username spelled right.
3. Fallback table: setup step · symptom · what the owner does. Rows from the sheet's fails and every break point.
4. "After the meeting": tell her about GitHub two-step login (B9) and set it up together, or book it; Supabase
   7-day pause note.
5. Update the 45-minute estimate if the rehearsal measured otherwise.

## Acceptance
- Every break point B1-B12 maps to a checklist line or fallback row.
- `pnpm check` passes. Commit on a branch, PR, merge when checks are green.

## Out of scope
SETUP.md changes.
