-- Storage bucket for assets the Publishing Engine uploads (cover images
-- today; thumbnails/PDFs/social/marketplace images later — same bucket,
-- organized by path prefix, e.g. covers/{studio_product_id}/{timestamp}.png).
-- Public so the Portal can render images directly via their public URL.

insert into storage.buckets (id, name, public)
values ('product-assets', 'product-assets', true)
on conflict (id) do nothing;

-- Public buckets already serve objects via their public URL without an
-- auth check, but this policy documents the intent explicitly. Writes are
-- performed exclusively by the Publishing Engine's API route using the
-- service role key, which bypasses RLS — no insert/update/delete policy is
-- granted to anon/authenticated here.
create policy "Anyone can read product assets"
  on storage.objects for select
  using (bucket_id = 'product-assets');
