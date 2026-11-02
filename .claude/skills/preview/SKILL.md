---
name: preview
description: Show Vicky a change running on her laptop. Use after a change passes the local checks, or when she asks to see, try or share it.
---
# Preview

The preview runs on her laptop. Talk in the `plain` style; every question is an AskUserQuestion prompt with the
recommended option first.

## 1. Preview on her laptop
1. Install if needed: when `node_modules/` is missing in this folder, run `pnpm install`.
2. Clear old servers. Next runs one dev server per folder, and sign-in only works on port 3000:
   - Read `.next/dev/lock` if it exists; it holds the running server's `pid`. Run `kill <pid>`.
   - Run `lsof -ti tcp:3000`; `kill` any pid it prints (an older preview from another change).
3. Start the `crm-dev` configuration from `.claude/launch.json` in the Desktop preview pane. Without a preview pane,
   run `pnpm dev` in the background. Done when `http://localhost:3000` renders the app.
4. Tell her in one or two lines what to look at: which page, what changed on screen, what to click to try it.
5. If the change touches an admin-only feature (adding people, anything using the server secret key), add: "This part
   can't be tried on your laptop. We'll try it on the live site right after it goes live." That message on her laptop
   is by design (loop D3). Never offer a preview link, see below.

## No preview link
Do not offer a shareable preview link. Vercel's free plan locks preview links behind Tong Sheng's own login, and only
he can make one (decision 2026-11-02, `docs/decisions.md`). Everyone, including her team, previews on their own laptop
at `http://localhost:3000`. When she asks to show someone, say it runs on their own laptop after they pull the change,
or that Tong Sheng can share one on request (use `get-help`).
