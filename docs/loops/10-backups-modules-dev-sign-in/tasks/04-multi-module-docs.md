---
model: haiku
effort: low
why: Wording changes to given docs
depends: [03]
---
# 04 Docs describe a multi-module app
## Goal
Project docs describe GQ Projects as a company app made of modules, with the CRM as the first one, so future work adds modules correctly.
## Context
Decision D5. A module is a tab in the top navigation with its own sidebar links. Do not rename the repo, package or web address.
## Files to touch
- `CLAUDE.md`
- `docs/glossary.md`
- `docs/decisions.md`
- `docs/features.md`
## Steps
1. Use the `writing-for-agents` skill for `CLAUDE.md`. Change the opening so the app is multi-module with the CRM as one module. Keep the phrase "new module" in "A change, start to finish" meaning a new module or a new page.
2. Add `module` to the glossary: "a module | a tab in the top navigation with its own sidebar links". Change "the app" so it no longer means only the CRM.
3. Add to `docs/decisions.md`: how to add a module (a `ModuleKey`, sections carrying it), and why URLs were not prefixed.
4. Describe the top navigation in `docs/features.md`.
## Acceptance
`pnpm check` passes. `grep -n "module" docs/glossary.md` shows the new row.
## Out of scope
Code changes. Renames.
