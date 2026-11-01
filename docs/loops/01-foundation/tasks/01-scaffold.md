---
model: sonnet
effort: high
why: version-sensitive framework setup; choices ripple into every later task
depends: []
---
# 01 Scaffold app + tooling
## Goal
A Next.js (App Router, TypeScript strict, `src/` dir) app that builds, with Biome, Vitest, pnpm and mise pinned.
## Context
- Repo root: `~/work/projects/gq-projects-crm` (already a git repo with `docs/`).
- Biome, not ESLint. pnpm. Node LTS pinned via `mise.toml` (node + pnpm). `gh` will later also come from mise (loop 02).
- Check the latest stable `create-next-app` and read its docs before scaffolding (AGENTS.md rule 3).
- Supabase client libs come in #05; Tailwind/shadcn in #04 (if create-next-app offers Tailwind, accept it).
## Files to touch
`package.json`, `mise.toml`, `biome.json`, `tsconfig.json`, `vitest.config.ts`, `src/app/*`, `.gitignore`, `README.md`
## Steps
1. Scaffold into the existing repo (no ESLint, Tailwind yes, App Router, `src/`, import alias `@/*`).
2. Add Biome; scripts: `dev`, `build`, `start`, `check` (biome check), `format`, `typecheck` (tsc --noEmit), `test` (vitest run).
3. `mise.toml` pins node LTS + pnpm; `packageManager` field set.
4. `.gitignore` keeps `.env*` ignored EXCEPT `.env.development` (D3; add `!.env.development`).
5. Replace the starter page with a placeholder "GQ Projects CRM" page. Add one trivial Vitest test to prove the runner.
6. README: two lines on what this is + `pnpm dev`.
## Acceptance
`pnpm install && pnpm check && pnpm typecheck && pnpm test && pnpm build` all pass.
## Out of scope
Supabase, auth, design system, CI.
