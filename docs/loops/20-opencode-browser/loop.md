# Loop 20: Browser control in opencode
Orchestrator: standard
## Goal
opencode can drive Vicky's own Chrome (her profile, her sign-ins) so an agent opens `http://localhost:3000` and the live
app by itself, takes screenshots and reads the page. Done when the connection is proven end to end, the setting lives in
her opencode settings, and the decision is recorded.
## Decisions
| ID | Decision | Why | Rejected |
|---|---|---|---|
| D1 | Use `chrome-devtools-mcp` 1.13.0 (Google) with `--autoConnect`: it attaches to the Chrome she already has open, with her profile and sign-ins. Claude in Chrome cannot be loaded in opencode (its tools exist only inside Claude sessions) | Owner's chosen goal: "drive my real Chrome" | Playwright MCP (separate profile, no sign-ins); browser-use (heavy Python agent); a Claude pane and the extension (Claude-only) |
| D2 | No permission prompts for browser tools (`"chrome-devtools_*": "allow"`), per the owner's answer | Owner decision; opencode's own default already allows every tool, the line documents it | Ask on clicks/typing/navigation |
| D3 | Config goes in `~/.config/opencode/opencode.jsonc`, not the repo | Her laptop setting; the app repo stays free of personal harness config | `opencode.json` committed to the repo |
| D4 | The config write is an owner action: opencode asks before writing outside the repo and an unattended agent cannot answer that prompt. The file body is in `assets/opencode.jsonc` so she pastes one command | Executor cannot click a permission dialog | An `external_directory` allow rule (weakens every later write) |
| D5 | Pin `chrome-devtools-mcp@1.13.0`, `--no-usage-statistics` off (opt out of Google telemetry) | Reproducible; internal company app | `@latest` |
| D6 | Preflight: `npx` download of the MCP package at session start is approved as part of this plan; `bash` is allowed by default so no rule is needed. Chrome settings (`chrome://inspect`, macOS Files & Folders, the Allow dialog) are owner actions | Loop 1b | - |
| D7 | Known limits, written down rather than worked around: autoConnect needs Chrome 144+ (installed 157) and one-time enablement at `chrome://inspect/#remote-debugging`; macOS may require Ghostty to have Files & Folders access to Google Chrome; the Allow dialog may reappear and is reported, not worked around; page content reaches the model, so a hostile page is a real risk now that clicks are unprompted | Accuracy over silent assumptions | - |
## Tasks
| # | Task | Status | Depends | Tier |
|---|---|---|---|---|
| 01 | Prove the Chrome connection with the package CLI | done | - | standard |
| 02 | Owner pastes the opencode setting | done | 01 | economy |
| 03 | End to end through opencode | in-progress | 02 | standard |
| 04 | Record the decision | todo | 03 | economy |
<!-- status: todo | in-progress | done | blocked: <reason> -->
## Owner actions
Do these before task 01; the agent parks task 01 if Chrome cannot be reached.
1. In Chrome open `chrome://inspect/#remote-debugging` and turn on remote debugging; allow the connection if it asks.
2. If task 01 reports `EPERM: operation not permitted` or `Could not find DevToolsActivePort`: System Settings →
   Privacy & Security → Files and Folders → allow **Ghostty** access to **Google Chrome**, then rerun task 01.
3. Task 02, paste this one line in a terminal (it backs up the old file first):
   ```sh
   cp ~/.config/opencode/opencode.jsonc ~/.config/opencode/opencode.jsonc.bak && cp "<repo>/docs/loops/20-opencode-browser/assets/opencode.jsonc" ~/.config/opencode/opencode.jsonc
   ```
   Replace `<repo>` with the folder the worktree was created in (the executor prints the exact path).
4. If Chrome shows "Allow" when the agent connects, click **Allow**.
## Log
<!-- one line per event: YYYY-MM-DD · #NN · result · next -->
2026-11-15 · plan · loop written; autoConnect + CLI + V1 permission path verified on this machine · next: owner actions 1-2, then #01
2026-11-15 · #01 · start · delegating (tier standard -> session model, downgrade) · proving CLI/Chrome connection
2026-11-15 · planner · asked w7:tN to close; answered YES; tab closed · continue
2026-11-15 · #01 · blocked: owner · CLI starts fine, `navigate_page` fails `Could not find DevToolsActivePort`; Chrome 157 runs window-less with no debug port · owner enables remote debugging, then rerun
2026-11-15 · #01 · decision · `Could not find DevToolsActivePort` treated as remote-debugging-off (owner action 1), not macOS Files & Folders (action 2) · profile dir is listable, so the permission exists
2026-11-15 · #02-#04 · skipped · all depend on #01 · loop parked until Chrome is reachable
2026-11-15 · vault · ~/work/vault/sessions/gq-projects-crm/2026-11-15-loop-20-opencode-browser.md
2026-11-15 · #01 · retry · owner enabled remote debugging (DevToolsActivePort 9222 now present) · delegating again
2026-11-15 · #01 · done · `start --autoConnect` attaches to her Chrome, navigated example.com, 312 KB screenshot, daemon stopped, no Allow dialog · next #02
2026-11-15 · #02 · blocked: owner · `~/.config/opencode/opencode.jsonc` is a symlink to `~/work/config/opencode/opencode.jsonc` and has no `mcp` block yet · owner pastes owner action 3
2026-11-15 · #02 · decision · the paste writes through the symlink into the synced hub config (tracked in `~/work`) · it is this machine's only opencode config, so that is the right file; commit it with `WORK_SYNC=1` after the paste
2026-11-15 · #02 · decision · `assets/opencode.jsonc` is a superset of the current file (same instructions line) · pasting loses no setting
2026-11-15 · #02 · done · paste verified: `opencode debug config` shows the mcp + permission keys, `opencode mcp list` → `✓ chrome-devtools connected`, diff vs asset empty · next #03
2026-11-15 · #03 · start · delegating (tier standard -> session model, downgrade) · opencode session drives her Chrome against localhost:3000
