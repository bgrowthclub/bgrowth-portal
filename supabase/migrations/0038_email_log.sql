-- 0038 — A log of the automatic e-mails the Website sends, so Admin →
-- Dashboard can count them. Starts with the sign-up confirmation
-- reminders (api/cron/confirmation-reminders.ts: day 1 and day 3).
--
-- One row per e-mail sent. No e-mail address stored — only the account;
-- deleting the account deletes its rows.
-- Same access model as 0031/0036: RLS on, no policies, service role only.

create table if not exists portal.email_log (
  id bigint generated always as identity primary key,
  kind text not null,
  user_id uuid references auth.users(id) on delete cascade,
  sent_at timestamptz not null default now()
);

create index if not exists email_log_kind_sent_idx
  on portal.email_log (kind, sent_at desc);

alter table portal.email_log enable row level security;

revoke all on portal.email_log from anon, authenticated;
grant select, insert, delete on portal.email_log to service_role;
