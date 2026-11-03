-- 0076 — BGrowth Academy™ certificates (Website Sprint 191)
--
-- Decided 02/11/2026 with the owner. A student who finishes a course gets a
-- certificate: a row here, a PDF they print from their account, and a public
-- page anyone can open with the code to check it is real.
--
-- WHAT "FINISHED" MEANS (the owner's decision): every lesson ticked AND every
-- answerable question answered — right or wrong. There is no grade and no
-- passing mark, so a certificate says the person went through the course, not
-- that they scored well. The three kinds exist from the start so nothing has
-- to be migrated later, but only 'completion' and 'participation' are issued
-- today: 'achievement' means passing an assessment, and there is no
-- assessment yet. The Studio shows it disabled, with that reason.
--
-- WHY THE NAME AND COURSE ARE COPIED IN: a certificate is a statement about a
-- moment. If the member later changes their name, or the course is renamed or
-- rewritten, the certificate already issued must keep saying what it said when
-- it was issued. Reading those live would silently rewrite history.
--
-- PRIVACY: the public check returns the holder's name, the course, the date
-- and whether it is still valid — the same things printed on the certificate
-- the asker is holding, so it reveals nothing they do not already have. The
-- code is what must not be guessable: 8 characters from a 31-letter alphabet
-- with no confusable pairs (no O/0, I/1), about 8.5e11 combinations, random,
-- and the page is noindex. Nothing else about the member is exposed, and the
-- table itself is never readable from a browser.
--
-- Requires: portal.products (courses), auth.users. Additive.

create table if not exists portal.certificates (
  id uuid primary key default gen_random_uuid(),
  -- Printed on the certificate and used to check it: BG-XXXXXXXX.
  code text not null unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references portal.products(id) on delete cascade,
  kind text not null default 'completion'
    check (kind in ('completion', 'achievement', 'participation')),
  -- Copied at issue, on purpose — see the note above.
  student_name text not null,
  course_name text not null,
  hours int check (hours is null or (hours > 0 and hours <= 999)),
  issued_at timestamptz not null default now(),
  -- A certificate is never deleted: withdrawing one is recorded, so the
  -- public check can say it was withdrawn instead of "never existed".
  revoked_at timestamptz,
  revoked_reason text
);

-- One certificate per student per course. Finishing again re-reads the same
-- row rather than handing out a second number for the same thing.
create unique index if not exists certificates_user_product_idx
  on portal.certificates (user_id, product_id);
create index if not exists certificates_user_issued_idx
  on portal.certificates (user_id, issued_at desc);

alter table portal.certificates enable row level security;

-- The holder sees their own. Everyone else goes through the function below;
-- writes are the site's server (service role) only.
drop policy if exists certificates_own_read on portal.certificates;
create policy certificates_own_read on portal.certificates
  for select
  using (auth.uid() = user_id);

-- A code with no character that can be read as another one.
create or replace function portal.new_certificate_code()
returns text
language plpgsql
volatile
as $$
declare
  alphabet constant text := '23456789ABCDEFGHJKLMNPQRSTUVWXY';
  candidate text;
  i int;
begin
  loop
    candidate := '';
    for i in 1..8 loop
      candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    candidate := 'BG-' || candidate;
    exit when not exists (select 1 from portal.certificates c where c.code = candidate);
  end loop;
  return candidate;
end;
$$;

-- The public check. Takes a code, returns only what the certificate itself
-- already shows the person asking. Unknown code returns no row — it never
-- says whether a code "exists but is hidden", because there is no such state.
create or replace function portal.verify_certificate(p_code text)
returns table (
  code text,
  student_name text,
  course_name text,
  kind text,
  hours int,
  issued_at timestamptz,
  revoked boolean
)
language sql
stable
security definer
set search_path = portal, public
as $$
  select c.code, c.student_name, c.course_name, c.kind, c.hours, c.issued_at,
         c.revoked_at is not null
  from portal.certificates c
  where upper(btrim(p_code)) = c.code
  limit 1;
$$;

revoke all on function portal.verify_certificate(text) from public;
grant execute on function portal.verify_certificate(text) to anon, authenticated, service_role;
grant execute on function portal.new_certificate_code() to service_role;
