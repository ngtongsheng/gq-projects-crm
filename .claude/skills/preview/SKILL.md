---
name: preview
description: Show Vicky a change running on her laptop, then offer a preview link for her team. Use after a change passes the local checks, or when she asks to see, try or share it.
---
# Preview

Two parts: the **preview** on her laptop, then an optional **preview link** her team can open. Talk in the `plain`
style; every question is an AskUserQuestion prompt with the recommended option first.

## 1. Preview on her laptop
1. Install if needed: when `node_modules/` is missing in this folder, run `pnpm install`.
2. Clear old servers. Next runs one dev server per folder, and sign-in only works on port 3000:
   - Read `.next/dev/lock` if it exists; it holds the running server's `pid`. Run `kill <pid>`.
   - Run `lsof -ti tcp:3000`; `kill` any pid it prints (an older preview from another change).
3. Start the `crm-dev` configuration from `.claude/launch.json` in the Desktop preview pane. Without a preview pane,
   run `pnpm dev` in the background. Done when `http://localhost:3000` renders the app.
4. Tell her in one or two lines what to look at: which page, what changed on screen, what to click to try it.
5. If the change touches an admin-only feature (adding people, anything using the server secret key), add: "This part
   works on the preview link, not on your laptop." That message on her laptop is by design (loop D3).

## 2. Preview link for the team
Ask "Share a link with your team?" with options "Yes, make a preview link (recommended)" / "No, just me". Skip this part
on "No".

1. Save a draft: confirm `git branch --show-current` is not `main` (if it is, stop: the change belongs in its own
   worktree per CLAUDE.md). `git add -A`, `git commit -m "<type>: <what changed>"` (conventional, 72 chars max),
   `git push -u origin HEAD`.
2. Open the pull request as a draft if none exists (`gh pr view` finds it otherwise):
   `gh pr create --draft --title "<conventional title>" --body "<what she asked for, in her words>"`. The title becomes
   the squash commit on `main`, so keep it conventional.
3. Wait for the safety checks: `gh pr checks <n> --watch` with a 10-minute timeout. "No checks reported" right after
   a push means they have not started; wait 30 seconds and run it again. `migrate-dev` must finish first because the
   preview link uses the test copy.
   - A failing check: read `gh run view <run-id> --log-failed`, fix the cause, run the local checks, commit, push and
     watch again. One silent retry. Still failing, or `migration-guard` failed: use `get-help`.
4. Find the link. Vercel does not create GitHub deployments here; it reports through commit statuses and one bot
   comment on the pull request. The repo has two Vercel projects; only `gq-projects-crm` counts (ignore
   `gq-projects-crm-ym4y`). First wait until its status is `success`:
   `gh api "repos/ngtongsheng/gq-projects-crm/commits/$(gh pr view <n> --json headRefOid --jq .headRefOid)/statuses" --jq '[.[] | select(.context == "Vercel – gq-projects-crm")][0].state'`
   (newest first). `pending`: check again every 30 seconds, up to 10 minutes. `failure` or `error`: treat as a failing
   check above. Then read the link from the bot comment:
   `gh pr view <n> --json comments --jq '[.comments[] | select(.author.login == "vercel")][0].body' | grep -oE 'https://gq-projects-crm-git-[a-z0-9-]+\.vercel\.app' | head -1`
   The link is stable per branch and follows the latest push. No comment yet: wait 30 seconds and read again.
5. Check the link opens: `curl -sI <link>`. A `401`, or a `302` to `vercel.com/sso-api` (then `vercel.com/login`), means the link is locked
   behind a login only Tong Sheng can turn off: use `get-help`, then still give her the link with that caveat.
6. Give her the link in one line, plus: "It uses the test copy, so people sign in with their test copy account and
   nothing they do touches real records." Accounts on the live app do not exist on the test copy; adding someone
   there is an admin task she can do on the preview link itself.
