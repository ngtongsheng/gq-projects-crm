---
model: opus
effort: medium
why: Rewrites the instructions that govern Vicky's agent; judgment on tone, autonomy boundaries and safety
depends: [02]
---
# 06 Rewrite agent rules
## Goal
Vicky's agent follows D1, D2, D4, D5 everywhere: autonomous, her preview OK ships, batched changes, real data loss
needs her plain-words yes, owner only for accounts/secrets/billing/stuck failures.
## Context
Read loop.md decisions D1-D5, D14. Use the `writing-for-agents` skill. Current rules: CRM `CLAUDE.md` sections
"Talking about changes", "A change, start to finish", "Database and data", "Call get-help when";
`.claude/skills/deploy/SKILL.md` (asks "Shall we put this live now?", stops on guard failure);
gq-setup `agent/skills/get-help/SKILL.md` description lists CRM triggers. Evidence of the problem: issues 22, 24, 26
parked business decisions on the owner; PRs left as drafts and stacked.
## Files to touch
`CLAUDE.md`, `.claude/skills/deploy/SKILL.md`, `docs/glossary.md` if wording changes,
`~/work/projects/gq-setup/agent/skills/get-help/SKILL.md` (gq-setup worktree).
## Steps
1. CLAUDE.md flow: start from `main`, one change branch per batch; add small changes/fixes to the open batch; new
   module or breaking change = own branch; never base a branch on another change branch.
2. Her "looks right" after preview = go live; deploy runs immediately and reports one line.
3. Who decides: Vicky for who-sees-what and record reshapes that keep data; real data loss: ask her naming exactly
   what disappears, on yes add `data-loss-approved`; owner only for accounts, secrets, billing, or failure after two
   fixes.
4. Deploy skill: drop the extra yes, PR never left draft, guard failure → data-loss question to Vicky, not get-help.
5. get-help description/triggers aligned with the narrower list.
6. Keep each file shorter than before where possible.
## Acceptance
- `grep -rn "owner-approved\|Shall we put this live" CLAUDE.md .claude docs ~/work/projects/gq-setup/agent` empty
  (decisions/loops history excluded).
- A fresh subagent given only CLAUDE.md + deploy skill answers correctly: (a) Vicky asks Purchasing to see costs →
  build, preview, ship, no get-help; (b) a migration drops a column → ask Vicky; (c) CI token fails → get-help.
## Out of scope
Session hook (07), ship queue (08).
