---
name: preview
description: Show Vicky a change running on her laptop. Use after a change passes the local checks, or when she asks to see, try or share it.
---
# Preview

The preview runs on her laptop. Talk in the `plain` style; every question is an AskUserQuestion prompt with the
recommended option first.

## 1. Preview on her laptop
1. Install if needed: when `node_modules/` is missing in this folder, run `pnpm install`.
2. Test copy settings: run `pnpm copy-env` (a new worktree has no `.env.local`; this copies it from the main
   folder when that has one). Then run `grep -o "^SUPABASE_[A-Z_]*" .env.local` (names only). Done when you know
   whether `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_DEV_DB_URL` are both listed (connected) or not.
3. New database changes: when this change adds or edits a file in `supabase/migrations` (`git status --porcelain
   supabase/migrations` or `git diff --name-only origin/main...HEAD -- supabase/migrations` lists one) and her laptop
   is connected, run `pnpm db:test-copy` and wait for "up to date" or the applied list. Not connected: use the
   `connect-test-copy` skill first. Never run it for a change without new migrations.
4. Clear old servers (Next runs one dev server per folder, and sign-in only works on port 3000): run
   `pnpm free-port`. It works on Windows and Mac.
5. Start the `crm-dev` configuration from `.claude/launch.json` in the Desktop preview pane. Without a preview pane,
   run `pnpm dev` in the background. Done when `http://localhost:3000` renders the app.
6. Tell her in one or two lines what to look at: which page, what changed on screen, what to click to try it.
7. If the change touches an admin-only feature (adding people, anything using the server secret key) and her laptop is
   not connected, offer the `connect-test-copy` skill; if she declines, add: "This part can't be tried on your
   laptop. We'll try it on the live site right after it goes live." (loop D3). Connected: tell her to try it in the
   preview. To see the app as another job role, use the `test-sign-ins` skill. Never offer a preview link, see below.

## No preview link
Do not offer a shareable preview link. Vercel's free plan locks preview links behind Tong Sheng's own login, and only
he can make one (decision 2026-11-02, `docs/decisions.md`). Everyone, including her team, previews on their own laptop
at `http://localhost:3000`. When she asks to show someone, say it runs on their own laptop after they pull the change,
or that Tong Sheng can share one on request (use `get-help`).
