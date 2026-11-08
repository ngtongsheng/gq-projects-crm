---
model: sonnet
effort: high
why: Changes the shell every page uses, across desktop and mobile and every job role
depends: []
---
# 03 Top navigation and per-module sidebars
## Goal
The header shows module tabs. The sidebar lists only the links of the module the current page belongs to. CRM is the only module, so every job role keeps exactly the links they have today, and no web address changes.
## Context
Decisions D5 and D6. A layout cannot read the pathname, so `AppShell` receives the modules with their links and picks the active one with `usePathname`, falling back to the first. Ownership requests, Sales Performance and People stay in the CRM sidebar.
## Files to touch
- `src/lib/auth/nav-sections.ts` and `src/lib/auth/nav-sections.test.ts`
- `src/app/(app)/layout.tsx`
- `src/components/app/app-shell.tsx`
- `src/app/dev/components/page.tsx` only if it renders `AppShell`
## Steps
1. Read `docs/design-system.md`, `src/components/app/app-shell.tsx` and `node_modules/next/dist/docs/` for anything unsure.
2. Add a `ModuleKey` type and a `module` on each section. Export the modules a job role can open, each with its sections, keeping `sectionsFor` behaviour and sidebar order.
3. Pass modules to `AppShell`; render the tabs in the header using theme tokens, with a working layout at phone width and the active tab marked for assistive technology.
4. Add tests through the public functions: each job role gets the same links as before, and a role with no section in a module does not get that module.
## Acceptance
`pnpm check`, `pnpm typecheck`, `pnpm test`, `pnpm build` all pass. `pnpm dev`: signed in, header shows a CRM tab and the sidebar matches today's links, at desktop and 375px width.
## Out of scope
Second module, route prefixes, moving pages, sidebar headings, renaming the repo or domain.
