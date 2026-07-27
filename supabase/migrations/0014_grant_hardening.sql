-- Production-readiness audit finding: RLS policies gate which ROWS a query
-- can touch, but Postgres never restricts which COLUMNS an allowed UPDATE
-- can change unless the grant itself is column-scoped. Two tables had
-- blanket `grant update on <table> to authenticated` with no column
-- restriction, relying on RLS's `auth.uid() = user_id` alone — which only
-- proves "this is my row," not "these are the fields I'm allowed to touch."

-- portal.users: nothing in the application ever updates this table at all
-- (confirmed by search — every call site is a read). The grant existed
-- with no legitimate use, and let any member reset their own
-- has_used_trial back to false via a direct client call, undoing the "one
-- free trial per member, ever" rule from 0013. Revoked outright rather
-- than column-restricted, since there's no current self-service use case
-- to preserve.
revoke update on portal.users from authenticated;

-- portal.reviews: reviewService.update() only ever sets rating/title/
-- comment/updated_at (see src/services/reviewService.ts), but the blanket
-- grant also let a client directly rewrite product_id (reattaching a
-- review to a Workspace never actually held), display_name, or
-- created_from — undermining reviews as public social proof. Restricted to
-- exactly the columns the real update path uses.
revoke update on portal.reviews from authenticated;
grant update (rating, title, comment, updated_at) on portal.reviews to authenticated;
