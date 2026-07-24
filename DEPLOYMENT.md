# Deployment Guide — Zero to Live

Assumes nothing exists yet: no Supabase project, no Vercel projects, no
environment variables set anywhere. Follow the phases in order — a couple of
steps in Phase 7 genuinely depend on the URL Vercel assigns in Phase 5, so
that ordering isn't arbitrary.

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
**in this exact order** (each depends on the one before it):

1. `supabase/migrations/0001_init.sql` — `workspace_categories`, `products`
   (original shape), `users` + the `handle_new_user()` trigger, `licenses`
   + the one-trial-per-user partial unique index.
2. `supabase/migrations/0002_add_workspace_content.sql` — adds the
   `products.content` column.
3. `supabase/migrations/0003_publishing_engine.sql` — the big one:
   extends `products` (`content_type`, `status`, `studio_product_id`,
   etc.), creates `product_versions`, `publication_destinations` (seeded
   with 5 rows), `product_destinations`, `published_assets`,
   `catalog_index`, and the `publish_product()` function.
4. `supabase/migrations/0004_publishing_engine_storage.sql` — creates the
   `product-assets` Storage bucket and its public-read policy.

**After running all four, verify in the SQL Editor:**
```sql
-- Should return 7 tables
select table_name from information_schema.tables
where table_schema = 'public' order by table_name;

-- Should return 5 rows, only 'portal' with is_active = true
select key, is_active from public.publication_destinations;

-- Should return one row for the bucket
select id, public from storage.buckets where id = 'product-assets';

-- Should return the function
select proname from pg_proc where proname = 'publish_product';
```
If any of these come back empty, stop and re-run the corresponding
migration before continuing — don't proceed to seeding on a partial schema.

---

## Phase 3 — Confirm the Storage bucket (covered by Phase 2's check above)

If the bucket query above returned `product-assets | true`, this phase is
already done — migration `0004` created it. Nothing manual needed here
unless that query came back empty, in which case re-run `0004`.

---

## Phase 4 — Seed the database

`supabase/seed.sql` publishes the two real products (Notary Appointment
Workspace, Move-Out Cleaning Inspection Workspace) **through the
`publish_product()` function itself** — not raw inserts — so
`product_versions`, `product_destinations`, and `catalog_index` all end up
populated correctly, exactly as a real Studio publish would leave them.

Run the entire contents of `supabase/seed.sql` in the SQL Editor. Then verify:
```sql
select slug, status, current_version from public.products;
-- both products, status = 'published', current_version = 1

select count(*) from public.catalog_index;
-- 2
```
Safe to re-run — each run just publishes a new version (`current_version`
increments); it won't create duplicate product rows, since it upserts on
`studio_product_id`.

---

## Phase 5 — Deploy `bgrowth-portal` to Vercel

1. Vercel dashboard → **Add New → Project** → import `bgrowthclub/bgrowth-portal`.
2. Framework preset: **Vite** (Vercel should auto-detect this). Build
   command `npm run build`, output directory `dist`, install command
   `npm install` — defaults should already be correct.
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

4. Deploy. Once it's live, **copy the production URL** Vercel assigns
   (`https://your-project.vercel.app`, or your custom domain if you attach
   one now) — Phase 6 and Phase 7 both need it.

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
   - **Site URL**: your Portal production URL.
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
3. **Authentication → Emails**: the default Supabase templates work for
   an MVP launch. If you want branded emails, edit the "Confirm signup"
   and "Reset password" templates here — not required to launch.
4. **Production email deliverability** (flagged in
   `POST_LAUNCH_IMPROVEMENTS.md`, worth a decision now rather than after
   users start signing up): Supabase's built-in email sending has low
   rate limits meant for development. For real signup volume, configure a
   custom SMTP provider under **Project Settings → Auth → SMTP Settings**
   (Resend, Postmark, SendGrid all work). Not strictly blocking for a
   small initial launch, but the first rate-limit rejection will look like
   "signup emails silently stopped arriving," so decide deliberately
   rather than discover it live.

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
    create) a template, **Save Template** first (required — the button is
    disabled until this happens), then click **Publish to Portal**.
    Confirm the toast shows a version number, then check in Supabase:
    ```sql
    select slug, current_version, last_published_by from public.products
    order by last_published_at desc limit 1;
    ```
    and confirm a new row appended to `product_versions` for that product.

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

---

## Environment variable reference (both projects, all in one place)

**bgrowth-portal (Vercel):**
```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
PUBLISHING_ENGINE_SECRET=
```

**bgrowth-studio (Vercel):**
```
VITE_GAS_URL=
PORTAL_PUBLISHING_ENGINE_URL=
PORTAL_PUBLISHING_ENGINE_SECRET=      (must equal Portal's PUBLISHING_ENGINE_SECRET)
```
