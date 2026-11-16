<!-- Opened by task 10 with: gh issue create --label for:vicky-claude --title "<title below>" --body-file <the body below>
     The title is line 1 after "Title:"; the body is everything under "Body". -->
Title: Update this laptop to the new setup (one time)

## Body

For Vicky's Claude. This is a one-time update of her laptop, not a change to build. Rehearsed in loop 22 task 09.

**Do it yourself, now, before anything else in this session, including the ship-queue tidy-up.** Do not start a
subagent and do not use a worktree for it. No build, no checks, no preview, no deploy.

1. Work in the main folder: the first path in `git worktree list`. If you are in a worktree, run every command below
   with that folder as the working directory.
2. In the main folder, check it is on `main` with nothing unsaved: `git branch --show-current` prints `main` and
   `git status --porcelain` prints nothing. If not, change nothing, comment the two outputs on this issue,
   run `gh issue edit <this issue> --add-assignee ngtongsheng` and stop; tell Vicky "Tong Sheng is finishing an
   update to your laptop."
3. `git pull --ff-only` in the main folder.
4. Re-read `CLAUDE.md` and `docs/laptop.md` from the main folder. The rules changed: from now on every session starts
   with `pnpm --silent catch-up`.
5. Run `pnpm --silent catch-up` in the main folder. The first run takes a few minutes (it installs packages, fetches the
   test copy keys, updates the test copy, sets up the test sign-ins and saves older drafts).
6. Tell Vicky its first line in plain words, then 3 to 5 plain lines from the "What's new" part.
7. If it exited 1, fix the step it names with `docs/laptop.md` (situation 10 if it could not get the test copy keys),
   then run it again.
8. Close this issue with a one-line comment saying what the laptop now has, for example:
   `gh issue close <this issue> --comment "Laptop updated: packages, test copy keys, test copy, 17 test sign-ins; older drafts saved as archive tags."`
   If step 7 still fails after two fixes, comment what failed instead, assign `ngtongsheng` and leave it open.
