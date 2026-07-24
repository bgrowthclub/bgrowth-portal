-- BGrowth Portal — initial schema
-- Tables: workspace_categories, products, users, licenses
--
-- Lives in its own dedicated schema, `portal`, not `public` — this database
-- is shared with the existing BGrowth Academy LMS (lms_core_identity,
-- lms_course_engine, lms_enrollment_progress), which already has its own
-- `public.handle_new_user()` function. A dedicated schema is the only way
-- to guarantee zero collision with LMS objects regardless of what else
-- exists in `public` — matching the LMS's own convention of one schema per
-- bounded context, rather than fighting it.
--
-- This migration creates NEW objects only. It never drops, replaces, or
-- reads any existing LMS trigger, function, or table.

create extension if not exists "pgcrypto";

create schema if not exists portal;

-- ---------------------------------------------------------------------------
-- portal.workspace_categories
-- ---------------------------------------------------------------------------
create table if not exists portal.workspace_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table portal.workspace_categories enable row level security;

create policy "Anyone can read workspace categories"
  on portal.workspace_categories for select
  using (true);

-- ---------------------------------------------------------------------------
-- portal.products
-- ---------------------------------------------------------------------------
create table if not exists portal.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  short_description text not null,
  cover_image_url text,
  category_id uuid references portal.workspace_categories(id) on delete set null,
  app_url text,
  is_trial_eligible boolean not null default true,
  is_published boolean not null default true,
  created_at timestamptz not null default now()
);

alter table portal.products enable row level security;

create policy "Anyone can read published products"
  on portal.products for select
  using (is_published = true);

-- ---------------------------------------------------------------------------
-- portal.users (Portal-specific profile row, 1:1 with auth.users)
--
-- Deliberately separate from whatever the LMS's lms_core_identity schema
-- stores about the same auth.users row — different application, different
-- profile shape, same underlying member.
-- ---------------------------------------------------------------------------
create table if not exists portal.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  has_used_trial boolean not null default false,
  created_at timestamptz not null default now()
);

alter table portal.users enable row level security;

create policy "Users can read their own profile"
  on portal.users for select
  using (auth.uid() = id);

create policy "Users can update their own profile"
  on portal.users for update
  using (auth.uid() = id);

-- Auto-creates a portal.users row whenever a new auth.users row is created.
-- Uniquely named (function AND trigger) specifically so this coexists with
-- the LMS's own pre-existing public.handle_new_user() and whatever trigger
-- invokes it — this migration never touches either. Both triggers fire
-- independently on the same auth.users insert; each only ever writes to its
-- own schema's tables, so there's no ordering dependency between them.
--
-- search_path is empty and every reference is fully schema-qualified
-- (portal.users, not just users) — the safe pattern for a security definer
-- function, and it also means this function cannot accidentally resolve to
-- an LMS object of the same short name in some other schema.
create or replace function portal.handle_new_portal_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into portal.users (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name');
  return new;
end;
$$;

-- Safe to drop-if-exists here specifically because this exact name is one
-- this migration invented — it cannot be an LMS object.
drop trigger if exists on_auth_user_created_portal_profile on auth.users;
create trigger on_auth_user_created_portal_profile
  after insert on auth.users
  for each row execute procedure portal.handle_new_portal_user();

-- ---------------------------------------------------------------------------
-- portal.licenses
-- ---------------------------------------------------------------------------
create table if not exists portal.licenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references portal.users(id) on delete cascade,
  product_id uuid not null references portal.products(id) on delete cascade,
  type text not null check (type in ('trial', 'purchased', 'lifetime')),
  status text not null default 'active' check (status in ('active', 'expired', 'revoked')),
  activated_at timestamptz not null default now(),
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

-- Enforced at the database level, not just in the client: a member may only
-- ever activate one trial license, full stop.
create unique index if not exists licenses_one_trial_per_user
  on portal.licenses (user_id)
  where (type = 'trial');

alter table portal.licenses enable row level security;

create policy "Users can read their own licenses"
  on portal.licenses for select
  using (auth.uid() = user_id);

-- Only trial licenses may be self-service inserted by the client. Purchased/
-- lifetime licenses are created by a trusted backend process (e.g. a payment
-- webhook) once that flow exists — not by direct client insert.
create policy "Users can activate their own trial license"
  on portal.licenses for insert
  with check (auth.uid() = user_id and type = 'trial');

create index if not exists licenses_user_id_idx on portal.licenses (user_id);
create index if not exists licenses_product_id_idx on portal.licenses (product_id);
