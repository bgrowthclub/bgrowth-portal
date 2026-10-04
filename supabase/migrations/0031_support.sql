-- 0031 — BGrowth Website Support Center.
--
-- A signed-in member talks to the BGrowth team from bgrowth.app: live chat
-- during support hours, a ticket (answered by e-mail too) outside them —
-- the same conversation either way. The team answers from the Website's
-- Admin → Support inbox.
--
-- Access model: RLS on, no policies. Every read and write goes through the
-- Website's server endpoints (api/support.ts for members, api/admin.ts for
-- the team), which use the service role and check who is asking. Nothing
-- here is readable or writable from the browser directly.

create table if not exists portal.support_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references portal.users(id) on delete cascade,
  subject text not null check (char_length(subject) between 1 and 200),
  status text not null default 'open' check (status in ('open', 'closed')),
  -- Who spoke last: 'customer' = waiting for the team, 'staff' = answered.
  last_sender text not null default 'customer' check (last_sender in ('customer', 'staff')),
  last_message_at timestamptz not null default now(),
  -- When the member last opened the conversation (unread replies = staff
  -- messages after this).
  customer_read_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists support_conversations_user_idx on portal.support_conversations (user_id, last_message_at desc);
create index if not exists support_conversations_inbox_idx on portal.support_conversations (status, last_sender, last_message_at desc);

create table if not exists portal.support_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references portal.support_conversations(id) on delete cascade,
  sender text not null check (sender in ('customer', 'staff')),
  author_id uuid references auth.users(id) on delete set null,
  author_name text,
  body text not null check (char_length(body) between 1 and 5000),
  created_at timestamptz not null default now()
);

create index if not exists support_messages_conversation_idx on portal.support_messages (conversation_id, created_at);

-- Small key/value settings the Website's Admin can edit (support hours
-- first). Public values only — read through the Website's endpoints.
create table if not exists portal.site_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by text
);

insert into portal.site_settings (key, value) values
  ('support_hours', '{"timezone": "America/Los_Angeles", "days": [1, 2, 3, 4, 5], "start": "09:00", "end": "18:00"}'::jsonb)
on conflict (key) do nothing;

alter table portal.support_conversations enable row level security;
alter table portal.support_messages enable row level security;
alter table portal.site_settings enable row level security;

grant select, insert, update, delete on portal.support_conversations to service_role;
grant select, insert, update, delete on portal.support_messages to service_role;
grant select, insert, update, delete on portal.site_settings to service_role;
