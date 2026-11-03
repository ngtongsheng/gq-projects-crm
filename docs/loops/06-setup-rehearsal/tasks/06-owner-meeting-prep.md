---
model: sonnet
effort: high
why: owner-only (secret keys, account deletion); executor parks it and closes the loop
depends: [05]
---
# 06 Owner: meeting prep and rehearsal clean-up

## Goal
Vicky can sign in on the test copy at the meeting, and nothing from the rehearsal is left behind.

## Context
Owner-only: needs the test copy's secret key and macOS admin rights. Executor: mark `blocked: owner`, list the steps
under Owner actions; on resume verify what it can (below) and close the loop.

## Steps (owner)
1. Seed Vicky's admin on the test copy: `docs/environments.md` "Seeding the first admins" (dev, her email). Keep the
   temporary password for the meeting; delete `.env.seed`.
2. Remove the throwaway account's access: onboarding.md section 4 "Off-boarding".
3. Delete the rehearsal macOS user (System Settings > Users & Groups), deleting its home folder.
4. Optional: delete the throwaway GitHub account.
5. Invite Vicky no earlier than 7 days before the meeting (onboarding.md section 1).

## Acceptance (executor verifies)
- `gh api repos/ngtongsheng/gq-projects-crm/collaborators --jq '.[].login'` no longer lists the throwaway login.
- Loop Log notes the meeting is ready; project table in `~/work/AGENTS.md` updated (loop 06 done, loop 02 #06 ready).

## Out of scope
The meeting itself (loop 02 #06).
