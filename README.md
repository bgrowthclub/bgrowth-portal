# BGrowth Portal

The customer-facing Free Trial and account portal for BGrowth. Members create
an account, activate one free Workspace trial, and manage their licenses and
purchased Workspaces from here.

This is a separate, independent codebase — no shared code with
`bgrowthclub/app.bgrowth` (the marketing/Workspace runtime app) or the BGrowth
Wix Studio storefront. It talks to its own Supabase project for auth and data.

## Tech stack

- React 18 + TypeScript + Vite
- Tailwind CSS (Electric Blue `#1061EC` / Dark Navy design language, dark &
  light mode via the `class` strategy)
- React Router v6
- Supabase (Authentication + Postgres database)

## Getting started

```bash
npm install
cp .env.example .env   # then fill in VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
npm run dev
```

Apply the schema in `supabase/migrations/0001_init.sql` to your Supabase
project (via the SQL editor or the Supabase CLI) before running the app.
`supabase/seed.sql` has optional example catalog data for local development.

## Architecture

Feature-based, organized so each domain owns its own components/hooks/services:

```
src/
  app/            router (routes.tsx), NotFoundPage
  components/
    ui/           generic, domain-agnostic primitives (Button, Card, Badge, ...)
    layout/       chrome shared across layouts (Navbar, AppHeader, Footer, route guards)
  layouts/        PublicLayout, AppLayout, AuthLayout — one per route group
  features/
    auth/         Sign In / Sign Up / Forgot & Reset Password / Verify Email
    home/         Landing page sections
    trial/        Trial Selection (the one-time free trial activation flow)
    library/      My Library (owned/locked/trial/purchased/expired Workspaces)
    workspace-viewer/  WorkspaceRenderer — generic renderer for any published
                       Workspace JSON (see below), plus the access-gated
                       Viewer page/layout around it
    profile/      Personal info, licenses, trial expiration
  hooks/          cross-feature hooks (useTheme, useAsync)
  services/       cross-feature data access (supabaseClient, productService,
                  licenseService, userService) — the only place Supabase
                  queries are written; features call these, never the client
                  directly
  types/          database.ts (mirrors the Supabase schema), workspace.ts
                  (derived/presentation types), workspaceContent.ts (the
                  Workspace JSON schema — mirrors BGrowth Studio's engine)
  lib/            workspaceAccess.ts (license → unlocked/locked/trial/
                  purchased/expired), workspaceIcons.ts (dynamic lucide-react
                  icon resolution), workspaceTheme.ts (per-Workspace runtime
                  color theming)
supabase/
  migrations/     SQL schema
  seed.sql        real product content (Notary + Cleaning Move-Out, copied
                  from bgrowth-studio's own configs — not mock data)
```

## The Workspace Renderer

Every product's actual content — sections, fields, checklist items — lives in
`products.content`, a JSON blob published by **BGrowth Studio**
(`bgrowthclub/bgrowth-studio`), not written or hardcoded in this repo.
`src/types/workspaceContent.ts` mirrors Studio's `src/engine/types.ts`
field-for-field, and `WorkspaceRenderer` (in `features/workspace-viewer/`)
renders that JSON generically:

- Section type (`form` / `checklist` / `notes` / `outcome`) and field type
  (`text`, `select`, `checkbox`, `image`, ...) are dispatched purely from the
  data — there is exactly one place in the codebase that branches on section
  type (`WorkspaceSectionFields`) and one that branches on field type
  (`WorkspaceFieldRenderer`), and neither knows about any specific product.
- Icons are resolved dynamically from `content.sections[].icon` /
  `fields[].icon` name strings against the full `lucide-react` export set
  (`src/lib/workspaceIcons.ts`) — not a hand-maintained per-icon registry —
  so a new icon name Studio starts using needs no Portal change. This is also
  why the Viewer route is lazy-loaded (`src/app/routes.tsx`): pulling in the
  full icon library is worth it for that genericity, but it stays out of the
  storefront's initial bundle.
- `content.brand.primaryColor` themes the whole render at runtime via CSS
  custom properties (`src/lib/workspaceTheme.ts`, same color-scale algorithm
  Studio itself uses) — a new product with a different brand color needs no
  Portal styling change either.

**Publishing a new Workspace is a data operation, not a code change:** once
the BGrowth Publishing Engine (below) writes a product's JSON into
`products.content` and the row's `status` is `published`, it renders
correctly in the Portal immediately.

## The BGrowth Publishing Engine

The one write path into the catalog — see **[PUBLISHING_ENGINE.md](./PUBLISHING_ENGINE.md)**
for the full architecture, governing principles, and extension points. It's
documented as its own core platform service, not a Portal feature, even
though its code currently lives in this repo (`api/publishing-engine/`).

Required environment variables (server-side only — never prefix these with
`VITE_`, that would ship them to the browser; see `.env.example`):
`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `PUBLISHING_ENGINE_SECRET`.

## Database schema

| Table | Purpose |
|---|---|
| `workspace_categories` | Category taxonomy for Workspaces |
| `products` | Catalog (name, description, cover image, `app_url`, `content`, `content_type`, `content_version`, `metadata`, `status`, `current_version`) |
| `product_versions` | Full snapshot per publish — history/rollback, service-role only |
| `publication_destinations` | Lookup: portal (active), website/etsy/gumroad/academy (not yet) |
| `product_destinations` | Per-destination publish ledger — status/version/external id, service-role only |
| `published_assets` | Generation ledger — Workspace JSON + cover image today, PDF/social/marketplace asset types already valid |
| `catalog_index` | Read-optimized, search-indexed projection of published products — public read, not yet queried by the Portal's own pages |
| `users` | Public profile row, 1:1 with `auth.users`, auto-created by a trigger on signup |
| `licenses` | `type` (trial / purchased / lifetime), `status` (active / expired / revoked), `activated_at`, `expires_at` |

A partial unique index enforces "one trial license per user, ever" at the
database level, not only in the client. Row Level Security is enabled on
every table: members can only read their own `users`/`licenses` rows and can
only insert a `trial`-type license for themselves (purchased/lifetime
licenses are meant to be created by a trusted backend process once a real
checkout exists); `products` is publicly readable only where
`status = 'published'`; `product_versions`/`product_destinations`/
`published_assets` have no public policy at all (service role only);
`catalog_index` is publicly readable since, by construction, it only ever
holds currently-published rows.

## Future integrations (not built yet, intentionally not hardcoded against)

- **Additional content types and destinations** — `content_type` and
  `publication_destinations` already model Template/Document/PDF/Course/
  Calculator/AI Tool/Academy Lesson and Website/Etsy/Gumroad/Academy; only
  `workspace` → `portal` is actually implemented.
- **Commerce / Payments** — `licenses.type = 'purchased' | 'lifetime'` and the
  "Buy" action in My Library are wired for this, pending a real checkout
  integration.
- **Marketplace, Analytics** — no code yet; nothing here assumes their shape.
