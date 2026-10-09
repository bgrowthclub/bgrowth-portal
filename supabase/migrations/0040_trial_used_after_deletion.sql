-- 0040 — Deleting an account doesn't give a new free trial.
--
-- When the team deletes an account that already used its free trial
-- (Website Admin → Deletions, migration 0039), the Website keeps only a
-- SHA-256 fingerprint of the lower-case e-mail here — the e-mail itself
-- can't be read back from it. A new account with that same e-mail starts
-- with has_used_trial = true, so the trial policy (0033) refuses a second
-- trial. Purchases and free Workspaces are not affected.
--
-- Service role only (RLS on, no policies); the trigger below runs as its
-- owner (security definer).

create table if not exists portal.trial_used_emails (
  email_hash text primary key,
  created_at timestamptz not null default now()
);

alter table portal.trial_used_emails enable row level security;
revoke all on portal.trial_used_emails from anon, authenticated;
grant select, insert, delete on portal.trial_used_emails to service_role;

create or replace function portal.mark_trial_used_on_signup()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if exists (
    select 1 from portal.trial_used_emails t
    where t.email_hash = encode(sha256(convert_to(lower(new.email), 'UTF8')), 'hex')
  ) then
    new.has_used_trial := true;
  end if;
  return new;
end;
$$;

drop trigger if exists portal_users_trial_used_on_signup on portal.users;
create trigger portal_users_trial_used_on_signup
  before insert on portal.users
  for each row execute procedure portal.mark_trial_used_on_signup();
