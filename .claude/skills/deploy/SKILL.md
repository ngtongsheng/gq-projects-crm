---
name: deploy
description: Put Vicky's change live. Use right after she says a previewed change looks right, or when she says to put it live.
---
# Deploy

Carries one change from its worktree to the live app at https://gq-projects-crm.vercel.app. Talk in the `plain` style.
Her "looks right" on the preview is the go-live yes, so run straight through. The repo has no auto-merge or branch
protection (GitHub Free, see `docs/debt.md`), so this skill is the gate: it merges only after every safety check is
green, and only through a pull request.

## 1. Pull request ready
1. Confirm `git branch --show-current` is a change branch, never `main`. Every push goes to that branch with
   `git push -u origin HEAD`; `main` changes only through the merge in step 2.
2. Confirm `pnpm check`, `pnpm typecheck` and `pnpm test` pass on the current code.
3. Commit anything uncommitted (`git add -A`, conventional message, 72 chars max) and push.
4. Find the pull request with `gh pr view --json number,isDraft,baseRefName`. None: `gh pr create --base main --title
   "<conventional title>" --body "<what she asked for, in her words>"`. Draft: `gh pr ready <n>`. Base other than
   `main`: `gh pr edit <n> --base main`. The title becomes the squash commit on `main`.
5. Leave her approval for the `ship-queue` skill, in case this session ends before the merge: unless the pull
   request already has a comment containing `<!-- vicky-approved -->`, run `gh pr comment <n> --body "<!-- vicky-approved -->
   Approved after preview."`. Tong Sheng's instructions count as approval too.

## 2. Checks, then merge
1. `gh pr checks <n> --watch` with a 10-minute timeout. "No checks reported" right after a push means they have not
   started; wait 30 seconds and run it again.
2. Done when `gh pr checks <n> --json name,bucket` shows `checks`, `migration-guard` and `migrate-dev` all in bucket
   `pass` (`migrate-dev` passes as a no-op when no database change is in the pull request). The Vercel check must not
   be `fail` either.
3. On a failure:
   - `migration-guard` failed: the change loses stored information. Read the flagged statements in
     `gh run view <run-id> --log-failed` and ask her about the loss as the CLAUDE.md "Who decides" section says (skip
     the question if she already approved exactly this loss). Yes: `gh pr edit <n> --add-label data-loss-approved`,
     which re-runs the checks; watch the checks again (2.1). No: stop; rework the change so nothing is lost, or
     leave it saved as a draft.
   - Any other failure: read `gh run view <run-id> --log-failed`, fix the cause, run the local checks, commit, push and
     watch the checks again (2.1). Still failing after two fixes: use `get-help`.
4. All green: note whether `gh pr diff <n> --name-only` lists anything under `supabase/migrations/`, then run
   `gh pr merge <n> --squash --delete-branch`.
5. Confirm with `gh pr view <n> --json state,mergeCommit --jq '.state, .mergeCommit.oid'`: `MERGED` plus the merge
   commit sha. Trust this over the merge command's exit code: the local branch cleanup can fail inside a worktree after
   the merge itself succeeded.

## 3. Live
1. Database change in the pull request: `gh run list --workflow migrate-prod.yml --commit <sha> --json databaseId`
   (empty right after the merge: wait 30 seconds and retry), then `gh run watch <id> --exit-status`.
2. The live build: Vercel reports through commit statuses on the merge commit, not GitHub deployments. Read
   `gh api "repos/ngtongsheng/gq-projects-crm/commits/<sha>/statuses" --jq '[.[] | select(.context == "Vercel – gq-projects-crm")][0].state'`
   (newest first; ignore the `gq-projects-crm-ym4y` project). Done when it is `success`. `pending`: check again every
   30 seconds, up to 10 minutes.
3. `curl -sI https://gq-projects-crm.vercel.app` answers `200`, or a redirect to the sign-in page.
4. Tell her in one line what is now live, in on-screen words.

A failure in this section means the change is merged but not fully live: use `get-help` straight away, no retry. Tell
her: "Your change is approved but didn't go live yet; Tong Sheng has been told. The app keeps working as before." If
`migrate-prod` failed but the build went live, mark the report urgent: the live app runs new code on the old database.

## 4. Clean up
Call ExitWorktree with `action: "remove"` and `discard_changes: true` (safe: the pull request is merged, and squash
merges always look unmerged to it). If no worktree session is active, the session started in a Desktop worktree; from
the main checkout run `git worktree remove <worktree path>` and `git branch -D <branch>`. Then `git fetch --prune`.
