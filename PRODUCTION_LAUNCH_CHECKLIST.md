# Production Launch Checklist

Every item below is a manual, dashboard-side step — nothing here lives in
this repository, and nothing here is fixed by a code change. This is the
single list to work through, in order, before real members hit production.
It consolidates (and cross-references) `DEPLOYMENT.md`'s full Phase 1–8
runbook — that document explains *why* each step exists; this one exists so
nothing gets forgotten while actually doing it.

Check items off in order. Don't skip ahead — a few later steps genuinely
depend on earlier ones (the email templates need the production URL from
step 2; the SMTP sender identity should match the same values already
chosen for the app's own emails).

---

## 1. Vercel environment variables — `bgrowth-portal`

Project Settings → Environment Variables (Production, and Preview if you
want preview deployments to work). See `DEPLOYMENT.md` Phase 5 for what
each one does.

- [ ] `VITE_SUPABASE_URL`
- [ ] `VITE_SUPABASE_ANON_KEY`
- [ ] `SUPABASE_URL`
- [ ] `SUPABASE_SERVICE_ROLE_KEY`
- [ ] `PUBLISHING_ENGINE_SECRET`
- [ ] `PORTAL_PUBLIC_URL` — the real production domain (update and redeploy once Vercel assigns it, or once a custom domain is attached)
- [ ] `RESEND_API_KEY`
- [ ] `EMAIL_FROM_ADDRESS` — leave unset to use the default (`info@bgrowth.app`), or set explicitly
- [ ] `EMAIL_FROM_NAME` — leave unset to use the default (`BGrowth`), or set explicitly
- [ ] `EMAIL_REPLY_TO` — leave unset to default to `EMAIL_FROM_ADDRESS`, or set explicitly
- [ ] `SUPPORT_EMAIL` — the real, monitored support inbox
- [ ] `STRIPE_SECRET_KEY` — only if selling paid Workspaces at launch
- [ ] `STRIPE_WEBHOOK_SECRET` — only if selling paid Workspaces at launch (see step 8 below — the webhook endpoint must exist first)

## 2. Vercel environment variables — `bgrowth-studio`

- [ ] `VITE_GAS_URL`
- [ ] `PORTAL_PUBLISHING_ENGINE_URL` — the Portal's real production URL + `/api/publishing-engine/publish`
- [ ] `PORTAL_PUBLISHING_ENGINE_SECRET` — must exactly match `PUBLISHING_ENGINE_SECRET` above

## 3. Resend — sending domain

- [ ] Add and verify the sending domain for `EMAIL_FROM_ADDRESS` (`info@bgrowth.app`'s domain) in the Resend dashboard's **Domains** tab
- [ ] Confirm the domain shows **Verified**, not just "Pending" — sends from an unverified domain are rejected outright, and Resend's own sandbox address (`onboarding@resend.dev`) only delivers to the account owner, never real members

## 4. Supabase — Auth URL configuration

**Authentication → URL Configuration**:

- [ ] **Site URL** set to the real production Portal URL (not `localhost`) — this is the #1 cause of confirmation emails linking to `localhost` in production
- [ ] **Redirect URLs** allowlist includes `https://<production-domain>/verify-email` and `https://<production-domain>/reset-password`
- [ ] (optional) the equivalent `localhost:5173` versions added too, if this same Supabase project will ever be tested against locally

## 5. Supabase — enable email confirmation

**Authentication → Providers → Email**:

- [ ] **"Confirm email"** toggle is **enabled** — the app's Verify Email page assumes this

## 6. Supabase — the six auth email templates

**Authentication → Emails.** For each of the six files below: replace both
placeholders in the file *first*, then paste the whole `<!doctype html>...`
body into that template's **Message body** field, then set its **Subject
heading** field separately (the subject is not part of the pasted body).

| File | Dashboard template | Subject heading to set |
|---|---|---|
| `supabase/email-templates/confirm-signup.html` | Confirm signup | `Confirm your BGrowth email` |
| `supabase/email-templates/reset-password.html` | Reset Password | `Reset your BGrowth password` |
| `supabase/email-templates/magic-link.html` | Magic Link | `Your BGrowth sign-in link` |
| `supabase/email-templates/invite-user.html` | Invite user | `You're invited to BGrowth` |
| `supabase/email-templates/change-email-address.html` | Change Email Address | `Confirm your new BGrowth email address` |
| `supabase/email-templates/reauthentication.html` | Reauthentication | `Your BGrowth verification code` |

- [ ] `confirm-signup.html` — placeholders replaced, pasted, subject set
- [ ] `reset-password.html` — placeholders replaced, pasted, subject set
- [ ] `magic-link.html` — placeholders replaced, pasted, subject set
- [ ] `invite-user.html` — placeholders replaced, pasted, subject set
- [ ] `change-email-address.html` — placeholders replaced, pasted, subject set
- [ ] `reauthentication.html` — placeholders replaced, pasted, subject set

Placeholder replacement, done once per file:

- [ ] `YOUR_PORTAL_DOMAIN` → the real production Portal domain (e.g. `portal.bgrowth.app`, no `https://` prefix — it's already embedded in each `https://YOUR_PORTAL_DOMAIN/...` URL). Used for the header logo image and the Privacy/Terms footer links. Email clients need an absolute URL — a relative `/logo.png` won't resolve from an inbox.
- [ ] `YOUR_SUPPORT_EMAIL` → the real, monitored support inbox (should match `SUPPORT_EMAIL` from step 1). Used for the footer "Support" `mailto:` link.

> Magic Link, Invite User, Change Email Address, and Reauthentication are
> not currently triggered by anything in the Portal's own UI (no magic-link
> sign-in, self-service email change, admin invite, or step-up reauth flow
> exists yet) — they're configured now so Supabase's full template set is
> BGrowth-branded and ready the moment any of those features ship. Confirm
> Signup and Reset Password are the two flows real members will actually
> receive at launch.

## 7. Supabase — SMTP sender identity

**Project Settings → Auth → SMTP Settings** — this is a *separate* system
from `EMAIL_FROM_*` in step 1; Supabase has no API this app calls to read
or set it, so it's set here by hand, once:

- [ ] Custom SMTP provider configured (Resend, Postmark, or SendGrid all work) — Supabase's built-in email sending has development-only rate limits; the first real signup burst will hit them if this isn't done
- [ ] **From Name** set to `BGrowth`
- [ ] **From Email** set to `info@bgrowth.app`
- [ ] **Reply-To** set to `info@bgrowth.app`
- [ ] (if using Resend for this too) SMTP credentials come from Resend's dashboard — **not** the same as `RESEND_API_KEY`, which is a separate REST API key used only by this app's own code (step 1)

## 8. Stripe (only if selling paid Workspaces at launch)

- [ ] Webhook endpoint added in the Stripe Dashboard, pointed at `https://<production-domain>/api/webhooks/stripe`
- [ ] Subscribed to `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`
- [ ] `STRIPE_WEBHOOK_SECRET` (the endpoint's signing secret) copied into step 1's Vercel env vars, and redeployed

## 9. Verify authentication emails in production

Do this as a real human, with a real inbox, against the live URL — not a
local/staging environment:

- [ ] **Sign up** with a real email → receive the Confirm Signup email within a minute or two
  - [ ] Sender shows as **BGrowth** `<info@bgrowth.app>` (or Supabase's fallback if step 7 wasn't done yet — confirm which)
  - [ ] Subject reads `Confirm your BGrowth email`
  - [ ] Logo image loads (proves `YOUR_PORTAL_DOMAIN` was replaced correctly)
  - [ ] "Confirm my email" button opens the production Portal, not `localhost`, and completes sign-up
  - [ ] Support/Privacy/Terms footer links resolve to real pages
  - [ ] Not landing in spam/junk
- [ ] **Request a password reset** → receive the Reset Password email
  - [ ] Same sender/branding/link checks as above
  - [ ] "Reset my password" completes the flow and returns to a working session
- [ ] Open both received emails on an actual phone (not just a desktop client) to confirm mobile rendering
- [ ] Reply to one of these emails from a real inbox → confirm it reaches `info@bgrowth.app`, not a no-reply/bounce address

## 10. Verify the app's own transactional emails (Resend)

- [ ] Activate a free trial → **Trial Activated** email arrives, correct sender/branding, "Open Workspace" link works
- [ ] Complete a real (or Stripe test-mode) purchase → **Purchase Confirmed** email arrives, correct sender/branding, "Open My Workspace" link works
- [ ] Let a trial expire (or simulate) → **Trial Review Request** email arrives exactly once, correct sender/branding, "Leave a Review" link works

## 11. Final sign-off

- [ ] Every box above is checked
- [ ] `DEPLOYMENT.md` Phase 8's full end-to-end test (landing page → sign up → trial → Workspace → Studio publish) has been run against production and passed
- [ ] Milestone closed
