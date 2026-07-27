import { Sparkles, Gift, Zap, FileText } from "lucide-react";
import type { ProductRow } from "@/types/database";

interface ProductTrustBadgesProps {
  product: Pick<ProductRow, "is_trial_eligible">;
}

/** Universal reassurance badges, not Studio-authored content — "Trial Available" is the only one conditioned on product data. */
export function ProductTrustBadges({ product }: ProductTrustBadgesProps) {
  const badges = [
    { icon: Sparkles, label: "Interactive Workspace", show: true },
    { icon: Gift, label: "Trial Available", show: product.is_trial_eligible },
    { icon: Zap, label: "Instant Access", show: true },
    { icon: FileText, label: "Digital Product", show: true },
  ].filter((badge) => badge.show);

  return (
    <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-3 px-6 py-8">
      {badges.map(({ icon: Icon, label }) => (
        <span key={label} className="badge bg-navy-50 text-navy-600 dark:bg-white/5 dark:text-white/70">
          <Icon className="h-3.5 w-3.5" />
          {label}
        </span>
      ))}
    </div>
  );
}
