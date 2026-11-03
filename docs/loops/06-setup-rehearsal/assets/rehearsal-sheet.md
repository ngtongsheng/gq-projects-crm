# Rehearsal sheet

Date: · Mac / macOS version: · Throwaway GitHub username: · Usage before: % · Usage after: %

Result: pass / fail / n.t. (not testable). Break points B1-B12 are in `break-points.md`.

| Step | Watch for | Result | Time taken | Notes |
|---|---|---|---|---|
| 0 Greet | Opens with the Code tab, GQ folder, Manual permissions as in onboarding.md; asks "Ready to start?" | | | |
| 0b Check this Mac | Reads macOS version and admin group without a popup; passes on this admin user. B5: note the macOS version here and check the real Node 24 minimum matches 13.5 | | | |
| 1 Apple tools | B4: not testable here (the tools are system-wide, so expect "already done"). Covered by preflight 0b and the meeting runbook | n.t. | | |
| 2 mise | Installs to the new user's folder without a password; profile lines added to `.zprofile` and `.zshrc` | | | |
| 3 GitHub tool | B7: `mise use -g gh` downloads from GitHub unauthenticated; any rate-limit or timeout message | | | |
| 4 rtk | B7: fresh `mise use -g rtk` has never run before; version prints afterwards | | | |
| 5 GitHub account | Signup walk-through reads clearly; any step she would stall on. B9: new accounts must turn on 2FA within about 45 days; not testable in one session, so note a reminder for Vicky | | | |
| 6 GitHub sign-in | B3: does Claude show the `XXXX-XXXX` code from the background output; is it on the clipboard; does the command finish after Authorize without a keypress | | | |
| 7 Access | B8: Claude asks for the username; invite sent live from the owner account; accept works; time the invite took. Invites expire after 7 days | | | |
| 8 Download CRM | Clone into `~/GQ/gq-projects-crm` succeeds; log line prints | | | |
| 9 Download helper | Clone into `~/GQ/gq-setup` succeeds | | | |
| 10 Install tools | B5: `mise install` of Node 24 works on this macOS version; `pnpm install` time; any prompt | | | |
| 11 Set up Claude | B11: `apply.py` runs on a fresh Desktop profile; count `gq apply:` warning lines, and whether `~/.claude/settings.json` already existed and merged cleanly | | | |
| 12 Chat tab | B10: real Settings label (**Profile** or **Your Claude**); the paste box is found; text saved | | | |
| 13 About you | Four questions work; "About me" block ends up in `~/.claude/CLAUDE.md` below the import line | | | |
| 14 Hand-off | Message matches onboarding.md section 2; restart and the folder choice are clear | | | |
| First preview | B1: after Command + Q and reopen, "show me the app" starts `pnpm` from `.claude/launch.json`; is pnpm found when Desktop starts from the Dock (not from a shell) | | | |
| Sign-in | B2: the example sign-in works on `gq-crm-dev`; any pause or wake-up delay | | | |
| First change | B12: worktree has no `node_modules`; the preview skill's `pnpm install` time and prompts; the change is visible; deploy question answered **Not yet** | | | |
| Re-paste repair | Pasting the link again: every step reports "already done" or passes; nothing is reinstalled or overwritten | | | |
| Whole session | B6: Claude usage % used from start to end (record before and after in the header), with Opus as default | | | |

## Findings to carry to task 04
One line each: step, what happened, screenshot file name.

-
