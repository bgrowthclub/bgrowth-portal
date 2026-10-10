-- 0043 — E-mails from the "Inglês de Mudança" page.
--
-- A separate page (its own .vercel.app address, no BGrowth branding) asks
-- visitors for an e-mail to unlock the full course. Those e-mails land
-- here — a table of their own, not linked to BGrowth members.
--
-- The page uses the public anon key and can ONLY add a row: it can't read,
-- change or delete this table, and it can't see anything else. Reading the
-- list is done by the team (SQL editor / service role).

create table if not exists portal.ingles_leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  email text not null,
  name text,
  moving_when text,
  source text,
  constraint ingles_leads_email_format check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and length(email) <= 254),
  constraint ingles_leads_name_length check (name is null or length(name) <= 120),
  constraint ingles_leads_moving_when check (moving_when is null or moving_when in ('ja-moro', 'ate-3-meses', '3-12-meses', 'sem-data')),
  constraint ingles_leads_source_length check (source is null or length(source) <= 60)
);

-- One row per e-mail (the page treats a repeat as success).
create unique index if not exists ingles_leads_email_key on portal.ingles_leads (lower(email));

alter table portal.ingles_leads enable row level security;

drop policy if exists "Anyone can add an e-mail" on portal.ingles_leads;
create policy "Anyone can add an e-mail"
  on portal.ingles_leads for insert
  to anon, authenticated
  with check (true);

revoke all on portal.ingles_leads from anon, authenticated;
grant insert on portal.ingles_leads to anon, authenticated;
grant select, insert, update, delete on portal.ingles_leads to service_role;
