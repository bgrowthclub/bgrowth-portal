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
    workspace-viewer/  Reusable Workspace Viewer shell (content renderer is a
                       future integration point — see below)
    profile/      Personal info, licenses, trial expiration
  hooks/          cross-feature hooks (useTheme, useAsync)
  services/       cross-feature data access (supabaseClient, productService,
                  licenseService, userService) — the only place Supabase
                  queries are written; features call these, never the client
                  directly
  types/          database.ts (mirrors the Supabase schema) + workspace.ts
                  (derived/presentation types)
  lib/            workspaceAccess.ts — the single place access-state
                  (unlocked/locked/trial/purchased/expired) is derived
supabase/
  migrations/     SQL schema
  seed.sql        optional example data
```

## Database schema

| Table | Purpose |
|---|---|
| `workspace_categories` | Category taxonomy for Workspaces |
| `products` | Workspace catalog (name, description, cover image, `app_url` — the target app a purchaser is routed to) |
| `users` | Public profile row, 1:1 with `auth.users`, auto-created by a trigger on signup |
| `licenses` | `type` (trial / purchased / lifetime), `status` (active / expired / revoked), `activated_at`, `expires_at` |

A partial unique index enforces "one trial license per user, ever" at the
database level, not only in the client. Row Level Security is enabled on
every table: members can only read their own `users`/`licenses` rows, and can
only insert a `trial`-type license for themselves — purchased/lifetime
licenses are meant to be created by a trusted backend process (e.g. a payment
webhook) once that flow is built, not by direct client insert.

## Future integrations (not built yet, intentionally not hardcoded against)

- **BGrowth Studio** — will publish the JSON product format `WorkspaceViewerPage`
  renders. The Viewer is already a reusable layout precisely so this slots in
  without a rewrite.
- **Commerce / Payments** — `licenses.type = 'purchased' | 'lifetime'` and the
  "Buy" action in My Library are wired for this, pending a real checkout
  integration.
- **Marketplace, Analytics** — no code yet; nothing here assumes their shape.
