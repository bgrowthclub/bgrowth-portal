-- Fixes a real bug: licenseService.hasUsedTrial() counted rows where
-- licenses.type = 'trial' — but portal.grant_purchased_license()
-- (0012_purchase_licenses.sql) upgrades an existing trial license's `type`
-- to 'purchased' in place on purchase. Once that upgrade happens, the
-- member's one-and-only trial row no longer has type = 'trial', so the
-- count silently drops to zero and they'd be allowed to activate a SECOND
-- free trial for a different Workspace — defeating "one trial per member,
-- ever" both client-side and at the database's own partial unique index
-- (which is also keyed on type = 'trial' for the same reason).
--
-- portal.users.has_used_trial already existed for exactly this (added in
-- 0001_init.sql, never wired up) — an immutable-once-true flag, independent
-- of what a license's `type` later becomes. Set it via a trigger, not
-- application code, so it can never desync from reality regardless of
-- which code path inserts a trial license.

create or replace function portal.mark_trial_used()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  if new.type = 'trial' then
    update portal.users set has_used_trial = true where id = new.user_id;
  end if;
  return new;
end;
$$;

drop trigger if exists licenses_mark_trial_used on portal.licenses;
create trigger licenses_mark_trial_used
  after insert on portal.licenses
  for each row execute procedure portal.mark_trial_used();

-- Backfill for any trial license already sitting in the table today. Note
-- this cannot recover a trial that was already upgraded to 'purchased'
-- before this migration runs — that history isn't recorded anywhere. Not a
-- concern in practice: Stripe isn't live yet (see api/webhooks/stripe.ts),
-- so no real purchase has ever gone through grant_purchased_license().
update portal.users u
set has_used_trial = true
where exists (
  select 1 from portal.licenses l where l.user_id = u.id and l.type = 'trial'
);
