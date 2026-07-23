import type { ReactNode } from "react";
import { Check, ChevronDown } from "lucide-react";
import { WorkspaceStatusBadge, type WorkspaceStatusKind } from "./WorkspaceStatusBadge";

interface WorkspaceSectionSummaryRowProps {
  number: number;
  icon: ReactNode;
  title: string;
  description: string;
  statusLabel: string;
  statusKind: WorkspaceStatusKind;
  isCompleted: boolean;
  onClick: () => void;
}

export function WorkspaceSectionSummaryRow({
  number,
  icon,
  title,
  description,
  statusLabel,
  statusKind,
  isCompleted,
  onClick,
}: WorkspaceSectionSummaryRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="card flex w-full items-center gap-4 p-4 text-left transition-shadow duration-150 hover:shadow-soft-lg sm:p-5"
    >
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
          isCompleted ? "bg-emerald-500 text-white" : "bg-navy-100 text-navy-500 dark:bg-white/10 dark:text-white/50"
        }`}
      >
        {isCompleted ? <Check className="h-4 w-4" strokeWidth={3} /> : number}
      </span>

      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-workspace-50 text-workspace-600 dark:bg-workspace-500/10 dark:text-workspace-300 [&>svg]:h-[18px] [&>svg]:w-[18px]">
        {icon}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold text-navy-800 dark:text-white">
          {number}. {title}
        </span>
        <span className="block truncate text-[13px] text-navy-400 dark:text-white/40">{description}</span>
      </span>

      <span className="hidden shrink-0 sm:block">
        <WorkspaceStatusBadge kind={statusKind} label={statusLabel} />
      </span>

      <ChevronDown className="h-[18px] w-[18px] shrink-0 text-navy-300 dark:text-white/30" />
    </button>
  );
}
