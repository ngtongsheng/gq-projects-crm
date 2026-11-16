---
tier: standard
why: agent-facing doc that must anticipate real situations; each entry checked against the code
depends: [05]
---
# 06 Laptop playbook
## Goal
`docs/laptop.md` tells Vicky's Claude exactly what to do in every common laptop situation, so she never meets a
blocker it could have handled.
## Context
- Loop D9. Agent-facing, lean, one entry per scenario: **when** (what she says or sees) → **do** (commands/skills) →
  **tell her** (one plain line, glossary words). Use the `writing-for-agents` skill.
- Dev is never a reason to stop her work (owner, 2026-11-16): the dev database holds only fake data; reset or re-seed
  it freely. Prod data is never touched by her agent.
- Verify each command exists (`package.json`, `.claude/skills/`). Where a scenario has no tool and needs one, add it
  only if it is ≤ 1 small script; otherwise list it in `docs/debt.md`.
## Scenarios (minimum)
1. Start the app / "show me" → preview skill.
2. See the app as a role or person ("as Eddie", "as installer") → Sign in as panel; who is who: `scripts/example-data/
   people.ts`; on the live app: People, View as.
3. Example data looks wrong or was changed by trying things → `pnpm seed:example` (resets example rows only).
4. A new page or column needs example data so she can see it → extend `scripts/example-data/` in the same change;
   catch-up re-seeds when the seed files change.
5. A change needs a database change → new migration file, `pnpm db:test-copy`, guard rules from CLAUDE.md.
6. Another branch's migration left the dev database ahead of `main` (shared dev DB) → what that looks like, and the
   fix (it is fine; or re-apply; never `db reset` on dev without seeding after).
7. Sign-in panel empty / "needs setting up" → `pnpm catch-up`.
8. Port busy, page blank, stale server → `pnpm free-port`, restart preview.
9. Packages error after a pull → `pnpm catch-up` (install).
10. Keys rejected (owner rotated them) → catch-up refetch; still failing → `connect-test-copy` fallback, then
    `get-help`.
11. Dev database paused or unreachable → health workflow context; `get-help`.
12. Language switch (English, BM, Chinese) to check translations.
13. Phone width check (390 px) for field staff screens.
14. Admin-only features (People, settings) on the laptop.
15. Adding real staff on the live app after launch: People → Add person, job role, manager; they sign in with Google.
16. She asks for something that was in an archived draft → `git show archive/pre-parity/<branch>`, rebuild on main.
## Files to touch
- `docs/laptop.md` (new)
- `docs/debt.md` (only if a scenario lacks a tool)
## Acceptance
- Every command named exists (grep `package.json` / skills). `pnpm check` passes.
## Out of scope
New features beyond a ≤ 1-file helper.
