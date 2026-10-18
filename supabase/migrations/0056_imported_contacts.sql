-- 0056 — Contacts brought from the Wix site (Website Sprint 116)
--
-- The people who were in touch with the old Wix site (forms, members, store,
-- the Notary app's free plan…), kept here so nobody is lost when Wix closes.
-- They are NOT newsletter subscribers or members: they never agreed to
-- BGrowth e-mails. Admin → Newsletter → Wix contacts sends them ONE invite
-- (invited_at); only who clicks "Yes, keep me posted" joins the newsletter
-- (accepted_at, through api/newsletter.ts?resource=invite-accept).
--
-- grp: 'contact' (a real person to invite), 'team' (us / tests),
-- 'spam' (sales pitches and fake "Wix support" messages sent through the
-- contact form) — the team can change it. Service role only. Additive only.
-- The rows themselves are loaded once with a separate SQL file (not kept in
-- the repository, since it holds people's e-mails).

create table if not exists portal.imported_contacts (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  name text,
  source text not null default 'wix',
  origin text,
  grp text not null default 'contact' check (grp in ('contact', 'team', 'spam')),
  was_member boolean not null default false,
  had_free_plan boolean not null default false,
  unsubscribed_before boolean not null default false,
  external_id text,
  external_created_at timestamptz,
  invite_token uuid not null default gen_random_uuid() unique,
  invited_at timestamptz,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table portal.imported_contacts enable row level security;
grant select, insert, update, delete on portal.imported_contacts to service_role;
