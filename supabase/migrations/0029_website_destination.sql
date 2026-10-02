-- 0029 — Activate the BGrowth Website publication destination.
--
-- The Website (bgrowth.app) reads the same `portal` schema as the Portal,
-- so everything published to the Portal is already live there. From now on
-- api/publishing-engine/publish.ts records a 'website' row in
-- product_destinations next to the 'portal' one on every publish (and
-- archive_product() already archives every destination row of a product).
--
-- Data only, no schema change: turn the destination on and backfill a
-- 'website' ledger row for every product that already has a 'portal' row.

update portal.publication_destinations
set is_active = true
where key = 'website';

insert into portal.product_destinations (
  product_id, destination_id, status, published_version, last_published_at, last_published_by
)
select pd.product_id, w.id, pd.status, pd.published_version, pd.last_published_at, pd.last_published_by
from portal.product_destinations pd
join portal.publication_destinations p on p.id = pd.destination_id and p.key = 'portal'
cross join (select id from portal.publication_destinations where key = 'website') w
on conflict (product_id, destination_id) do nothing;
