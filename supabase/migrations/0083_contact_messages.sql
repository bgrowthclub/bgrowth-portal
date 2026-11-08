-- 0083 — A visitor can reach us without an account (08/11/2026)
--
-- Until now the only way to talk to BGrowth was the Support Center, which
-- is behind the login. Someone deciding whether to buy — exactly the person
-- most worth answering — had no way to ask a question.
--
-- A separate table, not support_conversations: a conversation belongs to a
-- member (user_id, their own view of it, their unread marks). A stranger
-- has none of that, and bending the member table to hold people who are
-- not members would have cost more than one small table.
--
-- Nothing is stored beyond what the visitor typed and needs to be answered.
--
-- Additive: a new table, no existing object touched.

create table if not exists portal.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  subject text not null,
  message text not null,
  created_at timestamptz not null default now(),
  handled_at timestamptz,
  handled_by uuid,
  note text
);

comment on table portal.contact_messages is
  'Messages from visitors who have no account (the public /contact form). Answered by e-mail; marked handled in Admin → Support.';
comment on column portal.contact_messages.note is
  'What the team recorded when closing it — for the team, never shown to the sender.';

create index if not exists contact_messages_open_idx
  on portal.contact_messages (created_at desc)
  where handled_at is null;

alter table portal.contact_messages enable row level security;

-- No policy on purpose: it arrives through api/ingles.ts and is read in the
-- Admin area, both with the service role. A locked door, not a forgotten
-- one — these rows hold a stranger's name and e-mail address.
