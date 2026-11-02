---
model: sonnet
effort: high
why: config-driven nav and one guard helper; clear spec
depends: [01]
---
# 02 Navigation by job role + page guards
## Goal
The sidebar shows only the sections a person's job role allows, and opening a hidden section's URL shows a plain 'not available for your role' page.
## Context
- Read `docs/loops/03-crm-features/assets/conventions.md` first; it applies in full.
- Spec: `docs/loops/03-crm-features/assets/prototype-spec.md`.
- Prototype anchors (grep): `tabsDef`
- Decisions: see `docs/loops/03-crm-features/loop.md` (D1-D12).
## Files to touch
- src/lib/auth/nav-sections.ts (+ test)
- src/lib/auth/require-section.ts
- src/components/app/app-shell.tsx
- src/app/(app)/not-allowed/page.tsx
## Steps
1. `nav-sections.ts`: one list of sections (key, label, href, lucide icon, allowed job roles) from the prototype's tabsDef, with role-specific labels ("My Sales" vs "MOF Register", "My Report" vs "Team Reports"). Pure `sectionsFor(jobRole)`.
2. `requireSection(key)` for server pages: redirects to `/not-allowed` when the role lacks it. Admin-only People stays on `requireRole`.
3. AppShell renders `sectionsFor(profile.job_role)`. Sections whose page does not exist yet are left out of the list until their task adds them (add each entry in the task that builds the page).
## Acceptance
- Test: `sectionsFor` per job role matches the prototype's list.
- `pnpm check && pnpm typecheck && pnpm test` pass; PR checks green; merged per conventions "Done".
## Out of scope
Building the section pages.
