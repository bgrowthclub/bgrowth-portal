-- Adds the Workspace JSON column that BGrowth Studio publishes into.
-- A product becomes renderable in the Portal the moment this column is
-- populated — no Portal schema or code change needed per product.

alter table portal.products
  add column if not exists content jsonb;

comment on column portal.products.content is
  'Workspace JSON published from BGrowth Studio (matches bgrowth-studio''s ChecklistConfig shape — see src/types/workspaceContent.ts). Null until Studio has published content for this product.';
