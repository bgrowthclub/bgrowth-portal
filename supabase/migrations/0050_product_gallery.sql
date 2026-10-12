-- Product gallery (Studio → publish screens): up to 6 images and one short
-- video shown as a carousel on the product page, so people can see the
-- product inside before buying. Kept in its own column because
-- publish_product() rewrites products.metadata on every publish; the
-- publish endpoint sets it right after the RPC.
--
-- Shape: { "images": ["https://…", …], "video": { "kind": "link" | "file", "url": "https://…" } | null }
-- Files live in the public portal-product-assets bucket (gallery/…).

alter table portal.products
  add column if not exists gallery jsonb not null default '{}'::jsonb;
