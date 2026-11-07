---
model: sonnet
effort: high
why: Windows/Mac process handling and line-ending renormalisation across the repo
depends: []
---
# 04 LF line endings + cross-platform preview
## Goal
Biome formatter works on Windows (D10); the `preview` skill frees port 3000 on Windows and Mac (D9).
## Context
Vicky's help reports say "formatter off, because of Windows line endings on her PC". Her repo is
`C:\Users\vicky\GQ\gq-projects-crm`. `.claude/skills/preview/SKILL.md` step 2 uses `lsof -ti tcp:3000` and `kill`,
which do not exist on Windows. `.claude/launch.json` holds the `crm-dev` config.
## Files to touch
New `.gitattributes`, new `scripts/agent/free-port.mjs`, `.claude/skills/preview/SKILL.md`, `package.json` (script),
`.claude/settings.json` (allow the new script).
## Steps
1. `.gitattributes`: `* text=auto eol=lf`, binaries (`*.png *.jpg *.gif *.ico *.woff2`) as `binary`.
   `git add --renormalize .`; commit separately.
2. `free-port.mjs` (Node, no deps): reads `.next/dev/lock` pid if present; finds the pid listening on a port
   (`netstat -ano` on win32, `lsof -ti tcp:<port>` on darwin); kills it (`taskkill /PID <pid> /F` / `process.kill`).
   Prints what it did. Exposed as `pnpm free-port`.
3. Preview skill step 2 becomes one line: run `pnpm free-port`.
4. Allow `Bash(pnpm free-port)` in `.claude/settings.json`.
## Acceptance
- On Mac: start `pnpm dev`, run `pnpm free-port`, port 3000 free (`lsof -ti tcp:3000` empty).
- Windows branch reviewed by reading; logic unit-tested by extracting the netstat-parsing function and testing it
  with a sample `netstat -ano` output.
- `pnpm check && pnpm typecheck && pnpm test` pass.
## Out of scope
gq-setup changes (tasks 05, 13).
