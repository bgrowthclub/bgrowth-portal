import { useState } from "react";
import { reviewService } from "@/services/reviewService";
import type { ReviewCreatedFrom, ReviewRow } from "@/types/database";
import { StarRating } from "@/components/ui/StarRating";
import { ReviewFormDialog, type ReviewFormValues } from "./ReviewFormDialog";

interface ReviewPromptCardProps {
  userId: string;
  productId: string;
  displayName: string;
  /** Why this member is eligible right now — recorded on the review at creation, never changed by an edit. */
  createdFrom: ReviewCreatedFrom;
  /**
   * This member's existing review for this product, if any — fetched once
   * by the caller for every eligible product in a single batched query (see
   * reviewService.getForUserBatch), never by this component itself. `undefined`
   * means the batch fetch hasn't resolved yet (renders nothing, same as the
   * old per-card loading state); `null` means it resolved and no review exists.
   */
  review: ReviewRow | null | undefined;
}

/**
 * The Trial-journey review prompt — rendered by LibraryWorkspaceCard
 * alongside Buy Now once a trial has expired, or once a Workspace is
 * purchased, for a member who hasn't reviewed it yet. Never shown during
 * an active trial (the caller only renders this for the expired/purchased
 * branches). Once submitted, the write-prompt is gone for this visit —
 * only a compact "Edit review" line remains from then on.
 */
export function ReviewPromptCard({ userId, productId, displayName, createdFrom, review }: ReviewPromptCardProps) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [justSubmitted, setJustSubmitted] = useState(false);

  async function handleSubmit(values: ReviewFormValues) {
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      if (review) {
        await reviewService.update(review.id, values);
      } else {
        await reviewService.create({ userId, productId, displayName, createdFrom, ...values });
      }
      setIsFormOpen(false);
      setJustSubmitted(true);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Couldn't save your review. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  // Optional feature, same as Saved Checklists — while the caller's batched
  // lookup hasn't resolved yet (or failed), show nothing rather than assert
  // a state we don't actually know.
  if (review === undefined) return null;

  if (justSubmitted) {
    return <p className="text-sm font-medium text-primary">Thank you for your feedback!</p>;
  }

  if (review) {
    return (
      <>
        <div className="flex items-center gap-2">
          <StarRating rating={review.rating} />
          <button
            type="button"
            onClick={() => setIsFormOpen(true)}
            className="text-sm font-semibold text-primary hover:underline"
          >
            Edit review
          </button>
        </div>
        <ReviewFormDialog
          isOpen={isFormOpen}
          dialogTitle="Edit your review"
          confirmLabel="Save Changes"
          initialValue={{ rating: review.rating, title: review.title, comment: review.comment }}
          isSubmitting={isSubmitting}
          onSubmit={handleSubmit}
          onCancel={() => setIsFormOpen(false)}
        />
      </>
    );
  }

  return (
    <div className="rounded-xl border border-navy-100/60 bg-navy-50/50 p-3 dark:border-white/10 dark:bg-white/5">
      <p className="text-sm font-medium text-navy-700 dark:text-white/80">How was your experience?</p>
      {submitError && <p className="mt-1 text-xs text-red-500">{submitError}</p>}
      <button
        type="button"
        onClick={() => setIsFormOpen(true)}
        className="mt-2 text-sm font-semibold text-primary hover:underline"
      >
        Write a Review
      </button>
      <ReviewFormDialog
        isOpen={isFormOpen}
        dialogTitle="Write a review"
        confirmLabel="Submit Review"
        isSubmitting={isSubmitting}
        onSubmit={handleSubmit}
        onCancel={() => setIsFormOpen(false)}
      />
    </div>
  );
}
