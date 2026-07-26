import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { Textarea } from "@/components/ui/Textarea";
import { StarRatingInput } from "@/components/ui/StarRatingInput";

export interface ReviewFormValues {
  rating: number;
  title: string;
  comment: string;
}

interface ReviewFormDialogProps {
  isOpen: boolean;
  dialogTitle: string;
  confirmLabel: string;
  initialValue?: ReviewFormValues;
  isSubmitting?: boolean;
  onSubmit: (values: ReviewFormValues) => void;
  onCancel: () => void;
}

/** Used both to write a first review and to edit an existing one — same three fields either way. */
export function ReviewFormDialog({
  isOpen,
  dialogTitle,
  confirmLabel,
  initialValue,
  isSubmitting,
  onSubmit,
  onCancel,
}: ReviewFormDialogProps) {
  const [rating, setRating] = useState(initialValue?.rating ?? 0);
  const [title, setTitle] = useState(initialValue?.title ?? "");
  const [comment, setComment] = useState(initialValue?.comment ?? "");

  if (!isOpen) return null;

  const canSubmit = rating > 0 && title.trim().length > 0 && comment.trim().length > 0;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;
    onSubmit({ rating, title: title.trim(), comment: comment.trim() });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="review-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/50 px-4 animate-fade-in"
      onClick={onCancel}
    >
      <form className="card w-full max-w-md p-6" onClick={(event) => event.stopPropagation()} onSubmit={handleSubmit}>
        <h2 id="review-dialog-title" className="text-lg font-bold text-navy-900 dark:text-white">
          {dialogTitle}
        </h2>
        <div className="mt-4 flex flex-col gap-4">
          <StarRatingInput value={rating} onChange={setRating} />
          <TextField
            label="Review title"
            value={title}
            placeholder="e.g. Very easy to use"
            onChange={(e) => setTitle(e.target.value)}
          />
          <Textarea
            label="Review comment"
            value={comment}
            rows={4}
            placeholder="What was your experience like?"
            onChange={(e) => setComment(e.target.value)}
          />
        </div>
        <div className="mt-6 flex gap-3">
          <Button type="button" variant="secondary" className="flex-1" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" className="flex-1" isLoading={isSubmitting} disabled={!canSubmit}>
            {confirmLabel}
          </Button>
        </div>
      </form>
    </div>
  );
}
