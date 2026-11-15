---
tier: standard
why: The MCP server, the CLI daemon and Chrome's own limits each fail in different ways; the task must tell them apart.
depends: []
---
# 01 Prove the Chrome connection with the package CLI
## Goal
Show that `chrome-devtools-mcp` can attach to the running Chrome, drive a page and save a screenshot, using the
package's own CLI, before opencode gets involved.
## Context
- Owner actions 1-2 in `loop.md` must already be done. Chrome 157 is running on this machine.
- `chrome-devtools-mcp@1.13.0` also ships a CLI. Its daemon is separate from opencode, so this proves the Chrome side on
  its own. It must be stopped afterwards or it holds the debugging connection.
- Run every command in a temp folder, never the repo: `mkdir -p /tmp/oc-browser-smoke` and use it as cwd.
- Failure meanings: `EPERM: operation not permitted` / `Could not find DevToolsActivePort` = macOS files-and-folders
  permission missing (owner action 2). `ProtocolError: Network.enable timed out` = remote debugging not enabled, or
  another client is holding the connection.
## Files to touch
- None in the repo. Scratch files only under `/tmp/oc-browser-smoke`.
## Steps
1. Confirm Chrome is up: `pgrep -f "Google Chrome.app/Contents/MacOS/Google Chrome" >/dev/null && echo running`.
2. `npx -y -p chrome-devtools-mcp@1.13.0 chrome-devtools status`.
3. `npx -y -p chrome-devtools-mcp@1.13.0 chrome-devtools start --autoConnect`. If it blocks for more than 60 seconds,
   stop and report `blocked: owner — click Allow in the Chrome dialog`.
4. `npx -y -p chrome-devtools-mcp@1.13.0 chrome-devtools navigate_page 1 --url "https://example.com"`.
5. `npx -y -p chrome-devtools-mcp@1.13.0 chrome-devtools take_screenshot 1 --filePath /tmp/oc-browser-smoke/ok.png`.
6. `npx -y -p chrome-devtools-mcp@1.13.0 chrome-devtools stop`.
7. Note in the report whether Chrome asked for permission and whether it was asked once or on every start.
## Acceptance
- Step 4 prints a successful navigation to `https://example.com`.
- `test -s /tmp/oc-browser-smoke/ok.png` passes and the file is larger than 1 KB.
- `chrome-devtools stop` reports the daemon stopped.
## Out of scope
Editing opencode config, running opencode sessions, touching the repo.
