# Loop 22: Handoff to Vicky
Orchestrator: frontier
## Goal
Vicky opens Claude and everything works as before parity, with nothing to do herself: her laptop catches up on its
own (packages, dev database keys, migrations, 17 test people, example data), her old drafts are set aside safely, and
her Claude knows how to handle every common laptop situation. Google sign-in is live on the live app with Vicky as
first admin. README and docs show current screenshots. Accounts stay the owner's (Vercel, GitHub, Supabase).
## Decisions
| ID | Decision | Why | Rejected |
|---|---|---|---|
| D1 | Launch = first real use of the live app (empty today). Publish the GCP consent screen (Branding: home page = live URL, privacy policy = new `/privacy` page, authorised domain), then `gh workflow run auth-config.yml` | Basic scopes need no Google review; no 100-test-user cap | Stay in Testing; Internal (needs Workspace org) |
| D2 | Vicky is first admin via `scripts/seed-admin.ts` on prod (owner action, prod key). She adds the other staff in People, guided by her Claude. Owner gets no live sign-in | Invite-only stays (loop 11 D2); job role decides pages | Auto-join by domain; bulk load; owner gmail allow-list |
| D3 | New private repo `ngtongsheng/gq-dev-private`, generic for dev-only material (credentials, later test data). Layout `crm/.env.dev` (keys `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DEV_DB_URL`). `vicky-gq` added as collaborator (read). Never prod values | CRM repo is public and must stay so (Vercel Hobby blocks deploys of non-owner commits on private repos, `docs/debt.md`) | Commit in CRM (public); make CRM private (Vercel Pro + GitHub Pro); WhatsApp paste |
| D4 | `pnpm catch-up` (`scripts/agent/catch-up.mjs`, Node stdlib, Mac + Windows): accept pending repo invites from `ngtongsheng`, fetch `crm/.env.dev` with `gh api` and merge its keys into `.env.local` (mode 600, other keys kept), `pnpm install` when `pnpm-lock.yaml` hash changed, `pnpm db:test-copy` when migrations hash changed, `pnpm seed:example` when seed files hash changed or test people missing, `pnpm free-port`, archive pre-parity work (D6). State in a stamp file inside the git dir. Prints one plain line; silent no-op under ~2 s | One idempotent entry point is easy to trigger and test | Separate skills per step; doing it inside the 20 s hook |
| D5 | Trigger: new CLAUDE.md "Start of session" runs `pnpm catch-up` first; new `session-sync.mjs` prints "Run `pnpm catch-up`" when its stamp says it is due. Bootstrap for her old hook: a `for:vicky-claude` issue (opened in task 10) telling her Claude to pull `main` in the main folder, re-read CLAUDE.md and run `pnpm catch-up` | Her current hook is the old script; only the issue channel reaches it | Asking her to say "get the latest" twice |
| D6 | Pre-parity work: PR #31 closed with a note; on her laptop each local branch/worktree not merged into `main` and that does not contain the parity cut-off commit `3328d4e` (loop 11 plan) becomes tag `archive/pre-parity/<branch>` and is removed (worktree too). Never rebased. Remote stale branches (`feat/database-for-preview*`, `chore/seed-fixed-password`, `loop/06-setup-rehearsal`) get the same tag on origin and are deleted | Parity rewrote the app; rebasing would conflict | Rebuild each on new main; leave for owner |
| D7 | "What's new": `docs/whats-new.md` with a version line; catch-up prints it once per version (stamp), Claude relays 3-5 plain lines, then silent | She learns what changed without asking | Silent |
| D8 | Laptop fixes: hide the Google button when `NODE_ENV==="development"` (point to the Sign in as panel); empty panel shows "Ask Claude to set up your laptop" (runs catch-up); `ADMIN_UNAVAILABLE_MESSAGE` no longer mentions preview links; `docs/environments.md` "7 sign-ins" becomes 17 | Agent findings 2026-11-16 | - |
| D9 | Laptop playbook `docs/laptop.md` (agent-facing, linked from CLAUDE.md) covering scenarios listed in task 06 | Anticipate blockers before she meets them | - |
| D10 | README and `docs/features.md` refreshed with screenshots from the laptop app on the dev database, Chrome profile "Agent", 1280 px, saved under `docs/screenshots/` | Owner request | - |
| D11 | Vercel Hobby is non-commercial only; logged in `docs/debt.md` with the fix (Vercel Pro at real handover) | Company use breaks Hobby terms | - |
| D12 | Terms: "dev database" = Supabase `gq-crm-dev` (Vicky's word: "the test copy"); "live app" = prod. Vicky-facing text keeps the glossary | Owner found "test copy" confusing | - |
| D13 | Preflight: task 01 adds allow rules `Bash(pnpm catch-up)` (repo settings, her agent) and `Bash(gh workflow run auth-config.yml)` (executor). Executor publishes the GCP consent screen in Chrome (memory: browser setup allowed before launch). Executor opens the bootstrap issue and closes PR #31 only after #09 passes. Key upload and prod seed-admin are owner actions | Plan-loop 1b | Owner runs all |
| D14 | One branch `loop/22-handoff` from `main`, one commit per task, merged and pushed by the executor (main push denied in this repo: if refused, park and log `blocked: owner` as loop 21) | Established path | - |
## Tasks
| # | Task | Status | Depends | Tier |
|---|---|---|---|---|
| 01 | Allow rules | done | - | economy |
| 02 | Private dev repo, key upload script, key fetch | done | 01 | standard |
| 03 | `pnpm catch-up` | done | 02 | frontier |
| 04 | Archive pre-parity work | todo | 03 | standard |
| 05 | Hook, CLAUDE.md, skills and laptop UI fixes | todo | 03 | standard |
| 06 | Laptop playbook | todo | 05 | standard |
| 07 | Google sign-in go-live | blocked: owner — sign Agent Chrome into the gqp-office Google account, then GCP Branding + Publish app | 01 | standard |
| 08 | Screenshots, README and docs | todo | 05 | standard |
| 09 | Rehearsal on a fresh clone | todo | 04,05,06 | frontier |
| 10 | Hand-off: what's new, bootstrap issue, close #31, docs, merge | todo | 07,08,09 | standard |
<!-- status: todo | in-progress | done | blocked: <reason> -->
## Owner actions
- After #02: run `node scripts/agent/upload-dev-keys.mjs` in the main checkout (reads your `.env.local`, pushes
  `crm/.env.dev` to `gq-dev-private`). #03 onward needs it; the executor parks #03 until `gh api
  repos/ngtongsheng/gq-dev-private/contents/crm/.env.dev` returns 200.
- Before #07, #08, #09: Chrome profile "Agent" open with Claude in Chrome connected and signed in to Google Cloud
  (project `gqp-office`).
- After #07: make Vicky the first admin on the live app (prod secret key in a throwaway `.env.seed`, see
  `docs/environments.md` "Seeding the first admins"):
  `node --env-file=.env.seed scripts/seed-admin.ts --email <vicky>@gqprojects.com.my --name "Vicky ..."`, then delete
  `.env.seed`.
- After #10: send Vicky one line: "Open Claude, Code tab, folder GQ/gq-projects-crm. It will update itself."
## Log
<!-- one line per event: YYYY-MM-DD · #NN · result · next -->
2026-11-16 · plan · loop written; Integration renumbered to loop 23 · next: #01
2026-11-16 · #01 · started (haiku/low) · planner tab closed (YES)
2026-11-16 · #01 · done; global auth-config.yml rule added per D13 · next: #02
2026-11-16 · #02 · started (sonnet/high)
2026-11-16 · #02 · done except invite: repo private, scripts + 10 tests pass · next: #03
2026-11-16 · #02 · decision · read-only invite impossible (GitHub 422: personal repos only grant write); no write invite sent, parked as owner action · grants more than D3 approved
2026-11-16 · #02 · decision · sb_secret_ keys carry no ref; assertDevKeys checks the dev ref on SUPABASE_DEV_DB_URL and refuses any prod ref · format limit
2026-11-16 · #03 · parked: crm/.env.dev not uploaded (404) · next: #07
2026-11-16 · #07 · started (sonnet/high)
2026-11-16 · #07 · partial: /privacy page + public path, auth-config.yml run 43862716536 ok (dev+prod); checks pass · committed
2026-11-16 · #07 · blocked: owner · Agent Chrome signed in as a day-job Google account (passkey challenge); agent stopped. GCP Branding (home, /privacy, domain) + Publish app remain; do after merge so /privacy is live. environments.md status waits on the result
2026-11-16 · #03 · unparked (keys uploaded, 200); started (opus/medium)
2026-11-16 · #02 · decision · owner sent vicky-gq a write invite (pending); catch-up accepts it · read-only impossible on personal repos
2026-11-16 · #03 · done: 13 tests, worktree run 14 s exit 0, second run 0.11 s silent · next: #04
2026-11-16 · #03 · decision · seed reruns on seed-file change or first run only, no per-run "test people missing" DB query · keeps the no-op under 2 s
2026-11-16 · #03 · decision · invites checked only when keys must be fetched; free-port only after an install · no network on the no-op path
2026-11-16 · #03 · decision · log in <git-common-dir>/gq-catch-up.log (mode 600) keeps seed output incl. test-copy sign-in passwords, no keys · dev-only values
2026-11-16 · #03 · note · docs/whats-new.md still has the old November text; #10 rewrites it. Wire as `pnpm -s catch-up` in #05
