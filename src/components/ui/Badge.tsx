import type { WorkspaceAccessState } from "@/types/workspace";

const STYLES: Record<WorkspaceAccessState, string> = {
  unlocked: "bg-primary/10 text-primary",
  trial: "bg-amber-100 text-amber-700 dark:bg-amber-400/10 dark:text-amber-300",
  purchased: "bg-emerald-100 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300",
  locked: "bg-navy-50 text-navy-500 dark:bg-white/5 dark:text-white/50",
  expired: "bg-red-100 text-red-700 dark:bg-red-400/10 dark:text-red-300",
};

const LABELS: Record<WorkspaceAccessState, string> = {
  unlocked: "Unlocked",
  trial: "Trial",
  purchased: "Purchased",
  locked: "Locked",
  expired: "Expired",
};

export function AccessStateBadge({ state }: { state: WorkspaceAccessState }) {
  return <span className={`badge ${STYLES[state]}`}>{LABELS[state]}</span>;
}
