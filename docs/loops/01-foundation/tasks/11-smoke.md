---
model: sonnet
effort: high
why: cross-cutting verification across app, CI, Vercel, Supabase
depends: [06, 10]
---
# 11 End-to-end smoke
## Goal
Prove the foundation works as Vicky will use it, and record what loop 02 needs.
## Context
Everything in loop 01. Seed script from #05.
## Files to touch
`docs/loops/01-foundation/loop.md` (log), `docs/decisions.md` (append findings for loop 02), `docs/environments.md`
## Steps
1. Seed admins on prod: owner (`ngtongsheng@gmail.com`) and a placeholder for Vicky (owner supplies her email at loop 02; skip if unknown).
2. On prod: sign in as owner, add a test staff person, use the invite link, sign in as staff, confirm People is hidden; delete the test person.
3. Run one full preview → deploy cycle through the skills with a tiny visible change.
4. Append to `docs/decisions.md` under "Loop 02 inputs": anything learned that changes the setup plan.
## Acceptance
All steps pass on prod; prod URL in `docs/environments.md`; `pnpm check && pnpm typecheck && pnpm test && pnpm build` pass on main.
## Out of scope
Vicky's machine, CRM features.
