-- 0039 — Account deletion requests (Website, Sprint 65).
--
-- A member asks to delete their account and data (Website Settings or the
-- Portal's Profile); the team reviews and completes it in the Website's
-- Admin → Deletions. Completing it deletes the auth user, which cascades
-- to portal.users, licenses, access grants, saved records, reviews and
-- support conversations; the newsletter subscription is deleted by the
-- endpoint. The request row stays as a record that a deletion happened,
-- with the name, e-mail and account link cleared.
--
-- Same access model as 0031/0036: RLS on, no policies, service role only
-- (api/account.ts for members, api/admin.ts for the team).

create table if not exists portal.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  email text,
  full_name text,
  reason text check (char_length(reason) <= 1000),
  source text not null default 'website'
    check (source in ('website', 'portal')),
  status text not null default 'pending'
    check (status in ('pending', 'cancelled', 'completed', 'rejected')),
  admin_note text,
  decided_by text,
  requested_at timestamptz not null default now(),
  decided_at timestamptz
);

-- One open request per member at a time.
create unique index if not exists account_deletion_one_pending
  on portal.account_deletion_requests (user_id)
  where status = 'pending';

create index if not exists account_deletion_status_idx
  on portal.account_deletion_requests (status, requested_at desc);

alter table portal.account_deletion_requests enable row level security;

revoke all on portal.account_deletion_requests from anon, authenticated;
grant select, insert, update, delete
  on portal.account_deletion_requests to service_role;
