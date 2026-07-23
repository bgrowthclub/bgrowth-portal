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
Studio writes a product's JSON into `products.content` (however that pipeline
is ultimately wired — see below) and the row is marked `is_published`, it
renders correctly in the Portal immediately.

**What isn't built yet:** an actual live sync between Studio (which persists
its own products via a Google Apps Script proxy into Google Sheets, scoped by
owner email — see `bgrowth-studio/src/lib/studioSync.ts`) and this Portal's
`products.content` column. Today, publishing means copying a finished
Studio config's JSON into that column by hand (see `supabase/seed.sql` for
exactly that, done for the two real products that already exist). A real
publish pipeline — Studio calling a Portal/Supabase endpoint, or a shared
export step — is future work and deserves its own design pass rather than a
guessed implementation bolted on here.

## Database schema

| Table | Purpose |
|---|---|
| `workspace_categories` | Category taxonomy for Workspaces |
| `products` | Workspace catalog (name, description, cover image, `app_url` — the target app a purchaser is routed to, `content` — the published Workspace JSON, see below) |
| `users` | Public profile row, 1:1 with `auth.users`, auto-created by a trigger on signup |
| `licenses` | `type` (trial / purchased / lifetime), `status` (active / expired / revoked), `activated_at`, `expires_at` |

A partial unique index enforces "one trial license per user, ever" at the
database level, not only in the client. Row Level Security is enabled on
every table: members can only read their own `users`/`licenses` rows, and can
only insert a `trial`-type license for themselves — purchased/lifetime
licenses are meant to be created by a trusted backend process (e.g. a payment
webhook) once that flow is built, not by direct client insert.

## Future integrations (not built yet, intentionally not hardcoded against)

- **BGrowth Studio publish pipeline** — the renderer and schema exist (see
  above); the actual sync that gets a newly-authored Studio product's JSON
  into `products.content` automatically does not.
- **Commerce / Payments** — `licenses.type = 'purchased' | 'lifetime'` and the
  "Buy" action in My Library are wired for this, pending a real checkout
  integration.
- **Marketplace, Analytics** — no code yet; nothing here assumes their shape.
