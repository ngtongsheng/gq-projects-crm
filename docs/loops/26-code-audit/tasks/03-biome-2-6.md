---
tier: standard
why: new lint rules may fire across many files; fix causes, not disables
depends: [02]
---
# 03 Biome 2.4 to 2.6
## Goal
Biome on latest 2.6.x, `biome.json` schema current, every new diagnostic fixed at its cause.
## Context
Read `00-shared-context.md`. Biome is pinned exact (`2.4.2`); keep it exact.
## Files to touch
`package.json`, `pnpm-lock.yaml`, `biome.json`, plus files the new rules flag.
## Steps
1. `pnpm add -D -E @biomejs/biome@2.6` ; `pnpm exec biome migrate --write`.
2. `pnpm check`. Apply safe fixes; fix others by hand. No `biome-ignore` and no rule disables to pass.
3. If a new rule fires in more than ~30 files and the fix is not mechanical, set it to the preset default and log it
   (rule, count) for task 10's debt list in the loop Log.
## Acceptance
`pnpm check && pnpm typecheck && pnpm test && pnpm build` pass. `biome.json` `$schema` names 2.6.x.
## Out of scope
Formatter style changes beyond what the upgrade forces.
