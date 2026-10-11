-- File Library (BGrowth Studio → Files): every file BGrowth sells or uses
-- (PDFs, images) stored once and reused — sold alone, inside a kit or a
-- bundle, or as the base for an app (e.g. the Notary certificates).
--
-- The files live in a PRIVATE bucket: no public URL. The Studio's server
-- (service role) uploads, lists and hands out short-lived signed links;
-- buyers will get their download the same way once Downloads are sold
-- (next step). No browser reads this table or the bucket directly.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'library-files',
  'library-files',
  false,
  52428800, -- 50 MB
  array['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml']
)
on conflict (id) do nothing;

create table if not exists portal.library_files (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (char_length(btrim(name)) between 1 and 200),
  folder       text check (folder is null or char_length(btrim(folder)) between 1 and 80),
  storage_path text not null unique,
  mime_type    text not null,
  size_bytes   bigint not null default 0 check (size_bytes >= 0),
  checksum     text,                          -- sha256, to skip exact duplicates
  source       text not null default 'upload' check (source in ('upload', 'wix', 'link')),
  source_url   text,                          -- where it came from (Wix / link)
  created_by   text,                          -- admin e-mail
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists library_files_folder_idx on portal.library_files (folder);
create index if not exists library_files_checksum_idx on portal.library_files (checksum);

alter table portal.library_files enable row level security;
-- No policies: only the service role (Studio/site servers) reads or writes.

grant select, insert, update, delete on portal.library_files to service_role;
