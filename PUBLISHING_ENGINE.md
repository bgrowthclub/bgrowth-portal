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

`products` has exactly one RLS policy: `select` where `status = 'published'`.
There is no `insert`/`update`/`delete` policy for the `anon` or `authenticated`
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
| Workflow states | `draft` → `published` only — `ready_for_review`/`approved`/`archived` are valid but unused |
| Assets | `workspace_json` (always) + `cover_image` (if provided) — `thumbnail`/`welcome_pdf`/`product_pdf`/`social_image`/`marketplace_image`/`marketing_material` are valid `asset_type` values, none generated yet |
| Catalog index | Populated on every publish; not yet read by any Portal page |
| Callers | `bgrowth-studio`'s Checklist Builder ("Publish to Portal" button) |

## Architecture

```
Studio (authoring)
  → its own serverless proxy (bgrowth-studio/api/publish.js) — holds no secret in browser code
    → POST /api/publishing-engine/publish (this repo)
      → zod-validates payload + content (schema keyed by content_type)
      → uploads cover image / other assets to Supabase Storage if sent as base64
      → calls publish_product() via a service-role client
        → one Postgres transaction: upserts products, inserts a
          product_versions snapshot, upserts product_destinations,
          inserts published_assets rows, maintains catalog_index
```

**Extension points** (how to add capability without redesigning):
- **A new content type**: add its zod schema to
  `contentSchemasByType` in `api/publishing-engine/publish.ts`. Until that
  exists for a given `content_type`, publishing it is rejected with a clear
  "not yet supported" error — never silently accepted as opaque JSON.
- **A new destination**: insert a row into `publication_destinations`
  (`is_active = true` when ready) — `product_destinations` and
  `published_assets` already carry a `destination_id`, no migration needed.
- **A new asset type** (e.g. Welcome PDF generation): add one more entry to
  the publish payload's `assets[]` array — the endpoint, RPC, and schema
  already accept it generically.
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
