# Shared context for every task in loop 27
- Read `CLAUDE.md` (engineering bar) and `docs/design-system.md` for UI tasks. Work on branch `loop/27-audit-debt`
  in its worktree. Never push `main`.
- Checks: `pnpm check`, `pnpm typecheck`, `pnpm test`, `pnpm build`. All must pass before a task is done.
- Policy (D2): every change keeps behaviour identical: the same rows, totals, messages, wording and screens.
  If a fix would change any of that, stop, leave the code as it is and add a line to the task's debt section.
- Sources: `docs/audits/2026-11-27-code-audit-round-3.md` (finding rows with `file:line`) and the loop 26 sections at
  the end of `docs/debt.md`. Line numbers are from `730b739`, so search by name if they have moved.
- Paging helper: `src/lib/supabase/read-all-rows.ts` (`readAllRows(read)`; `read(from, to, stable)`, ordering by
  `id` when `stable`). Usage examples: `src/app/(app)/marketing/marketing-data.ts` `loadMarketingExpenses`.
- Logger: `logServerError(message, error, context)` in `src/lib/log-server-error.ts`. Context takes user and record
  ids; see existing callers in `src/app/(app)/claims/` for the shape.
- Vicky's team will keep editing this code with agents: clear domain names and small files.
- Commits: small, conventional, imperative, 72 chars max, one per logical change.
