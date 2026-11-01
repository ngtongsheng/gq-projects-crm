---
model: sonnet
effort: high
why: owner runbook plus checking the kit's update path; small but must be accurate
depends: [03]
---
# 05 Onboarding doc (owner + day 2)
## Goal
`docs/onboarding.md` in the CRM repo: what the owner does to onboard an editor, the first-run script, and how editors get updates.
## Context
- D4 (write collaborator), D5 (re-paste repairs). Loop 01 kit: `CLAUDE.md`, `.claude/skills/*`.
- More editors may follow Vicky (`docs/decisions.md` Context), so write it per editor, not for Vicky only.
## Files to touch
`docs/onboarding.md`; `CLAUDE.md` only if step 3 finds a gap (one line).
## Steps
1. Owner checklist: `gh api -X PUT repos/ngtongsheng/gq-projects-crm/collaborators/<login> -f permission=push`; confirm the invite shows; what to do if the invite expires (7 days: resend).
2. First-run script: before (her Claude Pro login works, laptop charged, ~45 min), during (README → paste → watch for Xcode popup), after (she makes one tiny change with preview, not deploy).
3. Updates: check that `CLAUDE.md` makes Claude get the latest main at session start (e.g. `git pull` when on main and clean). Missing → add one line and note it in the log.
4. Off-boarding: remove collaborator command.
## Acceptance
Doc exists; `pnpm check` passes; step 3 outcome logged in loop.md.
## Out of scope
Handover to Vicky's own accounts (later loop, see `docs/decisions.md`).
