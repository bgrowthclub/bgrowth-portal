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
- html2pdf.js (Workspace → PDF export, `src/lib/pdf.ts` — a verbatim port
  of `bgrowth-studio`'s own `downloadElementAsPdf`, kept identical on
  purpose so both apps produce the same PDF behavior)

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
    library/      My Library — only Workspaces the member owns (trial/
                  purchased/expired); browsing the full catalog lives in
                  marketplace/ instead, so Library stays empty until a
                  trial is activated
    marketplace/  Browse Workspaces — the full published catalog, with
                  Open/Start Free Trial/Buy depending on ownership + trial
                  eligibility
    workspace-viewer/  WorkspaceRenderer — generic renderer for any published
                       Workspace JSON (see below), plus the access-gated
                       Viewer page/layout around it
    reviews/      Product Reviews — one review per user per product (see
                  Database schema below). ReviewSummary/ReviewList are
                  self-contained (fetch by productId alone) and not wired
                  into any card today, so they drop into a future dedicated
                  Product Page with no rework. ReviewFormDialog/
                  ReviewPromptCard are the Trial-journey write flow,
                  rendered from library/LibraryWorkspaceCard once a trial
                  expires or a Workspace is purchased.
    profile/      Personal info, licenses, trial expiration
  hooks/          cross-feature hooks (useTheme, useAsync)
  services/       cross-feature data access (supabaseClient, productService,
                  licenseService, userService, workspaceInstanceService,
                  reviewService, checkoutService, notificationService) —
                  the only place Supabase queries (or, for checkout/
                  notifications, the provider-agnostic service call) are
                  written; features call these, never the client directly
  types/          database.ts (mirrors the Supabase schema), workspace.ts
                  (derived/presentation types), workspaceContent.ts (the
                  Workspace JSON schema — mirrors BGrowth Studio's engine)
  lib/            workspaceAccess.ts (license → unlocked/locked/trial/
                  purchased/expired), workspaceIcons.ts (dynamic lucide-react
                  icon resolution), workspaceTheme.ts (per-Workspace runtime
                  color theming), pdf.ts (downloadElementAsPdf — ported
                  verbatim from bgrowth-studio's src/lib/pdf.ts)
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
  why both the Viewer route and the public Product Page route are
  lazy-loaded (`src/app/routes.tsx`): pulling in the full icon library is
  worth it for that genericity, but it stays out of the storefront's initial
  bundle.
- `content.brand.primaryColor` themes the whole render at runtime via CSS
  custom properties (`src/lib/workspaceTheme.ts`, same color-scale algorithm
  Studio itself uses) — a new product with a different brand color needs no
  Portal styling change either.

**Publishing a new Workspace is a data operation, not a code change:** once
the BGrowth Publishing Engine (below) writes a product's JSON into
`products.content` and the row's `status` is `published`, it renders
correctly in the Portal immediately.

## The Product Page

`/product/:slug` (`src/features/product/ProductPage.tsx`) is the single
source of truth for every published Workspace's marketing presence — a
public, unauthenticated page generated entirely from the same `products` row
the Renderer above reads, never hand-authored per product. Every section
either reads a field that's always populated (name, short description,
cover image, trial config) or an accessor in `src/lib/productMarketing.ts`
that reads `products.metadata` and gracefully omits its section when Studio
hasn't published that piece yet (`longDescription`, `included`,
`howItWorks`) — Features falls back to the Workspace's own sections, and FAQ
falls back to the shared, product-agnostic list in `src/data/faqs.ts`.
Adding a new Studio-authorable marketing section later is one new
`ProductMarketingMetadata` field plus one new accessor plus one new section
component — `ProductPage`'s own data-fetching never changes.

A signed-in visitor who already holds a trial/purchased license for the
product is redirected straight to `/workspace/:slug` instead of seeing the
marketing page — see `ProductPage`'s ownership check via
`licenseService`/`deriveAccessState`. The Welcome PDF's QR code always
points at this page (never directly at the Workspace route) specifically so
that redirect applies uniformly.

## The Purchase Flow

`BuyNowButton` → `checkoutService.startCheckout()` → `api/checkout/create-session.ts`
→ Stripe Checkout (or an instant grant for a free Workspace) →
`api/webhooks/stripe.ts` → `portal.grant_purchased_license()`. Every step is
real code, not a stub — `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET` just
aren't configured on this deployment yet by design (a real Stripe account
gets connected later; see `.env.example` and `DEPLOYMENT.md`). Until then,
Buy Now on a paid Workspace shows a clear "Checkout isn't set up yet" error
instead of a broken redirect — a free Workspace's "Get Started Free" works
today regardless, since it never touches Stripe.

Pricing (`is_free`, `price_cents`, `currency`, `stripe_price_id`) is
published data, same as everything else on `products` — Studio is the
single source of truth (see the Publishing Engine below); the Portal never
requires manually setting a price in Supabase. `src/lib/pricing.ts`'s
`formatPrice()` is the one place cents become display copy, the same role
`src/lib/trial.ts` plays for trial length.

A purchase creates/upgrades exactly one `licenses` row per (member,
product) — see "Database schema" below for how `type` (the commercial
model) and `access_policy` (whether it expires) are deliberately separate
dimensions.

## The BGrowth Publishing Engine

The one write path into the catalog — see **[PUBLISHING_ENGINE.md](./PUBLISHING_ENGINE.md)**
for the full architecture, governing principles, and extension points. It's
documented as its own core platform service, not a Portal feature, even
though its code currently lives in this repo (`api/publishing-engine/`).

Required environment variables (server-side only — never prefix these with
`VITE_`, that would ship them to the browser; see `.env.example`):
`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `PUBLISHING_ENGINE_SECRET`,
`PORTAL_PUBLIC_URL` (used to build the Welcome PDF's QR code/link to the
Product Page — see below).

## Database schema

| Table | Purpose |
|---|---|
| `workspace_categories` | Category taxonomy for Workspaces |
| `products` | Catalog (name, description, cover image, `welcome_pdf_url`, `app_url`, `content`, `content_type`, `content_version`, `metadata`, `status`, `current_version`, `is_free`, `price_cents`, `currency`, `stripe_price_id`) |
| `product_versions` | Full snapshot per publish — history/rollback, service-role only |
| `publication_destinations` | Lookup: portal (active), website/etsy/gumroad/academy (not yet) |
| `product_destinations` | Per-destination publish ledger — status/version/external id, service-role only |
| `published_assets` | Generation ledger — Workspace JSON + cover image + Welcome PDF today (the latter generated server-side by the Engine itself, see `PUBLISHING_ENGINE.md`), other PDF/social/marketplace asset types already valid |
| `catalog_index` | Read-optimized, search-indexed projection of published products — public read, not yet queried by the Portal's own pages |
| `users` | Public profile row, 1:1 with `auth.users`, auto-created by a trigger on signup. `has_used_trial` is set once, permanently, by a trigger on `licenses` insert — the source of truth for "has this member ever activated a trial," independent of what that license's `type` later becomes (see `licenseService.hasUsedTrial()`) |
| `licenses` | `type` (trial / purchased / subscription / enterprise — the commercial model) is deliberately separate from `access_policy` (expiring / lifetime — whether `expires_at` is ever checked, see `deriveAccessState()`); plus `status` (active / expired / revoked), `activated_at`, `expires_at`. One row per (member, product) |
| `workspace_instances` | Saved, named, filled-in checklist records per owned Workspace (e.g. one per client) — `label`, `data` (field values), `status` (only `in_progress` used today) — see `WORKSPACE_INSTANCES_ARCHITECTURE.md` |
| `reviews` | One review per user per product (unique constraint) — `rating` (1-5), `title`, `comment`, `display_name` (snapshotted at submission, not a live join), `created_from` (`trial` / `purchase`, for future analytics). Publicly readable; writable only by a member who holds/held a license for that product. |
| `product_review_summary` (view) | `average_rating`/`review_count` per product, aggregated in Postgres — read separately from the full review list (`reviewService.getSummary`) so a summary display scales independently of review volume. |

Trial length is per-Workspace, not a platform-wide constant: `products.is_trial_eligible`
gates whether a Workspace offers a trial at all, and `products.trial_duration`/
`trial_unit` (currently `'days'` only) set how long it runs — e.g. Notary is
14 days, Cleaning is 7. `licenseService.activateTrial()` reads these off the
product to compute `licenses.expires_at`; nothing in the app assumes a fixed
duration. See `src/lib/trial.ts` for the shared formatting helpers every
trial-length display reads through.

A partial unique index enforces "one trial license per user, ever" at the
database level (a member's single free trial is platform-wide, not
per-Workspace), and a second unique index enforces "at most one license row
per (member, product)" — a purchase upgrades an existing trial license for
that same Workspace in place (`portal.grant_purchased_license()`, see the
Purchase Flow above) rather than creating a second row. Row Level Security
is enabled on every table: members can only read their own
`users`/`licenses` rows and can only insert a `trial`-type license for
themselves — a `purchased` license is only ever created by
`grant_purchased_license()`, callable by the service-role client alone (see
`api/webhooks/stripe.ts`); `products` is publicly readable only where
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
