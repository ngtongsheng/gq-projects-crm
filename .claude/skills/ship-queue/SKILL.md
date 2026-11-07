---
name: ship-queue
description: Tidy Vicky's saved changes on GitHub. Run in the background at the start of every session, after the session-sync output.
---
# Ship queue

Finishes what she already approved and keeps the rest current, so she never handles git (loop D6). Run it in a
background subagent. Talk to her in the `plain` style; the only output she sees is the one-line report in step 7.
Nothing here pushes to `main` or force-pushes: `main` changes only through `gh pr merge`.

`--dry-run` (or "dry run" in the request): run steps 1 to 6 with read-only commands only (`git fetch`, `gh ... list`
and `view`, `git cherry`, `git worktree list`, `git status`). Do not merge main in, push, comment, merge,
close, ready or remove anything; print one `would <action>: <reason>` line per planned action and skip step 7.

`<login>` is `gh api user --jq .login`; a dry run for another account names it in the request.

## 1. Read the queue
1. `git fetch --prune origin`.
2. `gh pr list --author <login> --state open --json number,title,headRefName,baseRefName,headRefOid,isDraft,mergeable,statusCheckRollup`.
3. Skip the pull request whose head is the branch of the session you run from (`git branch --show-current`); that
   session is still working on it.
4. Done when every listed pull request has a state: **chain** (base is not `main`), **approved** (a comment by
   `<login>` whose body contains `<!-- vicky-approved -->`, read with `gh pr view <n> --json comments`), **green**
   (`checks`, `migration-guard` and `migrate-dev` all `SUCCESS` or `SKIPPED` in `statusCheckRollup`, no Vercel check
   failed, `mergeable` is `MERGEABLE`), **ready** (not a draft).
5. Approved but never pushed: a worktree under `.claude/worktrees/` whose branch has no open pull request and a
   marker file `$(git rev-parse --git-common-dir)/vicky-approved-<branch>` (`/` as `-`; deploy writes it when a step was refused).
   Run `deploy` from that worktree; it removes the marker once the pull request exists. Refused again: leave it and
   report it, no second `get-help` for the same step.

## 2. Close what is already in main
A pull request is superseded when `git cherry origin/main origin/<head>` prints no `+` line (every commit is already
in `main`, squash merges included). Close it: `gh pr close <n> --comment "Already in main."`. Leaves the branch alone.

## 3. Bring a waiting branch up to date with main
Pull requests are squash-merged, so a branch's own history never reaches `main`, and a plain push cannot overwrite
work on GitHub. That is why this step merges `main` in and never rebases or force-pushes.

A pull request needs this when its base is not `main`, or it is `CONFLICTING`/behind `main` and not superseded.
1. Base pull request still open (`gh pr list --head <base> --state open`): this one waits for it. Merging `main`
   in would turn the base's commits into its own. Handle the base first; report "waiting on <base title>".
2. Work where the branch lives. `git worktree list` shows whether another folder has `<head>` checked out: use it
   only when `git status --porcelain` is empty and `HEAD` equals `origin/<head>`; otherwise skip this pull request
   (that session owns it). Not checked out anywhere: `git worktree add .claude/worktrees/ship-queue-<n> --detach origin/<head>`.
3. `git merge origin/main`. Clean: `git push origin HEAD:<head>` (only the change branch; `main` changes only
   through `gh pr merge`), then `gh pr edit <n> --base main` if the base differs.
4. Conflicts: resolve once so both sides' intent survives, run `pnpm check`, `pnpm typecheck`, `pnpm test`, commit
   the merge and push as in 3. Any step fails or the right resolution is unclear: `git merge --abort`, leave the
   pull request, report it.
5. Remove a `ship-queue-<n>` folder you made when done (`git worktree remove`).

## 4. Fix a failing check
A green-less pull request that is not waiting on a base: read `gh run view <run-id> --log-failed`, fix the cause once
in a worktree as in 3.3, run the local checks, push (a normal push), watch `gh pr checks <n> --watch`. Still failing:
leave it and report it. A `migration-guard` failure is the data-loss question for Vicky; never add
`data-loss-approved` here.

## 5. Merge what she approved
Per pull request that is approved, green and based on `main`, oldest first: `gh pr ready <n>` when it is a draft,
then the `deploy` skill's sections 2 (merge) and 3 (live), skipping its section 1 and 4. After each merge, run
`git fetch origin` and go back to step 3 for the rest, since `main` moved. Stop after 10 merges.

## 6. Remove finished worktrees
From `git worktree list --porcelain`, for each folder under `.claude/worktrees/` that is not the current folder:
look up `gh pr list --head <branch> --state all --json number,state,headRefOid`. Remove it only when a pull request
exists, every one is `MERGED` or `CLOSED`, `git status --porcelain` is empty there, and its `HEAD` equals that pull
request's `headRefOid` (anything newer is work nobody has seen). Then `git worktree remove <path>` (no `--force`) and
`git branch -D <branch>`. Done when each such folder is removed or has a stated reason it stays.

## 7. Report
One line to Vicky in on-screen words: what went live, what waits on her review, what is being fixed, e.g. "The
company rating page is now live. The sales summary is waiting for your look. The dashboard tiles needed a fix and
are saved again." Nothing changed: say nothing. Anything left stuck (update or fix failed): add "Tong Sheng has been
told" and use `get-help`.
