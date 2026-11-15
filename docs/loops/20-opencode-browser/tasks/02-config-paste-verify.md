---
tier: economy
why: One file copy the owner runs; the agent only inspects the result.
depends: [01]
---
# 02 Owner pastes the opencode setting
## Goal
`~/.config/opencode/opencode.jsonc` contains the browser server, and opencode loads it without errors.
## Context
- opencode asks permission before writing outside the repo and an unattended agent cannot answer that dialog, so the
  write is owner action 3 in `loop.md`. The exact file body is `docs/loops/20-opencode-browser/assets/opencode.jsonc`.
- This machine runs opencode 1.19.0, which uses the V1 config shape: servers sit directly under `mcp`, permissions use
  the `permission` object. Do not convert it to the V2 `mcp.servers` / `permissions` array shape; 1.19.0 rejects it.
- Status: the owner may not have pasted yet. Print the exact command with the real repo path from the worktree, park the
  task as `blocked: owner — paste the config command`, and do not work around it by writing the file yourself.
## Files to touch
- None. Owner edits `~/.config/opencode/opencode.jsonc`.
## Steps
1. Print the paste command from `loop.md` owner action 3 with `<repo>` replaced by the real path.
2. Wait for the owner. When they say it is pasted, continue.
3. `opencode debug config` — must exit 0 and show `chrome-devtools` under `mcp` and `chrome-devtools_*: allow` under
   `permission`. A config error prints the offending field.
4. `opencode mcp list` — must show `chrome-devtools` as connected.
5. `diff ~/.config/opencode/opencode.jsonc docs/loops/20-opencode-browser/assets/opencode.jsonc` — must be empty.
## Acceptance
- Step 3 exits 0 and both keys appear.
- Step 4 prints `✓ chrome-devtools connected`.
- Step 5 prints nothing.
## Out of scope
Changing the instructions line beyond what the asset contains; installing the package globally; touching the repo.
