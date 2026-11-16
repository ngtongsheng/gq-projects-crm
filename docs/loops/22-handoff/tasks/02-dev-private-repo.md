---
tier: standard
why: new repo plus two small scripts that handle secrets; must never print values
depends: [01]
---
# 02 Private dev repo, key upload script, key fetch
## Goal
A private, generic repo `ngtongsheng/gq-dev-private` exists with Vicky (`vicky-gq`) invited read-only, plus a script
the owner runs to upload the dev database keys, and a library function catch-up uses to fetch them.
## Context
- Loop D3. The CRM repo is public; secrets never enter it. Only dev values, never prod.
- Keys: `SUPABASE_SERVICE_ROLE_KEY` (dev secret key) and `SUPABASE_DEV_DB_URL` (dev Postgres URL with password).
  The owner's main-checkout `.env.local` holds both (written by `scripts/connect-test-copy.ts`; read it for the format
  and the dev-ref guard). No agent reads `.env*` content: the upload script does it when the owner runs it.
- `src/lib/supabase/test-copy.ts` has `DEV_PROJECT_REF`; both scripts refuse values that do not contain it.
- Existing pattern: `scripts/agent/copy-env-local.mjs` (+ test) for merging/copying env files, Node stdlib only,
  Windows and Mac.
## Files to touch
- `scripts/agent/upload-dev-keys.mjs` (owner runs once; reads `.env.local`, checks both keys point at the dev ref,
  writes `crm/.env.dev` to the private repo via `gh api -X PUT repos/ngtongsheng/gq-dev-private/contents/crm/.env.dev`
  with base64 content, passing the body on stdin, never argv; prints "Uploaded" or a plain error, never values)
- `scripts/agent/dev-keys.mjs` (exports `fetchDevKeys()` using `gh api ... --jq .content`, decode, parse, dev-ref
  check; and `mergeEnvLocal(path, keys)` that keeps other lines, sets mode 600)
- `scripts/agent/dev-keys.test.ts` (merge keeps unrelated keys, replaces changed ones, refuses a prod ref; parse of
  the env text; run in a temp dir)
- `gq-dev-private` repo: `README.md` saying what it is (dev-only credentials and test data for GQ apps, never prod,
  layout `<app>/...`)
## Steps
1. `gh repo create ngtongsheng/gq-dev-private --private --add-readme` if missing; push the README text.
2. `gh api -X PUT repos/ngtongsheng/gq-dev-private/collaborators/vicky-gq -f permission=pull` (pending invite is
   fine; catch-up accepts it).
3. Write both scripts and the test.
4. Log owner action as ready in loop.md (the executor parks #03 until the file exists).
## Acceptance
- `gh repo view ngtongsheng/gq-dev-private --json isPrivate` → `true`.
- `gh api repos/ngtongsheng/gq-dev-private/invitations --jq '.[].invitee.login'` lists `vicky-gq` or she is already a
  collaborator.
- `pnpm test scripts/agent/dev-keys.test.ts`, `pnpm check`, `pnpm typecheck` pass.
- Grep both scripts: no `console.log` of key values.
## Out of scope
Running the upload (owner action). Calling fetch from catch-up (#03).
