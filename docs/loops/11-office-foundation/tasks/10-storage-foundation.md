---
model: sonnet
effort: high
why: New platform piece with access rules; later loops (Leave, Tasks, Claims, HR) depend on it
depends: [03]
---
# 10 Storage foundation
## Goal
One tested way to upload and show private files, which later loops reuse by adding a bucket and its policies.
## Context
- D3. Later uses: leave MC slips (image or PDF, max 1.5 MB, images downscaled to 1100 px), claim receipts, task files,
  HR policy PDFs. Demo downscale: 1100 px long edge. Buckets must be created by migration (D12), not the dashboard.
- Check the installed `@supabase/supabase-js` storage API (signed upload URLs, signed read URLs) in `node_modules`.
## Files to touch
- `supabase/migrations/<ts>_storage_attachments.sql` (new): a private `attachments` bucket, path convention
  `<area>/<record-id>/<file>`, policies: insert by signed-in active people into their own uploads; read via signed URLs
  created server-side after the app checks record access
- `src/lib/storage/upload.ts`, `src/lib/storage/downscale.ts`, `src/lib/storage/signed-url.ts` (+ tests)
- `src/components/app/file-upload.tsx` (new), shown on `/dev/components`
- `docs/design-system.md` (one line), `docs/handover-migration.md` (bucket row)
## Steps
1. Migration and server helpers: validate type and size at the boundary (zod), create signed upload URL, return path;
   signed read URL with short expiry.
2. Client: downscale images before upload; PDFs pass through with the size cap.
3. Component in the design system and on `/dev/components`.
## Acceptance
- `pnpm check`, `pnpm typecheck`, `pnpm test`, `pnpm guard:migrations` pass.
- Tests: size and type validation, downscale dimensions, path building.
## Out of scope
Module-specific buckets and policies (their loops).
