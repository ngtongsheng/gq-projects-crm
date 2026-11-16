---
tier: frontier
why: orchestrates install, keys, migrations, seed and state across Mac/Windows; must be idempotent and never block her
depends: [02]
---
# 03 `pnpm catch-up`
## Goal
One command brings any laptop checkout (main folder or worktree) up to date for local work against the dev database,
prints one plain line, and is a silent no-op in about 2 seconds when nothing changed.
## Context
- Loop D4, D7. Vicky is not a developer; output is one plain sentence (glossary words: "the test copy", "test
  sign-ins"). Details go to a log file in the git dir, not the screen.
- Existing commands it calls: `pnpm install`, `pnpm copy-env`, `pnpm db:test-copy`, `pnpm seed:example`,
  `pnpm free-port` (see `package.json`). `seed:example` also creates the 17 test people (`scripts/example-data/
  test-users.ts`); it is guarded to the dev database.
- Keys: `fetchDevKeys()` / `mergeEnvLocal()` from `scripts/agent/dev-keys.mjs` (#02). Fetch only when `.env.local`
  lacks either key, or `db:test-copy`/seed fails with an auth error (then refetch once).
- Invites: `gh api user/repository_invitations` → accept (`PATCH user/repository_invitations/<id>`) only those whose
  `inviter.login` is `ngtongsheng`.
- Stamp: JSON in `$(git rev-parse --git-common-dir)/gq-catch-up.json` with hashes of `pnpm-lock.yaml`,
  `supabase/migrations/*` names, `scripts/example-data/**` + `scripts/seed-example-data.ts`, and the last shown
  whats-new version. Pattern for a stamp file: `scripts/agent/session-sync.mjs` (`agent-sync-at`).
- What's new: `docs/whats-new.md` first line `version: YYYY-MM-DD`; when newer than the stamp, print the file body
  after the status line so Claude relays it; then record it. Rename `docs/whats-new-2026-11.md` to
  `docs/whats-new.md` with the version header (content rewritten in #10).
- Must work in a worktree (uses `copy-env` first) and in the main folder. Node stdlib only; spawn `pnpm` with
  `shell: true` on Windows like `free-port.mjs`.
- Failure policy: a failed step does not stop later independent steps; final line names what could not be done in
  plain words and says "Claude will sort it out"; exit code 1 so the agent sees it. No network (offline): skip fetch
  and invites silently.
- Leave a clear hook for #04: an exported `archivePreParity()` step slot called last (no-op until #04).
## Files to touch
- `scripts/agent/catch-up.mjs`
- `scripts/agent/catch-up.test.ts` (temp dir + temp git repo, stub runner injected; cases: nothing changed → no steps
  and no output; lockfile change → install; migration added → db:test-copy; seed change → seed; missing keys →
  fetch+merge; whats-new shown once; one step failing → others still run, exit 1)
- `package.json` (`"catch-up": "node scripts/agent/catch-up.mjs"`)
- `docs/whats-new.md` (renamed, version header)
## Steps
1. Read `session-sync.mjs`, `free-port.mjs`, `copy-env-local.mjs` for structure and test style; match them.
2. Implement with an injectable command runner for tests.
3. Run it for real in the loop worktree once the owner action is done: first run does work, second run silent.
## Acceptance
- `pnpm test scripts/agent/catch-up.test.ts`, `pnpm check`, `pnpm typecheck` pass.
- In the worktree: `pnpm catch-up` exits 0; immediate second run prints nothing and takes < 3 s (`time`).
## Out of scope
Archiving (#04), hook and CLAUDE.md wiring (#05). Never run against prod.
