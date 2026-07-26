import { Star } from "lucide-react";

interface StarRatingProps {
  rating: number;
  size?: "sm" | "md";
  className?: string;
}

const sizeClasses = { sm: "h-3.5 w-3.5", md: "h-5 w-5" };

/** Read-only star display — used anywhere a rating is shown, never edited. See StarRatingInput for the interactive sibling. */
export function StarRating({ rating, size = "sm", className = "" }: StarRatingProps) {
  const rounded = Math.round(rating);
  return (
    <div className={`flex items-center gap-0.5 ${className}`} role="img" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`${sizeClasses[size]} ${star <= rounded ? "fill-amber-400 text-amber-400" : "fill-none text-navy-200 dark:text-white/20"}`}
        />
      ))}
    </div>
  );
}
