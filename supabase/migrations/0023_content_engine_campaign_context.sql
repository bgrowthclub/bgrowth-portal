-- BGrowth Content Engine — Phase 2B: campaign-level Audience, Language, and
-- Channels, distinct from Strategy (how the message is framed) and Goal
-- (what business outcome the campaign wants) already on this table.
--
-- Purely additive: every new column is nullable or has a safe default, so
-- every existing campaign row becomes audience=null, language=null,
-- channels='{}' and keeps working exactly as it did before this migration.
-- An empty `channels` array means "no campaign-level channel restriction"
-- at the application layer (see api/content-engine/campaigns.js and
-- src/modules/content-engine/views/CampaignDetailView.tsx) — it must never
-- be read as "this campaign cannot generate content."

alter table content_engine.campaigns
  add column if not exists audience text,
  add column if not exists language text,
  add column if not exists channels text[] not null default '{}';
