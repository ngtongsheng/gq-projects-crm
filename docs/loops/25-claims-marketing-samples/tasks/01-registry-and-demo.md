---
tier: standard
why: touches the page registry and access defaults every role depends on, but the change is well specified
depends: []
---
# 01 exceljs allow rule, adopt new demo, page registry
## Goal
The new demo is the spec in the repo, `exceljs` can be installed, and the sidebar knows the two new pages and the
renamed claims page for every role, hidden until their tasks build them.
## Context
Read `00-shared-context.md`. Decisions D8, D13. Spec `demo-changes.md` §A and §5.
## Files to touch
`.claude/settings.json`; `docs/mockup/gqp-office-demo.html`; `src/lib/auth/pages.ts` (+ test); nav icon map
(find where sidebar icons are chosen); People access matrix labels if separate; i18n.
## Steps
1. Add `"Bash(pnpm add exceljs*)"` to `permissions.allow` in `.claude/settings.json`. Run `pnpm add exceljs`
   (check its README/types in node_modules for the version installed).
2. `git mv -f docs/loops/25-claims-marketing-samples/assets/gqp-office-demo.html docs/mockup/gqp-office-demo.html`.
3. Add page keys `tuft` (sidebar "Custom samples", matrix "Custom samples (loan)") and `mkt` ("Marketing expense")
   to `PageKey`, with default roles and sidebar positions from §A, `built: false` until tasks 07 and 10 flip them.
4. Rename the claims matrix row to "Travel claims (monthly)" and the labels: md/accounts "Travel claims";
   bd/sales/director "My travel claim" (D8); site keeps "My claims".
5. Give `tuft` and `mkt` lucide icons (D8). If role defaults live in the database (`role_page_access`), add a
   migration; otherwise code only.
## Acceptance
- `pages.ts` tests cover: designer sees Dashboard, Custom samples, Tasks, Leave (once built); `mkt` default roles
  md, accounts, ssup, support, marketing; `tuft` all but site.
- `pnpm check && pnpm typecheck && pnpm test` pass.
## Out of scope
Building the pages.
