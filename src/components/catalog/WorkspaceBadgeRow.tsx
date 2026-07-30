import type { WorkspaceBadge, WorkspaceBadgeKind } from "@/lib/workspaceBadges";

const BADGE_STYLES: Record<WorkspaceBadgeKind, string> = {
  new: "bg-primary text-white",
  updated: "bg-teal-100 text-teal-700 dark:bg-teal-400/10 dark:text-teal-300",
  best_seller: "bg-amber-100 text-amber-700 dark:bg-amber-400/10 dark:text-amber-300",
  free: "bg-emerald-100 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300",
  membership: "bg-violet-100 text-violet-700 dark:bg-violet-400/10 dark:text-violet-300",
  trial_available: "bg-navy-50 text-navy-500 dark:bg-white/5 dark:text-white/50",
};

/** Shared badge-pill renderer for getWorkspaceBadges() output — reused by every Workspace card (Browse/Home's CatalogProductCard, every My Library card) so the visual language stays identical everywhere. */
export function WorkspaceBadgeRow({ badges, className = "" }: { badges: WorkspaceBadge[]; className?: string }) {
  if (badges.length === 0) return null;
  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      {badges.map((badge) => (
        <span key={badge.kind} className={`badge ${BADGE_STYLES[badge.kind]}`}>
          {badge.label}
        </span>
      ))}
    </div>
  );
}
