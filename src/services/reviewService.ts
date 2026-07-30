import { supabase } from "./supabaseClient";
import type { ReviewRow, ReviewCreatedFrom } from "@/types/database";

export interface ReviewSummary {
  averageRating: number;
  reviewCount: number;
}

export interface CreateReviewInput {
  userId: string;
  productId: string;
  rating: number;
  title: string;
  comment: string;
  displayName: string;
  createdFrom: ReviewCreatedFrom;
}

export interface UpdateReviewInput {
  rating: number;
  title: string;
  comment: string;
}

/**
 * Reviews belong to the product, not to any saved checklist instance (see
 * workspaceInstanceService) — one row per (user, product), enforced by a
 * unique constraint (supabase/migrations/0009_reviews.sql). Deliberately
 * standalone from LibraryWorkspaceCard/MarketplaceWorkspaceCard so it drops
 * into the future dedicated Product Page with no rework.
 */
export const reviewService = {
  async listForProduct(productId: string): Promise<ReviewRow[]> {
    const { data, error } = await supabase
      .from("reviews")
      .select("*")
      .eq("product_id", productId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  /**
   * Aggregate rating/count from the `product_review_summary` view — never
   * computed from a full review fetch, so a summary display scales
   * independently of how many reviews a product has.
   */
  async getSummary(productId: string): Promise<ReviewSummary> {
    const { data, error } = await supabase
      .from("product_review_summary")
      .select("average_rating, review_count")
      .eq("product_id", productId)
      .maybeSingle();
    if (error) throw error;
    return {
      averageRating: data?.average_rating ?? 0,
      reviewCount: data?.review_count ?? 0,
    };
  },

  /**
   * One query for every product id at once — My Library's dashboard rails
   * and "All Workspaces" grid both render a ReviewPromptCard per Workspace
   * card, so without this a member with hundreds of owned Workspaces would
   * fire hundreds of individual review lookups on every render.
   */
  async getForUserBatch(userId: string, productIds: string[]): Promise<ReviewRow[]> {
    if (productIds.length === 0) return [];
    const { data, error } = await supabase
      .from("reviews")
      .select("*")
      .eq("user_id", userId)
      .in("product_id", productIds);
    if (error) throw error;
    return data ?? [];
  },

  async create(input: CreateReviewInput): Promise<ReviewRow> {
    const { data, error } = await supabase
      .from("reviews")
      .insert({
        user_id: input.userId,
        product_id: input.productId,
        rating: input.rating,
        title: input.title,
        comment: input.comment,
        display_name: input.displayName,
        created_from: input.createdFrom,
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async update(reviewId: string, input: UpdateReviewInput): Promise<ReviewRow> {
    const { data, error } = await supabase
      .from("reviews")
      .update({ rating: input.rating, title: input.title, comment: input.comment, updated_at: new Date().toISOString() })
      .eq("id", reviewId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },
};
