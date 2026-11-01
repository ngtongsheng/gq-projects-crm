---
model: sonnet
effort: high
why: sets reuse patterns every future vibe-coded screen depends on
depends: [01]
---
# 04 Design system + app shell
## Goal
shadcn/ui on Tailwind with a calm, professional theme, a reusable app shell, and a catalog page agents and Vicky can browse.
## Context
- D6. Read current shadcn/ui docs for the installed Next.js/Tailwind versions before `init`.
- Look: neutral surfaces, one brand accent (warm, carpet-trade appropriate, e.g. deep teal or terracotta), no purple
  gradients, no glassmorphism, no emoji icons. Use lucide icons (shadcn default). Tokens as CSS variables so a future
  brand colour change is one edit.
- Base components to add: button, input, label, form, select, textarea, checkbox, card, table, dialog, dropdown-menu,
  sonner (toasts), badge, skeleton, sidebar (or sheet for mobile nav).
- App components (in `src/components/app/`): `AppShell` (sidebar nav + header + content, responsive), `PageHeader`
  (title, description, actions slot), `EmptyState`, `DataTable` wrapper (typed columns over shadcn table).
## Files to touch
`components.json`, `src/app/globals.css`, `src/components/ui/*` (generated), `src/components/app/*.tsx`, `src/app/dev/components/page.tsx`
## Steps
1. `shadcn init`, add base components, set theme tokens.
2. Build the 4 app components.
3. `/dev/components`: renders every app component and key ui components with example states. Hidden from nav, accessible
   only in non-production (`notFound()` when `VERCEL_ENV === 'production'`).
4. `docs/design-system.md`: 10 lines max: where components live, reuse-before-create rule, how to add a shadcn component.
## Acceptance
`pnpm check && pnpm typecheck && pnpm build` pass; `pnpm dev` and `/dev/components` renders all components (screenshot via preview or Chrome).
## Out of scope
Auth-aware nav (#05), CRM screens.
