# Design system

- Theme tokens live in `src/app/globals.css` (from `docs/mockup/tokens.css`). Use semantic classes (`bg-card`, `text-muted-foreground`, `bg-good-bg text-good`), never raw hex.
- `src/components/ui/`: shadcn components, generated. Don't hand-edit; they are excluded from Biome.
- `src/components/app/`: our shared components (`AppShell`, `PageHeader`, `EmptyState`, `DataTable`, `StatusBadge`).
- Reuse before create: check `/dev/components` (dev and preview only) before building any UI. Extend an app component rather than copying it.
- Add a shadcn component: `pnpm dlx shadcn@latest add <name>`, then `pnpm format`.
- Numbers (money, quantities, dates) use `font-mono tabular-nums`; headings use `font-heading`.
