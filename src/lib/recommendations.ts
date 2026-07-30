import type { CatalogIndexRow } from "@/types/database";

/**
 * Everything a RecommendationSignal might need to score a candidate — built
 * once per Library render (see LibraryDashboardSections) and threaded
 * through every signal, so adding a new signal never means threading a new
 * prop through the component tree. `alreadyShownProductIds` is deliberately
 * a first-class part of the context (not left to each signal to derive):
 * "never recommend something already shown in Continue Working/Favorites/
 * Recent Purchases" is an architectural guarantee of rankRecommendations()
 * itself, not something every current or future signal has to remember to
 * respect independently.
 */
export interface RecommendationContext {
  /** Categories the member owns something in, ordered by which one they were most recently active in (most recent first) — today's "recent activity" signal. */
  ownedCategoryIdsByRecency: string[];
  /** Union of every product id already surfaced in Continue Working, Favorites, and Recent Purchases. */
  alreadyShownProductIds: Set<string>;
}

/**
 * One pluggable ranking factor. `score` returns roughly 0..1 so signals of
 * different shapes (a boolean-ish affinity, a normalized popularity count,
 * a 1-5 rating) combine predictably under `weight`. Adding a *future*
 * signal (favorites-based affinity, purchase-history similarity, usage
 * recency, an AI-scored relevance signal, etc.) is exactly one new entry
 * in `DEFAULT_RECOMMENDATION_SIGNALS` below — rankRecommendations(),
 * catalogService, and every component that calls this stay unchanged.
 */
export interface RecommendationSignal {
  name: string;
  weight: number;
  score: (candidate: CatalogIndexRow, context: RecommendationContext) => number;
}

function normalize(value: number, max: number): number {
  if (max <= 0) return 0;
  return Math.min(value / max, 1);
}

/** Today's primary signal — matches the member's owned categories, weighted toward whichever owned category they're most recently active in. */
export const categoryAffinitySignal: RecommendationSignal = {
  name: "category_affinity",
  weight: 3,
  score: (candidate, context) => {
    if (!candidate.category_id) return 0;
    const rank = context.ownedCategoryIdsByRecency.indexOf(candidate.category_id);
    if (rank === -1) return 0;
    return 1 / (rank + 1);
  },
};

/** The same "distinct members who ever held a license" signal Browse's own Popular sort uses (catalog_index.license_count) — see 0018_catalog_discovery.sql. */
export const popularitySignal: RecommendationSignal = {
  name: "popularity",
  // Capped generously — this repo is pre-launch, so real license_count
  // values are still small; revisit the cap once real traffic exists.
  weight: 1,
  score: (candidate) => normalize(candidate.license_count, 100),
};

/** catalog_index.avg_rating, already denormalized from portal.reviews. */
export const ratingSignal: RecommendationSignal = {
  name: "rating",
  weight: 1,
  score: (candidate) => (candidate.avg_rating != null ? candidate.avg_rating / 5 : 0),
};

/**
 * Today's active signal set for "Recommended For You." Extending this
 * (a favorites-affinity signal once cross-member favorite data exists, a
 * purchase-history signal, a usage-recency signal, an AI-scored signal) is
 * additive — append a RecommendationSignal here, nothing else changes.
 */
export const DEFAULT_RECOMMENDATION_SIGNALS: RecommendationSignal[] = [
  categoryAffinitySignal,
  popularitySignal,
  ratingSignal,
];

/**
 * Ranks a candidate pool (already fetched — see
 * catalogService.getRecommendedForCategories) by the weighted sum of every
 * signal's score, after unconditionally dropping anything in
 * `context.alreadyShownProductIds`. Candidates aren't pre-filtered by
 * ownership here — that's the caller's job (the SQL query already excludes
 * owned products) — this exclusion is specifically the "don't repeat what
 * Continue Working/Favorites/Recent Purchases already showed" guarantee.
 */
export function rankRecommendations(
  candidates: CatalogIndexRow[],
  context: RecommendationContext,
  signals: RecommendationSignal[] = DEFAULT_RECOMMENDATION_SIGNALS,
): CatalogIndexRow[] {
  return candidates
    .filter((candidate) => !context.alreadyShownProductIds.has(candidate.product_id))
    .map((candidate) => ({
      candidate,
      score: signals.reduce((sum, signal) => sum + signal.weight * signal.score(candidate, context), 0),
    }))
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.candidate);
}
