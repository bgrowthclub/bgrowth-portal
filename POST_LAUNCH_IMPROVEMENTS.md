# Post-Launch Improvements

Everything in this document is a deliberate deferral, not an oversight —
each item was identified during design/review and consciously not built so
the MVP could ship on schedule. Revisit after launch, informed by real usage
rather than speculation.

## Onboarding

- **Lead-first onboarding model** (designed, not built): capture name+email
  only, pre-create the account via Supabase's `inviteUserByEmail`, create the
  trial license immediately, send a Welcome PDF + activation email, and let
  the member set their password only when clicking through from that email
  (first authenticated access). This is a real redesign of the current
  account-first Sign Up flow — it needs a new `leads` table, a new
  server-side "Onboarding Service" endpoint (separate from the Publishing
  Engine), and a transactional email provider decision. Current MVP ships
  with the existing account-first flow (Sign Up → Verify Email → Trial
  Selection) instead.
- **Beta Welcome Page** (designed, not built): an interstitial setting beta
  expectations before account creation.
- **Transactional email provider** (not decided): needed for the activation
  email above, and for any future notification email — Resend/Postmark/
  SendGrid are the live options; Supabase's native auth emails (invite,
  password reset) don't need this and already work today.

## Publishing Engine

- **Additional content types**: `content_type` already models Template,
  Document, PDF, Course, Calculator, AI Tool, and Academy Lesson — only
  `workspace` has a validation schema. Add one per type as each engine
  actually produces a real product (see `PUBLISHING_ENGINE.md`'s extension
  points).
- **Additional destinations**: Website/Etsy/Gumroad/Academy exist as inactive
  rows in `publication_destinations` — only `portal` is active.
- **Workflow states beyond Draft/Published**: `ready_for_review`/`approved`/
  `archived` are valid in the schema, unused in practice.
- **`catalog_index` wiring**: populated on every publish, but the Portal's
  own pages (`productService`) still read `products` directly. Pointing
  search/featured/related/new-release rails at `catalog_index` instead is a
  follow-up, not a schema change.
- **Preview links** for Draft/Ready-for-Review products, and a **rollback
  UI** on top of `product_versions`' existing snapshots — neither has any
  UI yet.
- **PDF generation** (Welcome PDF, Product PDF, marketing materials) —
  `published_assets.asset_type` already reserves these values; nothing
  generates them yet.
- **Studio ↔ Portal auth**: a single shared static secret today, not
  per-user permissions — reasonable while Studio has no Supabase Auth
  integration of its own.

## Portal UX

- **Global toast/notification system**: the trial-activation success moment
  added for launch uses a simple inline dismissible banner (no new
  dependency) rather than a proper toast system. Studio already has a
  `Toast` component worth looking at as the pattern to follow if the Portal
  ever needs more than this one moment.
- **Automated test suite**: no Vitest/Testing Library setup exists.
  Deliberately not introduced pre-launch (new infrastructure); recommended
  as the first post-launch investment given the manual-verification-only
  approach used to ship this MVP.
- **Profile editing**: Profile is currently read-only display — no
  full-name/password/email change flow yet.
- **Commerce / checkout**: the "Buy" action on locked/expired Workspaces has
  no real flow behind it yet — `licenses.type = 'purchased' | 'lifetime'`
  and `product_destinations`/`published_assets` are ready for this, but
  nothing generates a real license from a real payment yet.
