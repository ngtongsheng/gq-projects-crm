---
model: opus
effort: medium
why: orchestrates git/CI/deploy invisibly with failure handling; core of the experience
depends: [08, 09]
---
# 10 Skills: preview, deploy, get-help
## Goal
Three project skills that carry Vicky's change from idea to live without her seeing the machinery.
## Context
- Load `writing-for-agents`. Follow `CLAUDE.md` + `plain` style (#09) and `docs/desktop-findings.md` (#02).
- Pipeline facts: #08 (PR checks, auto-merge, dev migrations on PR, prod migrations on merge, Vercel preview per PR).
## Files to touch
`.claude/skills/preview/SKILL.md`, `.claude/skills/deploy/SKILL.md`, `.claude/skills/get-help/SKILL.md`
## Steps
1. `preview`: ensure deps installed; start dev server (Desktop preview / `launch.json` per findings); tell her what to
   look at; offer "Share a link with your team?" → commit, push, open PR (draft), wait for the Vercel preview URL
   (`gh pr checks` / deployment status), give the link. Explain admin-only features need the link (D3).
2. `deploy`: triggered on her "put it live" or after she approves. Ask "Shall we put this live now?" (Yes / Not yet).
   On Yes: commit with conventional message, push, PR ready, `gh pr merge --auto --squash`, watch checks; on success
   watch Vercel prod deployment, confirm the live URL responds, tell her in one line. On failing checks: fix and retry
   once silently; still failing or guard-blocked → get-help. Clean up worktree/branch after merge.
3. `get-help`: write a technical report (what she asked, what failed, logs, branch/PR) as a GitHub issue assigned to
   `ngtongsheng` via `gh issue create`; tell her in plain words that the owner has been notified and what she can keep doing.
## Acceptance
Dry run by the executor on a throwaway change ("change footer text"): preview → deploy flow completes, prod shows the
change, branch and worktree removed. Revert by running the flow again. Record in loop log.
## Out of scope
Database-change explanations for destructive cases beyond escalation; Windows.
