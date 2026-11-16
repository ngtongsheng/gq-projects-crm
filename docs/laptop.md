# Laptop playbook

For Vicky's agent. Find the row that matches what she says or what you see, do it, tell her the one line. Talk in the
`plain` style and the words in `docs/glossary.md`. Keep her out of the terminal.

## Ground rules
- The test copy (dev database, project `gq-crm-dev`) holds only invented data. Reset it, re-seed it or repair it freely;
  it is never a reason to stop her work. Every script here refuses the live app by itself.
- The live app is never touched from here. Reading or changing real records needs Tong Sheng (`get-help`).
- Keys live in `.env.local` (gitignored). Never print, quote or commit them. The seed prints test passwords; do not
  relay them, the Sign in as panel needs none.
- Prefer a fix you can do and report over a question. Two failed fixes on one problem: `get-help`.

## What `pnpm --silent catch-up` does
Runs at session start. Each step runs only when its input changed since last time (stamp
`<git-common-dir>/gq-catch-up.json`). Silent when nothing changed. Output of every command goes to
`<git-common-dir>/gq-catch-up.log` (`git rev-parse --git-common-dir`); read it when a step fails.

| Step | Runs when | If it fails, the line says |
|---|---|---|
| Test copy keys | `.env.local` lacks them: copied from the main folder, else fetched from the private repo `ngtongsheng/gq-dev-private` after accepting his pending invite | "get the test copy keys" |
| `pnpm install` + `pnpm free-port` | `pnpm-lock.yaml` changed or no `node_modules` | "install updates" |
| `pnpm db:test-copy` | the list of migration files changed | "bring the test copy up to date" |
| `pnpm seed:example` | anything in `scripts/example-data/` or `scripts/seed-example-data.ts` changed | "refresh the example records and test sign-ins" |
| Archive old drafts | local branches from before the new app exist | "save your older drafts" |
| What's new | `docs/whats-new.md` has a newer `version:` line | prints it once; relay 3 to 5 plain lines |

Always `pnpm --silent catch-up`: pnpm 12 ignores `-s` and echoes the command, and before the first run it installs
packages itself; `--silent` hides both. Exit 1 means at least one step failed; the others still ran. A non-zero exit
with no line means pnpm failed before catch-up started (usually no network for that first install): run
`pnpm install` to see why. To force every step again, delete
`<git-common-dir>/gq-catch-up.json` and re-run.

## Situations

### 1. "Show me", or the app is not running
- Do: the `preview` skill.
- Tell her: "Click **Preview** at the top right."

### 2. See the app as a role or a person ("as Eddie", "as the installer")
- Do: on the laptop, sign in with the **Sign in as** panel (bottom left of any page, a button showing the current
  job role). It lists active test people as "Name — title" and signs in with one click. Match her words to
  `scripts/example-data/people.ts`: Vicky = MD (admin, the only one), Eddie = Sales Director, Vanessa = Marketing
  Director, Vernice, Vanisha, Cavan, Crystal = Salespeople, Jany = HR & Accounts, Awal, Akmal, Sarah = Site
  Supervisors (Awal and Akmal use BM; Sarah also sells), Jess = Sales support, Wai Mun = Purchasing, Affifa and Liza =
  Designers. Lisa (Purchasing assistant) and Marketing Exec have left, so they are not in the panel; see their old
  work through Vicky.
- "Installer": installers are records on the Installation page, not people who sign in. The nearest person is a Site
  Supervisor (Awal).
- On the live app there is no panel. The MD opens **People** and clicks **View as** on a row (read only; **Back to**
  returns). That is also the way to look at someone's screens without signing out.
- Tell her: "You are now looking at the app as Eddie, the Sales Director."

### 3. Example data looks wrong, or trying things changed it
- Do: `pnpm seed:example`. It rewrites the example rows (and anything under them that was added in the app), resets
  the 17 test sign-ins and prints new passwords.
- Tell her: "I put the example records back the way they were."

### 4. A new page or column needs example data so she can see it
- Do: in the same change, extend the builder for that area in `scripts/example-data/` (`dataset.ts` lists the
  builders; a new table gets a builder there, and `table-references.ts` must list its foreign keys). Run `pnpm test`
  (`dataset.test.ts`, `example-rows.test.ts`, `table-references.test.ts` guard this), then `pnpm seed:example`. After
  it is merged, her catch-up re-seeds on its own because the seed files changed.
- Tell her: "I added example records so you can see the new page filled in."

### 5. A change needs a database change
- Do: a new file in `supabase/migrations` (name `<timestamp>_<what>.sql`, later than the newest), with row-level
  security for `admin` and `staff` on any new table. Then `pnpm db:test-copy` to put it on the test copy and
  `pnpm seed:example` if the example data uses it. `pnpm guard:migrations` shows what the safety checks will say (it compares with `origin/main`).
  Anything that loses stored information: ask her in plain words (CLAUDE.md, "Who decides").
- Tell her: "The database change is on the test copy; the live app gets it when you put the change live."

### 6. Another branch's database change is already on the test copy
The test copy is shared by every branch and PR. Sign: `pnpm db:test-copy` fails with "Remote migration versions not
found in local migrations directory" (or CI `migrate-dev` fails the same way). The extra tables and columns are
harmless to `main`; only the history is out of step.
- Do, in this order, stop at the first that works:
  1. The versions are named in the error. Mark them as not applied. This keeps the data and takes a few seconds:
     `node --env-file=.env.local -e "require('node:child_process').spawnSync('pnpm',['exec','supabase','migration','repair','--status','reverted',...process.argv.slice(1),'--db-url',process.env.SUPABASE_DEV_DB_URL],{stdio:'inherit',shell:process.platform==='win32'})" <version> [<version>...]`
     then `pnpm db:test-copy`.
  2. A later migration now fails with "already exists" (the other branch made the same object): the test copy is fake,
     so wipe and rebuild it: `node --env-file=.env.local -e "require('node:child_process').spawnSync('pnpm',['exec','supabase','db','reset','--db-url',process.env.SUPABASE_DEV_DB_URL,'--no-seed','--yes'],{stdio:'inherit',shell:process.platform==='win32'})"`,
     then `pnpm db:test-copy`, then `pnpm seed:example`. Never reset without the seed after it.
- Tell her: "The test copy had a change from another draft in it. I cleaned it up and put the example records back."

### 7. Sign-in panel empty, or it says the laptop needs setting up
- Do: `pnpm --silent catch-up`. If it prints nothing the keys are there but the people are missing: `pnpm seed:example`. No
  keys at all: see 10.
- Tell her: "Your laptop was missing its test sign-ins. They are set up now."

### 8. Port busy, blank page, old server
- Do: `pnpm free-port`, then the `preview` skill again. Sign-in only works on port 3000, so never move to another
  port. Still blank after a restart: read the dev server's output for the first error and fix that.
- Tell her: "I restarted the preview."

### 9. Errors about packages or missing modules after getting new changes
- Do: `pnpm --silent catch-up` (reinstalls when the lockfile changed). Still failing: delete `node_modules` and run
  `pnpm install`.
- Tell her: "I updated the tools this app needs."

### 10. The test copy rejects the keys, or catch-up could not fetch them
- Do: rejected keys (the owner rotated them) are fetched again by `pnpm --silent catch-up` automatically. "could not get
  the test copy keys": the reason is in `<git-common-dir>/gq-catch-up.log`. Usually no access yet: her GitHub account
  `vicky-gq` has a pending write invite to `ngtongsheng/gq-dev-private`; catch-up accepts it when `gh` is signed in as
  her. Check `gh auth status`; if signed out, `get-help`. Still failing: the `connect-test-copy`
  skill (she pastes two values), and `get-help` if that fails.
- Tell her: "Your laptop could not connect to the test copy. I asked Tong Sheng to help."

### 11. The test copy is paused or unreachable
Supabase Free pauses an idle project; `health.yml` (Mondays and Thursdays) keeps it awake and opens an issue labelled
`from:crm` ("Urgent: CRM health check failed") when it cannot.
- Do: `gh issue list --label from:crm --state open` to see whether a health issue is already open. Pages that need the
  database fail with connection errors and `pnpm db:test-copy` times out. Only Tong Sheng can restore a paused project:
  `get-help`. Meanwhile she can still read and design screens that need no data.
- Tell her: "The test copy is asleep. Tong Sheng has to wake it; I asked him."

### 12. Check the languages (English, BM, Chinese)
- Do: pages with translated text show an **English / BM / 中文** switch at the top: Today, Log work, Tasks, Leave,
  Costing (Costing has no BM, Log work has no 中文). It also follows the person's own setting, so Awal and Akmal open
  in BM; set it per person in People. A page with no switch is English only. In Chinese, dialogs, some server messages and calendar names stay English
  (`docs/debt.md`).
- Tell her: "Here it is in BM." Name any text you saw still in English.

### 13. Check phone width (field staff screens)
- Do: sign in as Awal, Akmal or Sarah (Site Supervisors), resize the browser window to 390 px wide (Chrome tools'
  resize, or the device toolbar), and check Today, Log work and the job pages. Look for sideways scroll, cut-off text
  and buttons too small to tap. Fix, then look again.
- Tell her: "I checked it at phone width and fixed the spots that did not fit."

### 14. Admin-only features (People, settings, adding people)
- Do: they use the server secret key. With the keys in `.env.local` they work on the test copy; without them the app
  says "Adding people works on the live app, or after Claude sets up your laptop." Run `pnpm --silent catch-up`; if keys
  still missing see 10. Only if she declines, tell her it will be tried on the live app right after going live
  (preview skill, step 5).
- Tell her: "That part now works on your laptop."

### 15. Adding real staff on the live app after launch
- Do not do this from the laptop; it is hers to do on the live app, and you guide her. In the live app: **People**,
  **Add person**: name, email (the Google account they sign in with), job role, Admin or staff (staff, unless she says
  otherwise), **Reports to** (a salesperson's team lead, a director or Marketing Director), language. The dialog gives
  an invite link to send them by WhatsApp. They sign in with Google using that exact address. Job role decides
  which pages they see; the page-access table in People changes that per role.
- Tell her: "Add them in People, then send them the invite link."

### 16. She wants something from an older draft
- Do: drafts from before the new app are tags on GitHub named `archive/pre-parity/<branch>`. List:
  `git tag -l "archive/pre-parity/*"`. Look: `git show archive/pre-parity/<branch>` and
  `git diff main...archive/pre-parity/<branch> -- <path>`. Do not merge or rebase it: the app was rewritten. Rebuild
  the wanted part on a new change from `main`, borrowing the idea and any text.
- Tell her: "I found it in your older drafts and rebuilt it in the new app."

## Test people: the count
The seed creates 17 test sign-ins (`TEST_USERS`, asserted in `scripts/example-data/dataset.test.ts`). Two of them,
Lisa and Marketing Exec, are marked as having left, and the panel lists active people only, so a freshly seeded
test copy shows 15 in the panel and 17 sign-ins in `pnpm reset:sign-ins` and `pnpm seed:example`. A panel showing
fewer than 15 means the seed has not run since the people list last changed: run `pnpm seed:example`.
