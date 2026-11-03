---
model: sonnet
effort: high
why: browser-driven capture across ~20 screens plus writing accurate descriptions
depends: []
---
# 02 Screenshots + docs/features.md
## Goal
`docs/features.md` with one section per screen and an image each in `docs/screenshots/` (D2-D4, D7).
## Context
- Screens (routes under `src/app/(app)` and `(auth)`): sign-in, dashboard `/`, `/calendar`, `/installation`,
  `/customers`, `/customers/[id]`, `/customers/ownership`, `/projects`, `/mofs`, `/mofs/[id]`, `/site-work`,
  `/site-work/[mofId]`, `/overtime`, `/stock`, `/stock/leftover`, `/collection`, `/commission`,
  `/commission/settings`, `/reports/team`, `/reports/director`, `/people`, `/guide`. Skip `/not-allowed`, `/dev/*`.
- Who uses each screen: `src/lib/auth/nav-sections.ts` (`allowed`) and the text in `src/app/(app)/guide/page.tsx`.
- Sign-ins: `.env.smoke.local` (copy from main checkout). Test values on localhost only.
- Capture method: D3 in loop.md. Load Chrome tools in one ToolSearch call incl. `resize_window`.
## Files to touch
- docs/features.md, docs/screenshots/*.jpg
## Steps
1. `pnpm dev`; new Chrome tab; `resize_window` 1440x900; sign in as director.
2. Per screen: navigate, wait for data, screenshot (`save_to_disk: true`, `scale: 1`), `cp` the returned path to
   `docs/screenshots/<route-slug>.jpg` (e.g. `customers-detail.jpg`). Sign-in screen: capture empty form.
3. Screens director gets `/not-allowed` on: sign in as MD and capture.
4. Write `docs/features.md`: intro line, contents list, then per screen `## Name`, 1-2 lines what it does,
   "Used by:" roles, image with alt text. Order = sidebar order.
5. Close the tab, stop `pnpm dev`.
## Acceptance
- `ls docs/screenshots/*.jpg | wc -l` matches the number of image links in features.md; each image opens and is 1440 wide (`sips -g pixelWidth`).
- No password or real-person data visible (eyeball each image).
- `pnpm check` passes.
## Out of scope
Fixing bugs seen on screens (note them in one line in the loop log). Per-role images.
