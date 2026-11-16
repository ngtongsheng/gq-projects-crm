---
name: preview
description: Show Vicky a change running on her laptop. Use after a change passes the local checks, or when she asks to see, try or share it.
---
# Preview

The preview runs on her laptop. Talk in the `plain` style; every question is an AskUserQuestion prompt with the
recommended option first.

## 1. Preview on her laptop
1. Run `pnpm -s catch-up`. It installs, copies the test copy keys, applies new database changes and refreshes the
   test sign-ins, only where something changed. Done when it exits 0. It prints nothing when all is current. Exit 1:
   fix the step it names using `docs/laptop.md`; if it could not get the keys, use the `connect-test-copy` skill.
2. Clear old servers (Next runs one dev server per folder, and sign-in only works on port 3000): run
   `pnpm free-port`. It works on Windows and Mac.
3. Start the `crm-dev` configuration from `.claude/launch.json` in the Desktop preview pane. Without a preview pane,
   run `pnpm dev` in the background. Done when `http://localhost:3000` renders the app.
4. Tell her in one or two lines what to look at: which page, what changed on screen, what to click to try it.
5. If the change touches an admin-only feature (adding people, anything using the server secret key) and catch-up
   could not get the keys, offer the `connect-test-copy` skill; if she declines, add: "This part can't be tried on
   your laptop. We'll try it on the live site right after it goes live." (loop D3). Otherwise tell her to try it in
   the preview. To see the app as another job role, she uses the floating panel at the bottom of the page. Never
   offer a preview link, see below.

## No preview link
Do not offer a shareable preview link. Vercel's free plan locks preview links behind Tong Sheng's own login, and only
he can make one (decision 2026-11-02, `docs/decisions.md`). Everyone, including her team, previews on their own laptop
at `http://localhost:3000`. When she asks to show someone, say it runs on their own laptop after they pull the change,
or that Tong Sheng can share one on request (use `get-help`).
