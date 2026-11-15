---
tier: standard
why: A real agent run through the new server, with several ways to fail (port, env, server startup, Chrome grant).
depends: [02]
---
# 03 End to end through opencode
## Goal
An opencode session, not the package CLI, opens the app in Vicky's Chrome and saves a screenshot of it.
## Context
- The dev server runs at `http://localhost:3000`; sign-in only works there (see `.claude/skills/preview/SKILL.md`).
- `.env.local` holds the test-copy settings and is not committed; `.env.development` is committed. Run `pnpm copy-env`
  in the worktree first, then `pnpm free-port`, then `pnpm dev` in the background.
- `opencode run --auto "..."` starts a fresh session, so it picks up the pasted config. `--auto` answers the permission
  prompts a headless run cannot answer.
- The server `chrome-devtools` starts Chrome through `--autoConnect`; only one client can hold that connection, so make
  sure the task 01 daemon was stopped (`chrome-devtools status` says not running).
## Files to touch
- None in the repo. Scratch output under `/tmp/oc-browser-smoke`.
## Steps
1. In the worktree: `pnpm copy-env`, `pnpm free-port`, then start `pnpm dev` in the background and wait until
   `curl -sf -o /dev/null http://localhost:3000` succeeds (up to 120 seconds).
2. `opencode run --auto "Use the chrome-devtools tools: open http://localhost:3000, take a screenshot with filePath /tmp/oc-browser-smoke/e2e.png, and tell me the page title and whether it is the sign-in page."`
3. Read the run output; record whether Chrome asked for permission and how the run behaved.
4. Stop the dev server.
## Acceptance
- Step 2 exits 0 and its output names the page (sign-in page expected).
- `test -s /tmp/oc-browser-smoke/e2e.png` passes.
- No config error appears in the run output.
## Out of scope
Changing app code or styles; tidying the repo; running `pnpm check` (no repo files change).
