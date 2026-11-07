---
model: sonnet
effort: high
why: Version-sensitive React 19.3 / next-themes 0.4.6 interaction; needs a durable fix, not a suppression
depends: []
---
# 01 Fix next-themes script warning
## Goal
`pnpm dev` shows no "Encountered a script tag while rendering React component" console error; light/dark/system
theme still works with no flash on load.
## Context
Vicky sees a red Next dev overlay on every preview: `src/app/layout.tsx:30` `<ThemeProvider attribute="data-theme"
defaultTheme="system" enableSystem>`. Installed: next 16.4.3, react 19.3.0, next-themes 0.4.6. next-themes renders an
inline `<script>` inside a client component; React 19 warns in dev. Production is unaffected.
## Files to touch
`src/app/layout.tsx`, possibly a new `src/components/app/theme-provider.tsx`, `package.json` if a fixed next-themes
release exists.
## Steps
1. Check the next-themes repo/changelog for a release that fixes the React 19 script warning. If one exists, upgrade.
2. Otherwise replace next-themes with the smallest equivalent: an inline theme script in `<head>` rendered by the
   server layout (not inside a client component) that sets `data-theme` from localStorage/system, plus a small client
   provider exposing the same `useTheme` API the app uses (`grep -rn "next-themes" src`).
3. Keep every current call site working without edits where possible.
## Acceptance
- `pnpm dev`, open `/` and a signed-in page: no console error; toggle theme; reload keeps it; no flash.
- `pnpm check && pnpm typecheck && pnpm test` pass.
## Out of scope
Theme design changes.
