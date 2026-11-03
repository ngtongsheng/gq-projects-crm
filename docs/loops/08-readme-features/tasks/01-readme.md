---
model: sonnet
effort: medium
why: needs reading the repo to describe it accurately; no code
depends: []
---
# 01 Rewrite README
## Goal
`README.md` is the entry point for developers and agents (D1).
## Context
- Current README is two lines. Sources: `CLAUDE.md`, `package.json` scripts, `docs/environments.md`,
  `docs/decisions.md`, `docs/design-system.md`, `docs/glossary.md`, `docs/onboarding.md`, `src/` layout,
  `supabase/migrations`.
- Leave a placeholder line `<!-- demo gif: task 03 -->` directly under the title.
## Files to touch
- README.md
## Steps
1. Sections: what it is (one paragraph), stack, run locally (env files named, never values; `pnpm dev`),
   scripts table from `package.json`, folder map (top level of `src/`, `supabase/`, `docs/`, `scripts/`),
   roles in one line, working on a change (link CLAUDE.md), docs index (link each `docs/*.md` incl. `docs/features.md`).
2. Keep it under ~120 lines. No marketing words, no emoji.
## Acceptance
- Every linked file path exists (`docs/features.md` is created by task 02; fine if 02 is not done yet).
- `pnpm check` passes.
## Out of scope
Changes to other docs or code.
