---
model: sonnet
effort: high
why: Visible layout work across header, sidebar and mobile; needs careful parity checking
depends: [02, 06]
---
# 07 Shell parity
## Goal
Header and sidebar match the demo for every role at 1280 px and 390 px.
## Context
- Demo shell: header markup ~422-431, CSS for `#side`, `.nav-i`, `.nav-sep`, scrim and mobile in the `<style>` block
  (~160-240), render ~5100-5145 (icons in `IC`, Guide after a `.nav-sep`, then perf, people, tasks, tools, leave),
  badge slots (`.cnt`, `.cnt.bad`). Drift: `docs/office-parity/drift-shell-sales.md` → "Shell".
- Header: logo (`public/gqp-office-logo.png`), and where the demo has "Signed in as", show the signed-in person's name
  and title with the existing user menu (sign out, theme). No module tab row.
- The app's "modules" concept (top-nav tabs, loop 10) has no place in the demo: remove it and its obsolete code, and
  update the wording in `CLAUDE.md` ("It is made of modules (tabs in the top navigation...)") and `docs/glossary.md`
  ("a module": an area in the sidebar menu). Use the `writing-for-agents` skill for `CLAUDE.md`.
- Badges: a slot per nav item fed by a count; only the existing ownership-requests count is wired now.
- Theme tokens only (`docs/design-system.md`); add tokens to `src/app/globals.css` if the demo needs one.
## Files to touch
- `src/components/app/app-shell.tsx`, `src/app/(app)/layout.tsx`, `src/lib/auth/pages.ts` (icons)
- `src/components/app/nav-icons.tsx` (new, the demo's SVG paths)
- `CLAUDE.md`, `docs/glossary.md`
## Steps
1. Rebuild the sidebar from the page registry: order, labels per role, divider, Guide, icons, active marker, badges.
2. Header per the demo. Mobile: scrim, drawer, collapsed state persisted (try/catch around localStorage).
3. Parity check per `docs/office-parity/parity.md` for md, director, sales, site, support, designer at both widths.
## Acceptance
- `pnpm check`, `pnpm typecheck`, `pnpm test` pass.
- Parity: sidebar outline identical to the demo for the six roles (built pages only); screenshots reviewed.
## Out of scope
Page contents, dashboards, View as banner (08), language toggle (12).
