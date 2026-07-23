export type WorkspaceStatusKind = "completed" | "progress" | "optional";

const STYLES: Record<WorkspaceStatusKind, string> = {
  completed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300",
  progress: "bg-workspace-50 text-workspace-700 dark:bg-workspace-500/10 dark:text-workspace-300",
  optional: "bg-navy-50 text-navy-500 dark:bg-white/5 dark:text-white/50",
};

export function WorkspaceStatusBadge({ kind, label }: { kind: WorkspaceStatusKind; label: string }) {
  return <span className={`badge ${STYLES[kind]}`}>{label}</span>;
}
