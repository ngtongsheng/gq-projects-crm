# Audit checklist (every audit task applies all of it to its files)
Sources: `~/.agents/AGENTS.md`, repo `CLAUDE.md`, `docs/loops/03-crm-features/assets/conventions.md`,
`docs/design-system.md`, `docs/glossary.md`. If a rule here is unclear, the source wins.

## Types and validation
- No `any`, no `as` casts that hide unknowns (narrow `unknown` with guards or zod), no `@ts-ignore`/`@ts-expect-error`,
  no `biome-ignore`, no non-null `!` that the code can't prove.
- Boundaries validated with zod: form input, URL/search params, route handler input, Supabase query results used as
  typed data, env. Types derived from the schema (`z.infer`), not duplicated by hand.
- No defensive checks on trusted internal values.

## Errors
- No silent `catch {}`, no catch-and-rethrow noise. Supabase `{ error }` results always checked.
- The person sees a plain message (toast); details go to the server log, never to the client.

## Security and permissions
- Every server action and route handler checks who is calling (`require-role` / current profile) before writing.
- Permission rules live in RLS (SQL helpers `is_admin`, `has_job_role`, `is_manager`); UI gating matches RLS, never replaces it.
- Every table: RLS enabled, `revoke all from anon, authenticated`, explicit grants, policies in the same migration.
  `security definer` functions set `search_path` and check the caller. MOF cost stays managers-only (loop 03 D12).
- No service-role key in code reachable from the client. No secrets committed.
- CSV export guards formula injection; import re-validates on the server.

## Correctness
- Money, dates, areas only through `src/lib/format/*` and `src/lib/domain/*`. Malaysia time (`Asia/Kuala_Lumpur`),
  RM, Mon-Fri workdays. No `new Date()` maths that ignores the time zone. No float sums for money without rounding.
- Status/stage values match the SQL `check (...)` lists.
- Multi-write saves: partial-failure behaviour is known and either handled or already in `docs/debt.md`.

## Structure and quality
- One responsibility per file; split files over ~300 lines that mix concerns. No pass-through layers.
- No duplicated logic across modules (same helper written twice → extract once, usually a #09 cross-module item).
- Reuse `src/components/app/*` and `src/components/ui/*`; no copied components. Theme tokens only, no raw colours
  (hex, rgb, `bg-red-500`-style palette classes).
- No dead code, unused exports, commented-out code, stray `console.*`, TODOs without a debt entry.
- Comments explain why, not what. No AI tells (robust, seamless, leverage, comprehensive, emoji).
- Names in domain words (glossary, conventions "Code"). Kebab-case files, PascalCase types/components, camelCase
  functions. No `data`/`info`/`utils`/`helpers` dumping grounds.
- Next.js 16 APIs used per `node_modules/next/dist/docs/` (async `params`/`searchParams`, `proxy.ts`, server actions).

## Tests
- Pure logic (derivations, money, dates, permissions, parsers) has vitest tests next to it, through public interfaces.
- No tests of markup/styling or of implementation details. Past bugs fixed in this loop get a regression test.

## Fixing (D3, D4)
- Fix in place, one commit per finding group, conventional message ≤72 chars. Matching existing patterns.
- Fix touches files outside the task's module → record as `cross-module (#09)` in `findings.md` instead.
- Fix needs a drop/rename/retype/delete migration → D4 (own branch + PR, task blocked).
- New dependency needed → not allowed in this loop; record as debt.
