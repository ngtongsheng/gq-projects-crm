---
model: sonnet
effort: high
why: adapting four existing skills; moderate judgment on what to strip, plus a get-help change that must work from any folder
depends: [01]
---
# 02 Global skills
## Goal
`gq-setup/agent/skills/{tdd,diagnosing-bugs,grilling,get-help}/` ready to be symlinked into `~/.claude/skills/`.
## Context
- Load `writing-for-agents` first. Loop decision D4.
- Sources: `~/work/config/claude/skills/tdd/`, `~/work/config/claude/skills/diagnosing-bugs/`,
  `~/work/config/agents/skills/grilling/`, CRM `.claude/skills/get-help/SKILL.md`. Copy supporting files too.
- Adaptation: no herdr, loops, vault, lessons.md or owner-only paths. Anything shown to the person follows the plain
  style (`gq-setup/agent/output-styles/plain.md`). Grilling questions go through AskUserQuestion in plain words.
- get-help must work from any folder: `gh ... -R ngtongsheng/gq-projects-crm`; report file at
  `~/GQ/.help-report.md` (outside every repo); label `from:crm` when cwd is inside `~/GQ/gq-projects-crm`, else
  `from:other`; create the label with `gh label create ... --force` if missing. Triggers: the CRM's list (CRM
  `CLAUDE.md` "Call get-help when") inside the CRM; elsewhere two failed fix attempts, a step needing Tong Sheng's
  accounts/passwords/payment, or anything unsafe. Keep report format and "tell her" step.
## Files to touch
`gq-setup/agent/skills/**`
## Steps
1. Copy the four skills; adapt per Context. Keep each `description` precise so it triggers without its name being said.
2. Remove the forked-from comment only if it references owner-private paths; keep attribution otherwise.
## Acceptance
- `grep -rniE "herdr|plan-loop|execute-loop|vault|lessons\.md|/Users/" gq-setup/agent/skills` → no output.
- `grep -n "\-R ngtongsheng/gq-projects-crm" gq-setup/agent/skills/get-help/SKILL.md` → matches on every `gh issue`.
- Commit in gq-setup (`feat: add global skills`), push.
## Out of scope
Removing get-help from the CRM (#06); new skills.
