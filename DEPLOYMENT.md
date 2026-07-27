# Deployment Guide — Zero to Live

Assumes nothing exists yet: no Supabase project, no Vercel projects, no
environment variables set anywhere. Follow the phases in order — a couple of
steps in Phase 7 genuinely depend on the URL Vercel assigns in Phase 5, so
that ordering isn't arbitrary.

**If a Supabase project already exists** — in particular, the official
BGrowth Supabase project that already hosts the BGrowth Academy LMS schema
— skip Phase 1's project creation and go straight to Phase 1b. Every
Portal/Publishing Engine object lives in its own dedicated `portal` schema
specifically so these migrations are safe to run additively against that
shared project without touching the LMS's tables, functions, or its
existing `public.handle_new_user()`. See `PUBLISHING_ENGINE.md` for the
full rationale.

At the end you'll have: a live Supabase project (database + auth +
storage), `bgrowth-portal` deployed on Vercel (the customer-facing site +
the Publishing Engine's API routes), and `bgrowth-studio` deployed on
Vercel (the authoring tool, able to publish real products into Portal).

I don't have dashboard access to Supabase or Vercel myself, so this is a
runbook for you (or whoever holds those accounts) to follow. If you create
the Supabase project and share a direct Postgres connection string with me
afterward, I can run the migrations/seed for you via `psql` instead of the
SQL Editor — say so and we'll do Phase 2/4 that way instead.

---

## Prerequisites

- A Supabase account and organization to create the project under.
- A Vercel account with access to import from GitHub, and the
  `bgrowthclub/bgrowth-portal` and `bgrowthclub/bgrowth-studio` repos
  reachable from it (installed GitHub App, or manual git remote import).
- Node 18+ locally only if you want to verify builds before deploying —
  not required, Vercel builds both repos itself.

---

## Phase 1 — Create the Supabase project

**If you already have an "official" Supabase project** (e.g. one that
already hosts the BGrowth Academy LMS schema), skip project creation —
you're extending it, not creating a new one. Go straight to step 3 below,
then continue to Phase 2. **Do not try to expose the `portal` schema yet**
— it doesn't exist as a Postgres schema until Phase 2's first migration
creates it, and Supabase's Exposed Schemas picker can only list schemas
that already exist. That step is Phase 2b, after the migrations run.

1. [supabase.com/dashboard](https://supabase.com/dashboard) → **New project**.
2. Name it (e.g. `bgrowth-portal-prod`), choose a region close to your
   expected users, set a strong database password, create it. Wait for
   provisioning (a minute or two).
3. **Project Settings → API** — copy and save three values, you'll need
   all of them in Phase 5:
   - **Project URL** (`https://xxxxx.supabase.co`)
   - **`anon` `public` key**
   - **`service_role` `secret` key** — this one bypasses Row Level
     Security entirely. Never put it in anything prefixed `VITE_`, never
     commit it, never put it anywhere except Vercel's Portal environment
     variables (Phase 5).

---

## Phase 2 — Run the migrations, in order

Supabase's **SQL Editor** (left sidebar) is the simplest path — no CLI
setup needed. Run each file's contents as its own query, top to bottom,
**in this exact order** (each depends on the one before it). All nine are
purely additive: they only ever `create schema if not exists portal` and
`create table`/`create view`/`create function`/`grant` inside it — none of
them read, alter, or drop anything in `public` or any LMS schema.

1. `supabase/migrations/0001_init.sql` — creates `schema portal` if it
   doesn't already exist, then `portal.workspace_categories`,
   `portal.products` (original shape), `portal.users` +
   `portal.handle_new_portal_user()` (a uniquely-named trigger function —
   deliberately not `handle_new_user()`, to coexist with the LMS's own
   function of that name), `portal.licenses` + the one-trial-per-user
   partial unique index. The `auth.users` trigger this migration attaches
   is named `on_auth_user_created_portal_profile` — also unique, so it
   never conflicts with or replaces whatever trigger(s) the LMS already
   has on `auth.users`.
2. `supabase/migrations/0002_add_workspace_content.sql` — adds the
   `portal.products.content` column.
3. `supabase/migrations/0003_publishing_engine.sql` — the big one:
   extends `portal.products` (`content_type`, `status`,
   `studio_product_id`, etc.), creates `portal.product_versions`,
   `portal.publication_destinations` (seeded with 5 rows),
   `portal.product_destinations`, `portal.published_assets`,
   `portal.catalog_index`, and the `portal.publish_product()` function.
4. `supabase/migrations/0004_publishing_engine_storage.sql` — creates the
   `portal-product-assets` Storage bucket and its public-read policy (named
   with the `portal-` prefix because Storage bucket ids are one global
   namespace across the whole project, unlike schema-scoped tables).
5. `supabase/migrations/0005_workspace_trial_config.sql` — adds
   `portal.products.trial_duration`/`trial_unit` (per-Workspace trial
   length instead of a platform-wide constant) and republishes
   `publish_product()` with the two new trailing parameters.
6. `supabase/migrations/0006_trial_duration_upsert_safety.sql` — republishes
   `publish_product()` again so a publish that omits `trial_duration` keeps
   the product's existing value instead of clearing it (mirrors how
   `cover_image_url` already behaves) — protects against Studio's builder
   UI not yet persisting trial config across a reopened-template edit.
7. `supabase/migrations/0007_portal_schema_grants.sql` — grants `anon`/
   `authenticated`/`service_role` `USAGE` on the `portal` schema and the
   per-table privileges each already-existing RLS policy assumes.
   Supabase only auto-grants this for the built-in `public` schema, never
   for one a project creates itself — without this, every request fails
   with `permission denied for schema portal` (42501) regardless of which
   API key is used.
8. `supabase/migrations/0008_workspace_instances.sql` — adds
   `portal.workspace_instances` (saved, named, filled-in checklist records
   per owned Workspace — see `WORKSPACE_INSTANCES_ARCHITECTURE.md`) with
   its own RLS policies and grants.
9. `supabase/migrations/0009_reviews.sql` — adds `portal.reviews` (one
   review per user per product, RLS-public-readable, write-restricted to
   members who hold/held a license for that product) plus the
   `portal.product_review_summary` view (average rating/count per product,
   read separately from the full review list) and
   `portal.licenses.review_requested_at` (tracks the one-time trial-expiry
   review-request email).
10. `supabase/migrations/0010_welcome_pdf.sql` — adds `portal.products.welcome_pdf_url`
    (mirrors `cover_image_url`'s convenience-column pattern, but never
    "sticky" — every publish regenerates a fresh Welcome PDF, see
    `PUBLISHING_ENGINE.md`) and republishes `publish_product()` to accept
    and store it, including a `welcome_pdf` row in `published_assets`.
11. `supabase/migrations/0011_pricing.sql` — adds `portal.products.is_free` /
    `price_cents` / `currency` / `stripe_price_id` and republishes
    `publish_product()` to accept and store them (Studio is the single
    source of truth for pricing, same as everything else it publishes).
12. `supabase/migrations/0012_purchase_licenses.sql` — adds
    `portal.licenses.access_policy` (separating "commercial model" from
    "does this expire," see `README.md`), extends the `type` check
    constraint to allow future `subscription`/`enterprise` values, adds a
    unique constraint enforcing one license row per (member, product), and
    creates `portal.grant_purchased_license()` — the one function
    `api/webhooks/stripe.ts` calls to turn a completed Stripe Checkout
    Session into access.
13. `supabase/migrations/0013_trial_usage_tracking.sql` — fixes a real bug:
    a purchase upgrades an existing trial license's `type` to `'purchased'`
    in place, which silently broke the "one free trial per member, ever"
    check (it counted rows where `type = 'trial'`). Wires up
    `portal.users.has_used_trial` (present since `0001_init.sql`, never
    used) via an insert trigger on `licenses` instead — an immutable flag,
    independent of what a license's `type` later becomes.
14. `supabase/migrations/0014_grant_hardening.sql` — production-readiness
    audit finding: `portal.users`/`portal.reviews` had blanket, column-
    unrestricted `UPDATE` grants to `authenticated`, relying on RLS's
    `auth.uid() = user_id` alone — which proves ownership of the row, not
    which columns a client is allowed to change. Revokes the (unused)
    `users` grant entirely, and restricts `reviews` to exactly the columns
    `reviewService.update()` actually touches (`rating`, `title`,
    `comment`, `updated_at`) — closing a path where a member could
    otherwise reset their own `has_used_trial` flag, or rewrite a review's
    `product_id`/`display_name`/`created_from` after submission.
15. `supabase/migrations/0015_asset_lifecycle.sql` — adds
    `portal.published_assets.deleted_from_storage_at`, republishes
    `publish_product()` to store `storage_path`/`size_bytes` for the cover
    image and Welcome PDF (previously-unused columns), and adds
    `portal.get_prunable_assets()` / `portal.mark_assets_deleted()`
    (retention-window Storage cleanup, called from
    `api/_lib/pruneOldAssets.ts` after every publish/archive),
    `portal.archive_product()` (the Unpublish action, called from the new
    `api/publishing-engine/archive.ts`), and `portal.delete_draft_product()`
    (a guarded hard-delete primitive with no caller yet — see
    `PUBLISHING_ENGINE.md`'s "Asset lifecycle & Archive" section for the
    full design).
16. `supabase/migrations/0016_products_owner_visibility.sql` — fixes a
    critical gap found during the Publishing Engine's final end-to-end
    audit: `portal.products`' only SELECT policy was `status = 'published'`,
    full stop, so archiving a product made its row RLS-invisible to
    *every* client — including a customer who still holds a license for
    it, breaking "existing customers keep full access after archive."
    Replaces the policy with `status = 'published' OR a license exists for
    the requesting user` (additive only — anonymous/public visibility is
    unchanged). Paired with the new `productService.fetchForLibrary()`
    accessor (`MyLibraryPage` now fetches licenses first, then products
    scoped to "published OR licensed," instead of `fetchPublished()`'s
    published-only filter) so an archived-but-owned Workspace still
    appears in My Library and opens correctly.

**After running all sixteen, verify in the SQL Editor:**
```sql
-- Should return 12 rows: 11 base tables plus the product_review_summary view
select table_name, table_type from information_schema.tables
where table_schema = 'portal' order by table_name;

-- Confirms the LMS schemas are untouched and still present alongside portal
select schema_name from information_schema.schemata
where schema_name in ('portal', 'public', 'lms_core_identity', 'lms_course_engine', 'lms_enrollment_progress')
order by schema_name;

-- Should return 5 rows, only 'portal' with is_active = true
select key, is_active from portal.publication_destinations;

-- Should return one row for the bucket
select id, public from storage.buckets where id = 'portal-product-assets';

-- Should return all six functions, schema = 'portal'
select p.proname, n.nspname from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where p.proname in (
  'publish_product', 'grant_purchased_license', 'archive_product',
  'get_prunable_assets', 'mark_assets_deleted', 'delete_draft_product'
);
```
If any of these come back empty, stop and re-run the corresponding
migration before continuing — don't proceed to seeding on a partial schema.
**Don't skip Phase 2b next** — a common failure mode is the migrations
running fine but every app query still 404ing because `portal` was never
added to Exposed Schemas.

---

## Phase 2b — Expose the `portal` schema (required, one-time)

Every Portal/Publishing Engine table, function, and trigger lives in its
own dedicated Postgres schema, **`portal`** — never `public` — specifically
so this can share a Supabase project with the existing BGrowth Academy LMS
(`lms_core_identity`/`lms_course_engine`/`lms_enrollment_progress`) without
any risk of colliding with its tables, functions, or its existing
`public.handle_new_user()`. See `PUBLISHING_ENGINE.md` for the full
rationale.

By default, PostgREST (the API layer both Supabase clients talk to) only
exposes `public` (and `graphql_public`). Without this step, every query
Portal makes will 404 once deployed. This step only works **after** Phase
2's first migration has created the `portal` schema — that's why it's
here and not before Phase 2:

1. **Project Settings → API → Exposed schemas**.
2. Add `portal` to the list (alongside `public`, which stays as-is — the
   LMS and anything else already relying on `public` is untouched).
3. Save. This usually takes effect within a few seconds. If a query still
   404s right after saving, use the SQL Editor to run
   `notify pgrst, 'reload schema';` to force PostgREST to reload its schema
   cache immediately, then retry.

---

## Phase 3 — Confirm the Storage bucket (covered by Phase 2's check above)

If the bucket query above returned `portal-product-assets | true`, this
phase is already done — migration `0004` created it. Nothing manual needed
here unless that query came back empty, in which case re-run `0004`.

---

## Phase 4 — Seed the database

`supabase/seed.sql` publishes the two real products (Notary Appointment
Workspace, Move-Out Cleaning Inspection Workspace) **through the
`portal.publish_product()` function itself** — not raw inserts — so
`product_versions`, `product_destinations`, and `catalog_index` all end up
populated correctly, exactly as a real Studio publish would leave them.

Run the entire contents of `supabase/seed.sql` in the SQL Editor. Then verify:
```sql
select slug, status, current_version from portal.products;
-- both products, status = 'published', current_version = 1

select count(*) from portal.catalog_index;
-- 2

select slug, is_trial_eligible, trial_duration, trial_unit from portal.products;
-- Notary: true / 14 / days — Cleaning: true / 7 / days (two different lengths, proving this is per-Workspace, not a constant)
```
Safe to re-run — each run just publishes a new version (`current_version`
increments); it won't create duplicate product rows, since it upserts on
`studio_product_id`.

---

## Phase 5 — Deploy `bgrowth-portal` to Vercel

1. Vercel dashboard → **Add New → Project** → import `bgrowthclub/bgrowth-portal`.
2. Framework preset: **Vite** (Vercel should auto-detect this). Build
   command `npm run build`, output directory `dist`, install command
   `npm install` — defaults should already be correct. `vercel.json` at
   the repo root rewrites every non-`/api` path to `/index.html`, so a
   hard refresh or a direct link to a client-side route (e.g.
   `/workspace/notary-appointment-workspace`) resolves instead of 404ing
   at the hosting layer before React Router ever gets a chance to handle
   it — without this, only in-app navigation (clicking a `<Link>`) works;
   refreshing or opening a deep link directly does not.
3. Before the first deploy, add these **Environment Variables** (Project
   Settings → Environment Variables — set for Production, and Preview too
   if you want preview deployments to work):

   | Name | Value |
   |---|---|
   | `VITE_SUPABASE_URL` | Project URL from Phase 1 |
   | `VITE_SUPABASE_ANON_KEY` | anon key from Phase 1 |
   | `SUPABASE_URL` | same Project URL — used server-side by `api/publishing-engine/*` |
   | `SUPABASE_SERVICE_ROLE_KEY` | service_role key from Phase 1 — **server-side only, never `VITE_`-prefixed** |
   | `PUBLISHING_ENGINE_SECRET` | generate one now: `openssl rand -hex 32` — save this value, Studio needs the identical string in Phase 6 |
   | `RESEND_API_KEY` | from your Resend dashboard (resend.com/api-keys) — powers `api/notifications/*` (Trial Activated today; more notification types reuse the same key later) |
   | `RESEND_FROM_EMAIL` | e.g. `BGrowth <notifications@bgrowthclub.com>` — the address part **must** be on a domain verified in Resend (Domains tab), or every send is rejected. Resend's own sandbox address only delivers to the account owner, never real members |
   | `PORTAL_PUBLIC_URL` | same as the production URL you'll copy in step 4 below — used to build the logo image and "Open Workspace" link inside notification emails, and the QR code/link in the auto-generated Welcome PDF (`api/publishing-engine/publish.ts`) — without it, publishing still succeeds but the Welcome PDF omits its "Start Your Workspace" section rather than emit a broken link. Also used by `api/checkout/create-session.ts` to build Stripe's success/cancel redirect URLs — without it, Buy Now on a paid Workspace shows a clear error instead of starting checkout |
   | `STRIPE_SECRET_KEY` | Optional for now — the purchase flow (`api/checkout/create-session.ts`) ships as real, working code, but isn't required to deploy. Add it once you've connected a real Stripe account; until then, a free Workspace's "Get Started Free" still works (it never touches Stripe), and a paid Workspace's Buy Now shows "Checkout isn't set up yet" instead of failing |
   | `STRIPE_WEBHOOK_SECRET` | Same "optional for now" note as above — needed by `api/webhooks/stripe.ts` to verify that a `checkout.session.completed` event genuinely came from Stripe. Get it from the Stripe Dashboard after adding a webhook endpoint pointed at `<your-portal-domain>/api/webhooks/stripe` listening for `checkout.session.completed` |

4. Deploy. Once it's live, **copy the production URL** Vercel assigns
   (`https://your-project.vercel.app`, or your custom domain if you attach
   one now) — Phase 6 and Phase 7 both need it, and so does `PORTAL_PUBLIC_URL`
   above (update it once you know the real value, then redeploy).

   The site will build and load, but auth flows (sign up, password reset)
   won't fully work correctly until Phase 7's URL configuration is done —
   that's expected at this point, not a bug.

---

## Phase 6 — Deploy `bgrowth-studio` to Vercel

1. Import `bgrowthclub/bgrowth-studio` as a separate Vercel project (same
   process as Phase 5).
2. Environment variables:

   | Name | Value |
   |---|---|
   | `VITE_GAS_URL` | Studio's existing Google Apps Script deployment URL (unrelated to Portal — required for Studio's own checklist/planner/calculator features regardless of this guide) |
   | `PORTAL_PUBLISHING_ENGINE_URL` | `https://<your-portal-vercel-url>/api/publishing-engine/publish` — the exact Portal URL from Phase 5, plus that path |
   | `PORTAL_PUBLISHING_ENGINE_SECRET` | **the exact same string** you generated for `PUBLISHING_ENGINE_SECRET` in Phase 5 — these two must match byte-for-byte or every publish will 401 |

3. Deploy.

---

## Phase 7 — Configure Supabase Authentication

Now that Portal's real URL exists (Phase 5), go back to Supabase:

1. **Authentication → URL Configuration**:
   - **Site URL**: your Portal production URL — **not** `http://localhost:5173`.
     This is the single most common cause of "confirmation emails link to
     localhost in production": `authService.ts` already passes the correct
     dynamic `emailRedirectTo`/`redirectTo` (built from `window.location.origin`
     at request time — there is no hardcoded localhost anywhere in the app
     code), but if the requested redirect isn't on the allowlist below,
     Supabase silently falls back to whatever **Site URL** is set to. If that
     field was never updated from its project-creation default, every email
     goes out pointing at localhost regardless of what the app sent.
   - **Redirect URLs**: add both
     `https://<your-portal-url>/verify-email` and
     `https://<your-portal-url>/reset-password` — these are exactly the
     paths `authService.ts` passes as `emailRedirectTo`/`redirectTo`; if
     they're not on this allowlist, Supabase will reject the redirect and
     the emailed links will fail silently or bounce to an error page.
     Include the equivalent `localhost:5173` versions too if you'll ever
     test locally against this same project.
2. **Authentication → Providers → Email**: confirm **"Confirm email"** is
   enabled — the app's Verify Email page assumes a confirmation step is
   required. If it's off, signup will skip straight to a confirmed
   session and Verify Email becomes unreachable/unnecessary — fine
   functionally, but not what the built flow assumes.
3. **Authentication → Emails**: paste `supabase/email-templates/confirm-signup.html`
   into the "Confirm signup" template's message body, and
   `supabase/email-templates/reset-password.html` into "Reset Password" —
   both use the real BGrowth logo/brand color instead of Supabase's generic
   default styling. Before pasting, replace `YOUR_PORTAL_DOMAIN` in each file
   with the real production Portal domain (e.g. `app.bgrowthclub.com`) —
   email clients need an absolute image URL, a relative `/logo.png` won't
   resolve from an inbox.
4. **Production email deliverability** (flagged in
   `POST_LAUNCH_IMPROVEMENTS.md`, worth a decision now rather than after
   users start signing up): Supabase's built-in email sending has low
   rate limits meant for development. For real signup volume, configure a
   custom SMTP provider under **Project Settings → Auth → SMTP Settings**
   (Resend, Postmark, SendGrid all work). Not strictly blocking for a
   small initial launch, but the first rate-limit rejection will look like
   "signup emails silently stopped arriving," so decide deliberately
   rather than discover it live.

   **This is a separate integration from `RESEND_API_KEY` above.**
   Confirm signup / Reset Password are sent by Supabase Auth itself,
   server-side, using whatever's configured here — the Portal's own code
   never calls into that path. `RESEND_API_KEY`/`api/_lib/email/` is a
   completely different integration, for emails *this app* decides to send
   (Trial Activated today). If you want Supabase's own auth emails to also
   go through Resend, add Resend's SMTP credentials (from its dashboard,
   not the API key above) to this SMTP Settings screen — that's the only
   way those specific emails route through Resend.

---

## Phase 8 — First end-to-end test

Do this as an actual human, in a real browser, on the live Portal URL —
nothing in this stack has been verified this way before. Suggested order:

1. **Landing page loads**, shows both seeded Workspaces in "Available Workspaces."
2. **Sign up** with a real email you can check. Submit → land on Verify
   Email.
3. **Check your inbox**, click the confirmation link → should land back on
   `/verify-email` and auto-redirect to `/library` (this exact behavior
   was the fix made in the last hardening pass — confirm it actually
   fires).
4. **My Library** shows the "activate your free trial" empty state (no
   license yet).
5. **Trial Selection** → pick one of the two seeded Workspaces → confirm
   the "cannot be changed" dialog → activate.
6. **Redirected to My Library** with the success banner showing the
   product name, and that Workspace now shows as `Trial` with an expiry
   date.
7. **Open Workspace** → walk through at least one full section, confirm
   the progress bar moves, confirm icons and the brand color render
   (Notary should be Electric Blue, Cleaning Move-Out should be teal —
   this proves per-Workspace runtime theming is actually working, not
   just correct in code).
8. **Finish the last section** → confirm the new completion panel appears.
9. **Sign out, sign back in** → confirms session persistence and that
   `ProtectedRoute`/`GuestRoute` behave correctly on a return visit.
10. **Profile page** shows the license from step 5.
11. **Studio → Portal test**: in Studio's Checklist Builder, open (or
    create) a template, fill in **Category**, upload a **Cover Image**, set
    a **Free Trial** duration (e.g. 10 Days), **Save Template** first
    (required — the button is disabled until this happens), then click
    **Publish to Portal**. Confirm the toast shows a version number, then
    check in Supabase:
    ```sql
    select slug, current_version, last_published_by, category_id,
           cover_image_url, is_trial_eligible, trial_duration, trial_unit
    from portal.products
    order by last_published_at desc limit 1;
    ```
    Confirm `cover_image_url` is populated (a real Storage URL, not null),
    `trial_duration`/`trial_unit` match what you entered, `category_id` is
    set, and a new row appended to `product_versions` for that product.
    Then confirm the new Workspace actually appears on Trial Selection with
    that cover image and can be activated end-to-end (steps 1–8 above) —
    publishing alone isn't proof it's usable, seeing it through activation
    and the Viewer is.

If all 11 steps pass, the deployment is verified working end-to-end for
real — not just "should work."

---

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Blank page / console error about missing Supabase env vars | `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` missing on the Vercel project — check Phase 5 step 3, redeploy after adding |
| Signup/reset email link leads to an error page | Redirect URL not allowlisted — Phase 7 step 1 |
| Publish to Portal returns 401 | `PUBLISHING_ENGINE_SECRET` (Portal) and `PORTAL_PUBLISHING_ENGINE_SECRET` (Studio) don't match exactly |
| Publish to Portal returns 500 with a Supabase error | Check `SUPABASE_SERVICE_ROLE_KEY`/`SUPABASE_URL` are set on the **Portal** project (not the anon key by mistake) |
| A product doesn't appear on the storefront after publishing | Check its `status` — only `published` rows are publicly readable; `draft` is correctly invisible, not a bug |
| Trial activation fails with a constraint error | Working as designed — that member already has a trial license; the one-trial-per-user index is doing its job |
| Trial Activated email never arrives, but activation itself succeeds | Working as designed if `RESEND_API_KEY`/`RESEND_FROM_EMAIL` aren't set yet — the endpoint responds `{ ok: true, sent: false }` and logs the reason server-side rather than failing the trial. Check Vercel's function logs for `api/notifications/trial-activated`, and confirm `RESEND_FROM_EMAIL`'s domain is verified in Resend's dashboard, not just the API key |
| Hitting F5 (or opening a deep link like `/workspace/<slug>` directly) returns Vercel's `404: NOT_FOUND` | `vercel.json`'s SPA rewrite is missing or not deployed — confirm it exists at the repo root and redeploy; without it, only client-side navigation (`<Link>` clicks) works, since a real browser navigation/refresh hits Vercel's static hosting directly, before React Router ever runs |
| Buy Now on a paid Workspace shows "Checkout isn't set up yet" | Working as designed until `STRIPE_SECRET_KEY` is configured (see Phase 5) — a free Workspace's "Get Started Free" is unaffected |
| A member paid via Stripe but never got access | Check the Stripe Dashboard's webhook logs for a failed delivery to `/api/webhooks/stripe`, and confirm `STRIPE_WEBHOOK_SECRET` matches the endpoint's signing secret exactly; also check Vercel's function logs for `api/webhooks/stripe` for a `grant_purchased_license` error |

---

## Environment variable reference (both projects, all in one place)

**bgrowth-portal (Vercel):**
```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_CHECKOUT_URL=
VITE_WELCOME_GUIDE_URL=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
PUBLISHING_ENGINE_SECRET=
RESEND_API_KEY=
RESEND_FROM_EMAIL=
PORTAL_PUBLIC_URL=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
```

**bgrowth-studio (Vercel):**
```
VITE_GAS_URL=
PORTAL_PUBLISHING_ENGINE_URL=
PORTAL_PUBLISHING_ENGINE_SECRET=      (must equal Portal's PUBLISHING_ENGINE_SECRET)
```
