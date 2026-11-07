---
model: sonnet
effort: high
why: Secrets handling and a guarded DB push; must make prod unreachable from her laptop
depends: [04]
---
# 09 Test-copy kit
## Goal
After one paste, Vicky's laptop can use admin features and new migrations on the test copy, and she can sign in as any
role there (D7, D11).
## Context
`.env.development` points local at `gq-crm-dev` (ref `heobsflkmqwkesfgbehz`). Admin features need
`SUPABASE_SERVICE_ROLE_KEY`; laptop shows "can't be tried on your laptop" without it (`grep -rn "tried on your" src`).
`pnpm seed:example` (`scripts/seed-example-data.ts`, `scripts/example-data/people.ts` `TEST_USERS`) creates role
sign-ins and refuses non-dev URLs. Settings deny `supabase db push`. PRs 30/31 exist only to push migrations to dev.
## Files to touch
New `.claude/skills/connect-test-copy/SKILL.md`, new `.claude/skills/test-sign-ins/SKILL.md`, new
`scripts/db-test-copy.ts` (+ `package.json` script), new `scripts/reset-test-sign-ins.ts` or a flag on the seed
script, `.claude/settings.json` allows.
## Steps
1. connect-test-copy: AskUserQuestion-free text paste of the two values Tong Sheng sent; validate the key against the
   dev URL (auth admin list users, 1 row); write `.env.local` with `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_DEV_DB_URL`
   (pooler connection string built from the password). Confirm in one line. Never echo values.
2. `pnpm db:test-copy`: refuse unless the DB URL contains the dev ref; then `supabase db push --db-url <dev>`.
   Allow only this script in settings; keep the raw `db push` denies.
3. test-sign-ins: reset passwords of `TEST_USERS` on dev to fresh random ones and show them to her in a table (not
   saved). Refuse on non-dev URL.
4. Preview skill: when `.env.local` has the key, drop the "can't be tried" line; when a change has new migrations, run
   `pnpm db:test-copy` before preview.
## Acceptance
- With a real dev key in a temp `.env.local`: `pnpm db:test-copy` reports "up to date"; with the URL pointed at the
  prod ref it exits non-zero before connecting.
- Reset script tested by unit test on its URL guard; manual run on dev prints 7 role sign-ins.
- `git check-ignore .env.local` confirms ignored. `pnpm check && pnpm typecheck && pnpm test` pass.
## Out of scope
Sending her the values (owner action).
