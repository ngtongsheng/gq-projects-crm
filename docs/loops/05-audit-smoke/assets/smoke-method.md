# Smoke test method (#10, #11)
- Worktree of `loop/05-audit-smoke`; copy `.env.smoke.local` from the main repo root if missing. `pnpm dev` in the
  background (test copy via `.env.development`). Never point at the live app.
- Claude in Chrome: load the tools in one ToolSearch call (tabs_context_mcp, tabs_create_mcp, navigate, computer,
  read_page, find, form_input, get_page_text, read_console_messages, resize_window, tabs_close_mcp). New tab, Chrome profile "Agent".
  Avoid buttons that open browser `confirm()` dialogs unless needed; if one is needed, dismiss it with javascript_tool.
- Sign in per role with `SMOKE_<JOBROLE>_EMAIL/PASSWORD` from `.env.smoke.local`. Never write passwords to any committed file.
- For each module: read its section in `docs/loops/03-crm-features/assets/prototype-spec.md`, then the prototype part
  (`grep -n "<anchor>" docs/mockup/gq-crm-mockup.html`, `sed -n` around it; never read the whole file).
  Check per role that can use it: nav entry shows/hides correctly, list loads with example data, create, edit, the
  module's key flow (stage change, approval, calculation), permission denial for a role that must not edit, empty and
  error states, console free of errors.
- Site-supervisor screens (site work, OT, installation calendar, bookings) also at 390px width (resize_window).
- Each gap vs. the prototype or broken flow → a `findings.md` row, then fix it (audit-checklist "Fixing" applies),
  re-run `pnpm check && pnpm typecheck && pnpm test`, re-check in the browser.
- Known decisions are not gaps: loop 03 D1-D12 and the `decision` lines in `docs/loops/03-crm-features/loop.md` Log
  (e.g. skipped panels, no charts). Note them as "by decision" only if the prototype clearly differs.
- Write per-module results to `docs/loops/05-audit-smoke/smoke-results.md`: module, roles tried, pass/fail, findings #.
