import { useState } from "react";
import { Star } from "lucide-react";

interface StarRatingInputProps {
  value: number;
  onChange: (rating: number) => void;
  label?: string;
}

/** Interactive 1-5 star picker — genuinely distinct from StarRating (owns hover/click state and an onChange), kept as a sibling rather than a "mode" on the read-only display. */
export function StarRatingInput({ value, onChange, label = "Rating" }: StarRatingInputProps) {
  const [hovered, setHovered] = useState<number | null>(null);
  const active = hovered ?? value;

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-navy-700 dark:text-white/80">{label}</span>
      <div className="flex items-center gap-1" onMouseLeave={() => setHovered(null)}>
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            aria-label={`${star} star${star > 1 ? "s" : ""}`}
            onMouseEnter={() => setHovered(star)}
            onClick={() => onChange(star)}
            className="p-0.5"
          >
            <Star
              className={`h-7 w-7 transition-colors ${star <= active ? "fill-amber-400 text-amber-400" : "fill-none text-navy-200 dark:text-white/20"}`}
            />
          </button>
        ))}
      </div>
    </div>
  );
}
