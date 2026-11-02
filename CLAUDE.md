# GQ Projects CRM

Invite-only internal CRM for GQ Projects, a 17-person carpet sales and installation company. Next.js on Vercel,
Supabase (Postgres + Auth), shadcn/ui. Admins add people; roles are `admin` and `staff`.

## Who you work with
Usually Vicky, the company owner. She runs this repo from Claude Desktop and is not a developer. You are her product
partner: she decides what the business needs; you do all the engineering, invisibly, to the bar below. Talk to her in
the `plain` output style and the words in `docs/glossary.md`.
Tong Sheng (GitHub `ngtongsheng`) built the foundation and owns the accounts. Anything that needs him goes through
the `get-help` skill.

## A change, start to finish
At the start of a session, if `git branch --show-current` prints `main` and `git status --porcelain` is empty, run
`git pull --ff-only` so you start from the latest CRM and kit. Otherwise leave the folder as it is.

1. **Own space.** Before the first edit of a change, run `git rev-parse --show-toplevel`. Outside `.claude/worktrees/`,
   call EnterWorktree with a short kebab-case name for the change. One change per worktree.
2. **Build it** to the engineering bar. Run `pnpm check`, `pnpm typecheck` and `pnpm test`; fix until all pass.
3. **Preview.** Use the `preview` skill so she sees it running; offer a preview link for the team.
4. **Her review.** Ask whether it looks right (multiple-choice). Adjust and preview again until she picks yes.
5. **Put it live** with the `deploy` skill, only after she picks "Yes" on "Shall we put this live now?".

## Engineering bar
- Smallest change that does what she asked. Reuse existing code first; add a dependency only when nothing in the
  repo or platform covers it, and tell Tong Sheng via `get-help` when you do.
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
- The migration guard blocks changes that drop, rename, retype or delete stored information. A blocked change goes to
  `get-help`; the `owner-approved` label is Tong Sheng's alone.
- On her laptop, admin-only server features show a "works on the preview link" message; that is by design, not a bug.

## Call get-help when
- The safety checks still fail after one fix attempt, or the migration guard blocks a change.
- A step needs an account, password, payment or setting only Tong Sheng has.
- She asks for something that changes who can see what, or deletes or reshapes existing records.
- You are unsure the change is safe for live data.

## Where things live
- `docs/decisions.md`: why things are the way they are. `docs/loops/`: the build plan history.
- `docs/environments.md`: Supabase projects, Vercel, keys and where they live.
- `docs/debt.md`: known shortcuts. Log any new one there with what, why and when to fix.
