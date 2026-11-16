# Parity procedure (tasks 02-07)

1. Setup per `docs/office-parity/parity.md`: demo on `http://localhost:3112/gqp-office-demo.html` ("Reset example data"
   first), app `pnpm dev` (port 3000) in the worktree, Chrome profile "Agent". Chrome unreachable → blocked: owner.
2. Roles per screen come from the page registry `src/lib/auth/pages.ts` (who may open it) and the demo's "Signed in as"
   list. Pick one persona per job role that sees the screen; for a role with a variant (site who sells, supervisor),
   add the variant.
3. Run the drift doc's "check first" items by using the screen as the listed role (loop D8). Server errors: read the
   `pnpm dev` output, fix the cause (≤3 files), add a regression test where the cause is logic, not markup.
4. Per screen × persona × width (1280, 390): structure snippet in both tabs, diff, then screenshots side by side.
   Fill the `parity.md` checklist.
5. Each difference is one of:
   - fix now (UI-only, ≤3 files): fix it, re-run the snippet;
   - deliberate (the demo cannot work for real, or the loop decided otherwise): one line under `## Loop 21` in
     `docs/decisions.md`, grouped by screen;
   - large (migration, new rule, business answer, >3 files): one row in `docs/office-parity/drift-after-sweep.md`
     (create it with columns: Screen | Role | Width | Differs | Size S/M/L | Why not fixed).
6. Report: append the filled checklists to `docs/loops/21-parity-sweep/reports/NN-<slug>.md` (one table per screen,
   rows = persona × width, ✓/✗ per checklist line). Keep screenshots out of git.
7. `pnpm check`, `pnpm typecheck`, `pnpm test` pass. One commit: `fix: parity <area>` or `docs: parity <area>` if
   nothing changed in code.

Never open or print `.env*` files. Never sign in to the live app.
