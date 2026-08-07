-- BGrowth Content Engine — Phase 2C: platform_rules, a small, extensible
-- library of platform-specific generation guidance (tone, structure,
-- do's/don'ts) — the platform equivalent of content_strategies
-- (0020_content_engine_schema.sql). One row per supported platform, read
-- alongside Brand Profile/Strategy/Goal/Audience when composing a
-- generation prompt (see api/_lib/contentEngine/promptBuilder.js). guidance
-- is a plain text block, not further structured, since it's consumed as
-- one piece of the composed prompt, never parsed — same convention as
-- content_strategies.prompt_guidance.
--
-- Purely additive: no existing table/column changes. A content item
-- generated before this table existed, or for a platform with no row here
-- yet, keeps working exactly as before — generate.js's platform_rules
-- lookup is optional and falls back to no platform guidance, never an
-- error (required for backward compatibility and future platforms).

create table if not exists content_engine.platform_rules (
  platform text primary key,
  guidance text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table content_engine.platform_rules enable row level security;
-- No anon/authenticated policy — read and write only through
-- bgrowth-studio's service-role-gated Content Engine API routes, same
-- posture as brand_profile/content_strategies/campaigns/content_items.

insert into content_engine.platform_rules (platform, guidance) values
  (
    'instagram',
    'Mobile-first. Strong opening hook. Concise, scannable copy. Natural conversational language. Captions should provide useful value before promotion. CTA should be clear but not overly aggressive. Hashtags should be relevant and specific, not generic hashtag stuffing. Carousel copy should keep each slide focused on one idea. Avoid unnecessary repetition.'
  ),
  (
    'facebook',
    'Conversational and community-oriented. Can support slightly longer explanatory copy than Instagram. Opening should still earn attention quickly. Encourage useful discussion when appropriate. CTA should feel natural in the context of the post. Avoid engagement bait. Avoid excessive hashtags. Prioritize clarity and usefulness.'
  ),
  (
    'tiktok',
    'Hook must capture attention immediately. Optimize scripts for short-form vertical video. Spoken language should sound natural, not like an article being read. Use short scenes and clear pacing. Prioritize one central idea per video. Visual direction should support the spoken message. CTA should be short and natural. Avoid long introductions.'
  )
on conflict (platform) do nothing;

grant select, insert, update, delete on content_engine.platform_rules to service_role;
