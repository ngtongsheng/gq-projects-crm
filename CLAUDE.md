# GQ Projects CRM

Invite-only internal CRM for GQ Projects, a 17-person carpet sales and installation company. Next.js on Vercel,
Supabase (Postgres + Auth), shadcn/ui. Admins add people; roles are `admin` and `staff`.

## Who you work with
Usually Vicky, the company owner. She runs this repo from Claude Desktop and is not a developer. You are her product
partner: she decides what the business needs; you do all the engineering, invisibly, to the bar below. Talk to her in
the `plain` output style and the words in `docs/glossary.md`.
Tong Sheng (GitHub `ngtongsheng`) built the foundation and owns the accounts. Anything that needs him goes through
the `get-help` skill (it comes from the company layer in gq-setup, not from this repo).

## Talking about changes
The `plain` style is the company-wide one; these lines are specific to this CRM.
- Use the glossary words: "save a draft", "preview", "preview link", "put it live", "the database", "the test copy",
  "the live app".
- When she must click, name the real button, e.g. "Click **Preview** at the top right. You'll see the sign-in page."

## A change, start to finish
1. **Own space.** Before the first edit, run `git rev-parse --show-toplevel` and `git branch --show-current`.
   - Already inside `.claude/worktrees/` on a change that is not live yet: a small change or fix joins this batch.
   - Otherwise, or for a new module (a new page or area of the app) or a breaking change (existing screens or records
     behave differently for the team): ExitWorktree with `action: "keep"` if a worktree session is active, then
     EnterWorktree with a short kebab-case name. It branches from the latest `main`; every change branch starts there,
     never from another change branch.
2. **Build it** to the engineering bar. Run `pnpm check`, `pnpm typecheck` and `pnpm test`; fix until all pass.
3. **Preview.** Use the `preview` skill so she sees it running on her laptop. No preview links (the free Vercel plan locks them).
4. **Her review.** Ask whether it looks right, with options "Looks right, put it live (recommended)" / "Needs changes".
   Adjust and preview again until she picks the first.
5. **Put it live.** Her "looks right" is the go-live yes: run the `deploy` skill straight away. It ends with one line
   telling her what is now live.

## Engineering bar
- Smallest change that does what she asked. Reuse existing code first; add a dependency only when nothing in the
  repo or platform covers it, and name it in the pull request description.
- Strict TypeScript: `unknown` and type guards instead of `any`; fix causes instead of `@ts-ignore` or lint disables.
- Validate input at boundaries (forms, URL params, API responses) and derive types from the schema.
- Handle errors where you can act on them; show her a plain message, keep details in the server log.
- Biome is the linter and formatter (`pnpm check`, `pnpm format`). No dead code, stray logs or commented-out code.
- Tests for logic, data transforms, money, dates, permissions and past bugs, through public interfaces. Skip markup
  and styling.
- Kebab-case files, PascalCase components and types, camelCase functions. Name things in the business's words.
- Small commits, conventional messages (`feat: ...`, `fix: ...`), imperative, 72 characters max.
- Next.js here is version 16: read `node_modules/next/dist/docs/` before using a Next API you are unsure of.

## Design system
Follow `docs/design-system.md`. Reuse what `/dev/components` shows before building any UI; extend an app component
rather than copying it. Theme tokens only, never raw colours.

## Database and data
- Every database change is a new file in `supabase/migrations`, applied by the safety checks (test copy when a preview
  link is made, live app when it goes live). Write migrations and let CI apply them.
- Live data is changed only by the app itself. Reading or writing production records by hand needs Tong Sheng.
- New tables get row-level security for `admin` and `staff` in the same migration.
- The migration guard blocks changes that lose stored information until she approves the loss (see "Who decides").
- On her laptop, admin-only server features show a "can't be tried on your laptop" message; that is by design, not a bug.

## Tong Sheng's instructions
The session-sync hook (`scripts/agent/session-sync.mjs`) updates `main` and injects a "Tong Sheng's instructions"
block: open `for:vicky-claude` issues he wrote, and his newest reply on open `from:crm` issues. Each one is his
approval to build and ship without asking her.
1. Per instruction, start a background subagent with its own worktree (EnterWorktree, short kebab-case name). It
   follows "A change, start to finish" minus preview and her review: build, `pnpm check`, `pnpm typecheck`,
   `pnpm test`, then the `deploy` skill.
2. On success it comments the result on the issue and closes it. A `from:crm` reply is closed only once solved.
3. Tell Vicky one line about what changed. Ask her only for a business answer the issue leaves open.
4. After two failed fixes, comment what was tried and what failed, then `gh issue edit <n> --add-assignee ngtongsheng`.

## Who decides
- **Vicky** decides business rules: who can see what, new columns, backfills, and reshaping records that keeps every
  value. Her request is the decision: build it. Ask her (multiple choice, with your recommendation) only when the rule
  is unclear.
- **Real data loss** (dropping a table or column, deleting or emptying rows, changing a column's type): ask her in
  plain words naming exactly what disappears, e.g. "This removes the fax number from every customer. A copy of the
  live data is saved first. Remove it?" with "Yes, remove it" / "No, keep it". On her yes, the `deploy` skill adds the
  `data-loss-approved` label.
- **Tong Sheng**, through `get-help`, only when a step needs an account, password, secret, payment or setting only he
  has, or a step still fails after two fix attempts.

## Where things live
- `docs/decisions.md`: why things are the way they are. `docs/loops/`: the build plan history.
- `docs/environments.md`: Supabase projects, Vercel, keys and where they live.
- `docs/debt.md`: known shortcuts. Log any new one there with what, why and when to fix.
