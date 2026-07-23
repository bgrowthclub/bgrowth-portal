-- BGrowth Portal — initial schema
-- Tables: workspace_categories, products, users, licenses

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- workspace_categories
-- ---------------------------------------------------------------------------
create table if not exists public.workspace_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.workspace_categories enable row level security;

create policy "Anyone can read workspace categories"
  on public.workspace_categories for select
  using (true);

-- ---------------------------------------------------------------------------
-- products
-- ---------------------------------------------------------------------------
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  short_description text not null,
  cover_image_url text,
  category_id uuid references public.workspace_categories(id) on delete set null,
  app_url text,
  is_trial_eligible boolean not null default true,
  is_published boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.products enable row level security;

create policy "Anyone can read published products"
  on public.products for select
  using (is_published = true);

-- ---------------------------------------------------------------------------
-- users (public profile row, 1:1 with auth.users)
-- ---------------------------------------------------------------------------
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  has_used_trial boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.users enable row level security;

create policy "Users can read their own profile"
  on public.users for select
  using (auth.uid() = id);

create policy "Users can update their own profile"
  on public.users for update
  using (auth.uid() = id);

-- Auto-create a public.users row whenever a new auth.users row is created,
-- so the client never has to (and never has permission to) insert one itself.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------------------------------------------------------------------------
-- licenses
-- ---------------------------------------------------------------------------
create table if not exists public.licenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  type text not null check (type in ('trial', 'purchased', 'lifetime')),
  status text not null default 'active' check (status in ('active', 'expired', 'revoked')),
  activated_at timestamptz not null default now(),
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

-- Enforced at the database level, not just in the client: a member may only
-- ever activate one trial license, full stop.
create unique index if not exists licenses_one_trial_per_user
  on public.licenses (user_id)
  where (type = 'trial');

alter table public.licenses enable row level security;

create policy "Users can read their own licenses"
  on public.licenses for select
  using (auth.uid() = user_id);

-- Only trial licenses may be self-service inserted by the client. Purchased/
-- lifetime licenses are created by a trusted backend process (e.g. a payment
-- webhook) once that flow exists — not by direct client insert.
create policy "Users can activate their own trial license"
  on public.licenses for insert
  with check (auth.uid() = user_id and type = 'trial');

create index if not exists licenses_user_id_idx on public.licenses (user_id);
create index if not exists licenses_product_id_idx on public.licenses (product_id);
