-- 0036 — BGrowth newsletter and launch announcements (Website).
--
-- Visitors subscribe on bgrowth.app (footer, Knowledge, Resources) and
-- confirm by e-mail; members manage it in Settings. Each subscriber picks
-- the areas they care about (Growth Category slugs, the same ones as
-- workspace_categories' areas) — empty = everything. The team writes and
-- sends e-mails from the Website's Admin → Newsletter.
--
-- Access model (same as 0031 support): RLS on, no policies. Every read and
-- write goes through the Website's server endpoints (api/newsletter.ts for
-- visitors/members, api/admin.ts for the team) with the service role.

create table if not exists portal.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email = lower(email) and char_length(email) between 3 and 320),
  user_id uuid references auth.users(id) on delete set null,
  -- Area slugs (business-entrepreneurship, languages, …). Empty = all.
  interests text[] not null default '{}',
  status text not null default 'pending' check (status in ('pending', 'subscribed', 'unsubscribed')),
  -- Secret in every link (confirm, preferences, one-click unsubscribe).
  token uuid not null unique default gen_random_uuid(),
  source text,
  confirmation_sent_at timestamptz,
  confirmed_at timestamptz,
  unsubscribed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists newsletter_subscribers_status_idx on portal.newsletter_subscribers (status);
create index if not exists newsletter_subscribers_user_idx on portal.newsletter_subscribers (user_id);

create table if not exists portal.newsletter_campaigns (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'newsletter' check (kind in ('newsletter', 'launch')),
  product_id uuid references portal.products(id) on delete set null,
  subject text not null default '' check (char_length(subject) <= 200),
  preheader text not null default '' check (char_length(preheader) <= 200),
  body_html text not null default '',
  -- Area slugs this goes to. Empty = every subscriber.
  audience_areas text[] not null default '{}',
  status text not null default 'draft' check (status in ('draft', 'sending', 'sent')),
  sent_count integer not null default 0,
  sent_at timestamptz,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists newsletter_campaigns_created_idx on portal.newsletter_campaigns (created_at desc);

alter table portal.newsletter_subscribers enable row level security;
alter table portal.newsletter_campaigns enable row level security;

revoke all on portal.newsletter_subscribers from anon, authenticated;
revoke all on portal.newsletter_campaigns from anon, authenticated;
grant select, insert, update, delete on portal.newsletter_subscribers to service_role;
grant select, insert, update, delete on portal.newsletter_campaigns to service_role;

-- The mailing address every marketing e-mail must show (US CAN-SPAM),
-- edited in Admin → Newsletter. Sending is blocked while it's empty.
insert into portal.site_settings (key, value) values ('newsletter_address', '""'::jsonb)
on conflict (key) do nothing;

-- Newsletter images are uploaded by api/admin.ts (service role) to the
-- existing public bucket portal-product-assets, under newsletter/.
