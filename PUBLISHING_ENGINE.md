# BGrowth Publishing Engine

The Publishing Engine is one of BGrowth's core platform services — not a
Portal feature. It is the single path by which authored content becomes
customer-visible, across every current and future BGrowth product line. This
document is its charter and architecture reference; keep it current as the
Engine evolves (see Principle 6).

Its code currently lives inside this repo (`bgrowth-portal/api/publishing-engine/`
and `supabase/migrations/000{3,4}_*.sql`) for infrastructure convenience —
that's where the Supabase project credentials already are — but it is
conceptually independent of the Portal. See "Where the Engine lives" below.

**The Supabase project is shared, not dedicated.** It's the official BGrowth
database, and already hosts the BGrowth Academy LMS
(`lms_core_identity`/`lms_course_engine`/`lms_enrollment_progress`) — a
separate application with its own tables, functions, and an existing
`public.handle_new_user()`. Every table, function, and trigger the Publishing
Engine and Portal own lives in its own dedicated Postgres schema, **`portal`**,
never in `public` — this is a structural guarantee against collision with LMS
objects, not just a naming convention. Practically, this means:
- Every migration creates objects as `portal.<name>`, never `public.<name>`.
- Both Supabase clients (`src/services/supabaseClient.ts`,
  `api/_lib/supabaseAdmin.ts`) pass `db: { schema: "portal" }` — the Supabase
  project must have `portal` added to its exposed schemas
  (Project Settings → API) or every query 404s. See `DEPLOYMENT.md`.
- The Storage bucket is `portal-product-assets`, not the generic
  `product-assets` — bucket ids are one global namespace, unlike tables,
  so this stays unambiguously scoped too.
- Portal's own `auth.users` profile-creation trigger/function are uniquely
  named (`on_auth_user_created_portal_profile` /
  `portal.handle_new_portal_user()`) specifically so they coexist with
  whatever the LMS already has on `auth.users`, rather than replacing it.

## Governing principles

These are durable rules for this service, not preferences for one feature.
Any change that would violate one of these is an architectural decision and
should stop and be raised, not implemented silently.

1. **Studio is the single authoring source.** No other application generates
   or modifies published products. If a second authoring tool ever exists,
   it publishes through this same Engine — it does not gain its own write
   path into `products`.
2. **Portal is read-only.** Portal's application code never edits published
   content; it only consumes it. This is enforced at the database level, not
   just by convention — see "The read-only guarantee" below.
3. **The Engine is reusable, by design, across every content type.**
   `content_type` already models Workspace, Template, Document, PDF, Course,
   Calculator, AI Tool, and Academy Lesson. Only Workspace is implemented.
4. **Build incrementally.** Prepare the schema/API for future capability;
   don't add UI or business logic for a content type, destination, or
   workflow state until there's a real product that needs it.
5. **New content types must not break existing ones.** Adding a second
   `content_type`'s validation schema, or a second destination, must not
   require changing how Workspace publishing or the `portal` destination
   already work.
6. **Documentation stays current.** This file describes what the Engine
   actually does today vs. what it's merely prepared for — keep that
   distinction accurate as capability is added.

## The read-only guarantee (Principle 2, enforced)

`products` has exactly one RLS policy: `select` where `status = 'published'`
**or** the requesting user holds a license for that product (added in
`0016_products_owner_visibility.sql` — see "Existing customer access after
archive" below; anonymous/public visibility is unchanged, this only adds
back what a license holder can already see). There is no `insert`/`update`/
`delete` policy for the `anon` or `authenticated`
roles — the same roles Portal's own frontend uses via the anon key. Portal's
application code is therefore *incapable* of writing to `products` at the
database level, regardless of what the code does. The same is true of
`product_versions`, `product_destinations`, and `published_assets`: no public
policy at all. Only the Engine's own service-role client
(`api/_lib/supabaseAdmin.ts`, used exclusively inside `api/publishing-engine/*`)
can write, and that client is never imported by anything Portal's frontend
bundles or calls.

## What's implemented today

| Capability | Status |
|---|---|
| Content type | `workspace` only — validated against `src/schemas/workspaceContent.schema.ts` |
| Destination | `portal` only — `website`/`etsy`/`gumroad`/`academy` exist as inactive rows in `publication_destinations` |
| Workflow states | `draft` → `published` → `archived` — `ready_for_review`/`approved` are valid but unused. `draft` is a valid RPC value but nothing in Studio ever sends it (its "Publish to Portal" action always sends `published`), so no product ever reaches the Portal in `draft` status today |
| Assets | `workspace_json` (always) + `cover_image` (sent from Studio's Template Settings image picker, compressed client-side) + `welcome_pdf` (generated server-side by the Engine itself on every publish — see below, no Studio input required) — `thumbnail`/`product_pdf`/`social_image`/`marketplace_image`/`marketing_material` are valid `asset_type` values, none generated yet |
| Trial configuration | Per-Workspace, set from Studio's Template Settings (`isTrialEligible`, `trialDuration`, `trialUnit`) — see `supabase/migrations/0005_workspace_trial_config.sql`. Studio's unit picker also shows Weeks/Months/Hours for a future release, but publishing with anything other than `days` is rejected client-side today, since only `days` has a Portal-side implementation |
| Pricing | Per-Workspace, set from Studio's Template Settings (`isFree`, `price`, `stripePriceId`) — see `supabase/migrations/0011_pricing.sql`. Studio is the single source of truth; the Portal never requires manually setting a price in Supabase. `stripePriceId` has no authoring UI yet (entered manually once Commerce creates a real Stripe Price object) — until then the checkout endpoint builds a Stripe line item dynamically from `price_cents`/`currency` |
| Asset lifecycle | Retention-window pruning after every publish/archive (keeps only the current + previous version's Storage files; older `published_assets` rows stay as an audit trail with a stale `url`), plus a dedicated Archive (Unpublish) endpoint — see "Asset lifecycle & Archive" below |
| Catalog index | Populated on every publish; not yet read by any Portal page |
| Callers | `bgrowth-studio`'s Checklist Builder ("Publish to Portal" / "Unpublish" buttons) |

## Architecture

```
Studio (authoring)
  → its own serverless proxy (bgrowth-studio/api/publish.js) — holds no secret in browser code
    → POST /api/publishing-engine/publish (this repo)
      → zod-validates payload + content (schema keyed by content_type)
      → uploads cover image / other assets to Supabase Storage if sent as base64
      → generates the Welcome PDF server-side (api/_lib/generateWelcomePdf.ts,
        pdf-lib + qrcode — no browser/DOM involved) and uploads it too
      → calls publish_product() via a service-role client
        → one Postgres transaction: upserts products, inserts a
          product_versions snapshot, upserts product_destinations,
          inserts published_assets rows, maintains catalog_index
```

**Welcome PDF.** Unlike `cover_image`, this asset is never sent by Studio —
the Engine generates it itself, on every publish, from the same validated
payload (name, short description, content sections, cover image, trial
config, and any `metadata.outcomes` Studio has published — see
`src/lib/productMarketing.ts`). Generation is best-effort, not part of the
critical path — it runs in its own try/catch inside
`api/publishing-engine/publish.ts`, and any failure (an unreachable cover
image, a slow network) results in `welcome_pdf_url: null` rather than
failing the whole publish. The cover-image fetch inside it is also
time-bounded (`AbortSignal.timeout`), and the route itself sets
`maxDuration: 60` to give the combined font-embedding/fetch/upload work
enough headroom under cold start. It's an onboarding guide, not the product
itself: welcome message, cover image, a "Workspace Version N · Published
&lt;date&gt;" stamp (version computed the same way `publish_product()`
computes it — see `api/publishing-engine/publish.ts` — since generation has
to happen before that RPC call returns the real value), a numbered "how to
get started" list derived from the Workspace's own sections, an optional
"What You'll Accomplish" list, and a QR code + link pointing at the Product
Page (`${PORTAL_PUBLIC_URL}/product/<slug>`, not the Workspace route
directly — see `ProductPage`'s own ownership-detection redirect). Its role
downstream of a purchase is deliberately secondary: the Purchase
Confirmation email (`api/_lib/email/templates/purchaseConfirmed.ts`) links
it as an optional "Quick Start Guide," never as a second button competing
with that email's one primary CTA, "Open My Workspace" — the Workspace is
the product, the PDF is just a companion. Stored on
`products.welcome_pdf_url` (convenience column) and as a `welcome_pdf` row in
`published_assets` (full history) — see `supabase/migrations/0010_welcome_pdf.sql`.

## Asset lifecycle & Archive

The full publishing lifecycle is **Draft → Publish → Republish → Archive
(Unpublish)**, owned entirely by Studio's Template Builder ("Publish to
Portal" / "Unpublish" buttons, with a confirm dialog before archiving).

**Retention-window pruning.** Every publish creates a new version, and
every version's cover image / Welcome PDF gets its own uniquely-named
Storage object — nothing ever overwrites a prior upload, so without
cleanup, every republish leaves the previous version's files behind
forever. `api/_lib/pruneOldAssets.ts` closes this: called *after* a
publish or archive has already committed successfully (never before —
the replacement must exist before anything old is removed), it deletes
the Storage object for any asset older than the current version minus
one, i.e. **only the current and previous version's assets stay
downloadable**. The `published_assets` **rows** for older versions are
never deleted — only `deleted_from_storage_at` gets stamped on them —
so `product_versions`/`published_assets` remain a complete audit trail;
an old version's `url` just 404s once its file is gone. A failure here
is logged and otherwise ignored (see `pruneOldAssets.ts`'s own
try/catch) — it never fails a publish/archive that already succeeded,
and anything not yet pruned stays eligible on the next run.

**Archive (Unpublish)** (`api/publishing-engine/archive.ts`,
`portal.archive_product()`) removes a Workspace from the public catalog
and blocks new purchases/trials — already guaranteed by every discovery
read path filtering on `status = 'published'`
(`productService.fetchPublished`/`fetchTrialEligible`, `ProductPage`,
`api/checkout/create-session.ts`) — while leaving every existing
license, review, and version snapshot completely untouched, and
existing customers' access unaffected (`deriveAccessState()` never
reads `products.status`). Deliberately **not** a call to `/publish` with
`status: 'archived'`: Studio's draft state doesn't persist pricing/trial
config between sessions (same gap as `0011_pricing.sql`'s comment on
`is_free`/`trial_duration`), so reusing the general publish path for a
"just hide this" action risks silently overwriting real values with a
reopened draft's stale defaults. `archive_product()` touches only
status/version/catalog visibility, reading every other field back from
the existing row rather than having Studio re-supply it.

**Existing customer access after archive.** `deriveAccessState()` not
reading `products.status` is necessary but was not sufficient on its own —
the Publishing Engine's final end-to-end audit found that `products`' RLS
policy still made an archived row invisible at the database layer to
*every* client, including the owning customer's own session, regardless
of what application code did with it. `productService.fetchBySlug()` (used
by `WorkspaceViewerPage`) and `licenseService.fetchForUserWithProduct()`'s
embedded `products` join (used by `ProfilePage`) both silently returned
nothing for an archived-but-owned product as a result. Fixed by
`0016_products_owner_visibility.sql` (see above) plus a new
`productService.fetchForLibrary(licensedProductIds)` accessor —
`MyLibraryPage` now resolves the member's licenses first, then fetches
products scoped to "published OR licensed," instead of the published-only
`fetchPublished()`.

**Hard delete** (`portal.delete_draft_product()`) exists as a
safety-checked primitive — guarded to a product that has `status =
'draft'`, has never had a `published` version in its `product_versions`
history, and has zero rows in `licenses` — but has no caller yet, since
Studio's publish action never sends `status: 'draft'` today. Ready for
whenever a genuine "delete this never-published draft" action gets
built, without needing the safety checks re-derived at that point.

**Assets Manager (architecture prepared, not built).** The data model is
already shaped for an admin view over `published_assets` — per-asset
`storage_path`/`size_bytes` (now populated on every upload, previously
tracked columns that nothing wrote to), `deleted_from_storage_at`
(distinguishes "still downloadable" from "audit-trail only"), and
`get_prunable_assets()` (already the exact query such a view's "detect
what's prunable" action would run). No page/route exists for this yet —
intentionally deferred until there's a real admin-tooling need.

**Extension points** (how to add capability without redesigning):
- **A new content type**: add its zod schema to
  `contentSchemasByType` in `api/publishing-engine/publish.ts`. Until that
  exists for a given `content_type`, publishing it is rejected with a clear
  "not yet supported" error — never silently accepted as opaque JSON.
- **A new destination**: insert a row into `publication_destinations`
  (`is_active = true` when ready) — `product_destinations` and
  `published_assets` already carry a `destination_id`, no migration needed.
- **A new asset type**: add one more entry to the publish payload's
  `assets[]` array (Studio-supplied) or generate it server-side the way
  `welcome_pdf` is generated (Engine-supplied) — the endpoint, RPC, and
  schema already accept any `asset_type` generically.
- **A new workflow state actually being used** (e.g. `ready_for_review` as a
  real approval step): no schema change — the check constraints already
  allow it. It's a UI/process change in Studio, not a Portal/Engine change.

## Where the Engine lives

Kept inside `bgrowth-portal` deliberately (Principle 4 — no new repo/
deployment until there's a real second consumer or destination that needs
one). The boundary is already logical, not just physical: Portal's own
frontend never imports or calls `api/publishing-engine/*`; only Studio's
server-side proxy does. If a second destination (e.g. a future BGrowth
Website) or a second authoring tool ever needs to call the Engine
independently of Portal's deployment lifecycle, extracting it into its own
repo at that point is a small move — the code doesn't depend on anything
Portal-specific beyond the Supabase project itself.
