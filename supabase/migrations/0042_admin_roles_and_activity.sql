-- 0042 — Website Admin: roles and an activity log.
--
-- 1. Roles. Every row in portal.website_admins gets a role:
--      'admin'   — everything in the Website's Admin area;
--      'support' — Support, Members (view, resend confirmation, give or
--                  extend access and trials) and reading Reviews.
--    Existing administrators stay 'admin'. The Website's server
--    (api/admin.ts) enforces the role on every request; the team list is
--    edited in Admin → Team instead of here.
--
-- 2. Activity log. Every change made in the Admin area is recorded: who,
--    what, when and on which member/product. Written and read only by the
--    Website's server (service role); append-only (no update or delete).

alter table portal.website_admins
  add column if not exists role text not null default 'admin';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'website_admins_role_check' and conrelid = 'portal.website_admins'::regclass
  ) then
    alter table portal.website_admins
      add constraint website_admins_role_check check (role in ('admin', 'support'));
  end if;
end $$;

create table if not exists portal.admin_activity (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  admin_id uuid,
  admin_email text not null,
  action text not null,
  area text not null,
  summary text not null,
  target_user_id uuid,
  target_product_id uuid,
  details jsonb not null default '{}'::jsonb
);

create index if not exists admin_activity_created_idx on portal.admin_activity (created_at desc);
create index if not exists admin_activity_admin_idx on portal.admin_activity (admin_id, created_at desc);
create index if not exists admin_activity_target_user_idx on portal.admin_activity (target_user_id, created_at desc);

alter table portal.admin_activity enable row level security;
revoke all on portal.admin_activity from anon, authenticated;
grant select, insert on portal.admin_activity to service_role;
