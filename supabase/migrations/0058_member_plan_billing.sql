-- 0058 — Plans & Subscriptions, step 2: selling (Website Sprint 122)
--
-- What each paid subscription costs and when it was cancelled, kept on
-- portal.member_plans so Admin → Plans → Subscribers can show the monthly
-- revenue and cancellations without asking the payment provider every time.
-- Written only by the Website's subscription webhook (api/webhooks/stripe.ts)
-- and api/account.ts (service role). Requires 0057. Additive only.

alter table portal.member_plans add column if not exists amount_cents int;
alter table portal.member_plans add column if not exists currency text;
alter table portal.member_plans add column if not exists canceled_at timestamptz;

create index if not exists member_plans_customer_idx on portal.member_plans (provider_customer_id);
