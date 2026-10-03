-- 0030 — BGrowth Website administrators.
--
-- The Website (bgrowth.app) gets its own Administration area (members,
-- licenses, trials, manual access grants). As 0022_studio_admins.sql
-- anticipated, the Website's admin population gets its own table instead
-- of overloading portal.studio_admins.
--
-- Read model:
--   - a signed-in member may read only their own row, so the Website can
--     tell whether to show the Admin area (no row = not an admin);
--   - every admin action goes through the Website's server endpoint
--     (api/admin.ts), which re-checks this table with the service role on
--     every request. The browser never writes here.
--
-- After applying, add yourself (replace the email):
--   insert into portal.website_admins (user_id, email)
--   select id, email from auth.users where email = 'you@example.com'
--   on conflict (user_id) do nothing;

create table if not exists portal.website_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now()
);

alter table portal.website_admins enable row level security;

drop policy if exists "Website admins can read their own admin row" on portal.website_admins;
create policy "Website admins can read their own admin row"
  on portal.website_admins for select
  using (auth.uid() = user_id);

grant select on portal.website_admins to authenticated;
grant select, insert, update, delete on portal.website_admins to service_role;
