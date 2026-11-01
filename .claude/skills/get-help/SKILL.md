---
name: get-help
description: Ask Tong Sheng for help with a GitHub issue assigned to him. Use when safety checks keep failing, the migration guard blocks a change, a step needs his accounts or settings, or a change is unsafe for live data (the full list is in CLAUDE.md).
---
# Get help

Hands a problem to Tong Sheng (GitHub `ngtongsheng`) as a **report** he can act on without asking her anything, then
tells Vicky in plain words where things stand.

## 1. Write the report
Everything technical goes here, never to her:
- **Asked:** what she wanted, in her words.
- **Blocked on:** the failing step and why you stopped (retry used, guard block, needs his access, unsure it is safe).
- **Evidence:** the failing command and the relevant log lines (`gh run view <run-id> --log-failed`, trimmed to the
  error), or the guard's output.
- **Where:** branch, pull request link, merge sha if merged, and whether the live app changed.
- **Next:** what you would do with his go-ahead (for a guard block: the exact statements it flagged).

## 2. File it
1. Write the report with the Write tool to `.claude/help-report.md` (gitignored, overwritten each time), so log lines
   with quotes survive intact.
2. Look for an open report on the same change: `gh issue list --assignee ngtongsheng --state open --search "<branch>"`.
   Found: `gh issue comment <n> --body-file .claude/help-report.md`.
3. Otherwise: `gh issue create --assignee ngtongsheng --title "Help: <short problem>" --body-file
   .claude/help-report.md`. Start the title with "Urgent:" instead of "Help:" when the live app is affected.
4. Done when the command prints the issue link. If `gh` itself fails (offline, signed out), skip the report and tell
   her: "I couldn't reach Tong Sheng automatically. Please message him that your change is stuck."

## 3. Tell her
One or two lines, in glossary words, with no link and no detail from the report:
- that Tong Sheng has been told and will pick it up;
- what it means right now ("the live app is unchanged", or "your change is saved as a draft");
- what she can keep doing: start another change, keep using the app, or wait for this one.
