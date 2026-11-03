# Setup rehearsal runbook

For the owner. Goal: run Vicky's setup exactly as she will, in a fresh macOS admin user on your Mac, and record what
happens in `rehearsal-sheet.md`. Block about 90 minutes. Act like her: let Claude do the work, press **Allow**, do not
fix things yourself. If a step breaks, write it in the sheet, then paste the link again (that is the repair path).

## A. Before (in your own account)
1. Note your Claude usage now (Claude Desktop, Settings, Usage). Write the % in the sheet header ("Usage before").
2. Seed the test copy: create `.env.seed.dev` with `SUPABASE_SERVICE_ROLE_KEY=<secret key of gq-crm-dev>`, run
   `pnpm seed:example`, then delete `.env.seed.dev` (docs/environments.md, "Example data on the test copy").
3. Copy one sign-in from the output, for example `test-md@example.invalid`, and its password. Passwords show once.
   Write both on paper or in a note that is not in the repo.
4. Open the test copy once so it is awake (Supabase Free pauses after 7 idle days). The seed run in step 2 is enough
   if it succeeded. If it said the project is paused, restore it in the Supabase dashboard, then seed again.
5. Check `gh auth status` works in your account. You will send the invite from here at step 15.
6. Pick a throwaway email: a Gmail +alias such as `ngtongsheng+gqtest@gmail.com`. Keep its inbox open.
7. Start a stopwatch or note the clock. The sheet has a Time taken column.

## B. Fresh user
8. Open System Settings, **Users & Groups**, **Add User**. Type: **Administrator** (this mirrors a typical owner's Mac).
   Name it `gqtest`. Set a password. Create.
9. Fast user switching: log out, or use the menu bar user icon (System Settings, Control Center, Fast User Switching,
   show in menu bar) to switch. Log in as `gqtest`. Skip the Apple ID and the setup panes.
10. Download and open Claude Desktop (claude.ai/download). Sign in with your Claude Pro login.
11. In the **Code** tab, press the folder button, make a new folder named `GQ` in the home folder, and choose it.
    Leave permissions on **Manual**.
12. Paste this link as the message and send it: `https://github.com/ngtongsheng/gq-setup`. Start the clock on setup.

## C. During setup (you are Vicky, only press **Allow** and answer prompts)
13. Answer each prompt as she would. Start the next sheet row as each step starts. Screenshot any odd message.
14. At setup step 5 choose **No, let's make one**. Make a throwaway GitHub account with the +alias email, a username
    like `gqtest-gq`. Write the username in the sheet.
15. At setup step 7 Claude says to send the username to Tong Sheng. Switch to your own account (fast user switching),
    and send the invite per `docs/onboarding.md` section 1 (PUT, then confirm `expired` is `false`). Switch back to
    `gqtest` and answer **Yes, he replied**. Note how long the invite took in the sheet.
16. At setup step 12 Claude copies the Chat text. Open Settings in Claude and note the real label (**Profile** or
    **Your Claude**) in the sheet.
17. At setup step 13 answer the four questions as Vicky would (role: Owner or manager).
18. If a step stops twice, copy Claude's message and take a screenshot, then do nothing else. Paste the link again once
    and note whether it resumed ("already done" lines).

## D. After hand-off (mirrors `docs/onboarding.md` section 2, After)
19. Press **Command + Q**, then open **Claude** again.
20. **Code** tab, folder button, choose `GQ`, then `gq-projects-crm`. Type: **show me the app**.
21. When the preview opens, sign in with the example sign-in from step 3. Record pass or fail in "sign-in".
22. Ask for one tiny change, for example: "Change the wording of one button to something friendlier." Note whether it
    makes its own space (worktree), runs `pnpm install`, and how long that takes.
23. When it offers a preview of the change, accept. Check the change shows. Record in "first change".
24. When it asks whether to put it live, pick **Not yet**. Do not deploy.
25. In your own account, close the pull request if one was opened, and delete its branch.
26. Repair test: in `gqtest`, open the `GQ` folder in the **Code** tab, paste the setup link again. Every step should
    say "already done" or pass. Record in "re-paste repair".
27. Note Claude usage again ("Usage after") and the difference.

## Capturing evidence
- Screenshot every failure, every odd wait, and any message Claude shows that you did not expect.
- Copy Claude's wording for failures into Notes (select the message, copy, paste).
- Save screenshots in `gqtest`'s Desktop, then drop them in `~/work` when you are back in your own account.
- Time taken: minutes from the step starting to Claude's "Step N of 14 done" line.

## Afterwards
Do not delete `gqtest` or the throwaway GitHub account yet; task 04 may need a re-paste. Task 06 cleans up.
