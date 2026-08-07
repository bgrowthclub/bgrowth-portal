-- BGrowth Content Engine — Phase 2D: Content Variations. A variation is an
-- alternate execution of an existing content_item (same campaign, same
-- platform, same content_type — see api/content-engine/generate.js) —
-- always a brand-new content_items row, never an update to the source.
--
-- Purely additive: both new columns are nullable, so every existing row
-- becomes parent_content_item_id=null, variation_label=null — correctly
-- "not a variation," with zero backfill needed.

alter table content_engine.content_items
  add column if not exists parent_content_item_id uuid references content_engine.content_items(id) on delete set null,
  add column if not exists variation_label text;

-- ON DELETE SET NULL (not CASCADE): deleting an original must never destroy
-- a variation an admin has already reviewed/approved — it simply becomes a
-- standalone item afterward, exactly like any other content_items row.

create index if not exists content_items_parent_content_item_id_idx
  on content_engine.content_items (parent_content_item_id);

-- Note: provider_task_config's task_type='variation' row was verified live
-- in production to already hold model='gemini-3.6-flash' — correct, no
-- longer the gemini-2.0-flash value originally seeded in
-- 0020_content_engine_schema.sql. No provider_task_config change belongs in
-- this migration. (Also moot either way for Phase 2D specifically: variation
-- generation reuses the source content_type's own task routing, not this
-- task_type — see generate.js's routing comment.)
