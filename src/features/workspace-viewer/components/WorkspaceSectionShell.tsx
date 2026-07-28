import { useEffect, useRef, type ReactNode } from "react";
import { Star, Info, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface WorkspaceSectionShellProps {
  number: number;
  totalSteps: number;
  icon: ReactNode;
  title: string;
  description: string;
  whyItMatters?: string;
  tip?: string;
  children: ReactNode;
  isLast: boolean;
  onContinue: () => void;
  /** Whether onContinue's save is currently in flight — disables the button and shows a loading state instead of navigating early. */
  isSaving: boolean;
  /** Set when that save fails — the member stays on this section until it succeeds. */
  saveError: string | null;
}

export function WorkspaceSectionShell({
  number,
  totalSteps,
  icon,
  title,
  description,
  whyItMatters,
  tip,
  children,
  isLast,
  onContinue,
  isSaving,
  saveError,
}: WorkspaceSectionShellProps) {
  // TEMPORARY DIAGNOSTIC — instrumenting the "Save & Continue" insertBefore
  // crash now that duplicate section/field/item ids have been ruled out
  // (Studio's Template Integrity Validator reports this template clean).
  // instanceId marks each React instance uniquely so overlapping mount/
  // unmount logs (e.g. two instances alive at once, which would itself be
  // a strong signal of a reconciliation bug) are distinguishable in the
  // console. Remove once the root cause is found and fixed.
  const instanceId = useRef(Math.random().toString(36).slice(2, 8));
  useEffect(() => {
    const id = instanceId.current;
    console.log("[WORKSPACE DIAGNOSTIC] WorkspaceSectionShell MOUNT", {
      instanceId: id,
      number,
      title,
      isLast,
    });
    return () => {
      console.log("[WORKSPACE DIAGNOSTIC] WorkspaceSectionShell UNMOUNT", {
        instanceId: id,
        number,
        title,
        isLast,
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="card p-5 sm:p-7">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-workspace-50 text-workspace-600 dark:bg-workspace-500/10 dark:text-workspace-300 [&>svg]:h-6 [&>svg]:w-6">
            {icon}
          </span>
          <div>
            <span className="inline-block rounded-full bg-workspace-500 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white">
              Step {number} of {totalSteps}
            </span>
            <h2 className="mt-2 text-xl font-bold text-navy-900 dark:text-white sm:text-[22px]">{title}</h2>
            <p className="mt-1 text-sm text-navy-400 dark:text-white/50">{description}</p>
          </div>
        </div>

        {whyItMatters && (
          <div className="no-print w-full shrink-0 rounded-xl border border-workspace-100 bg-workspace-50 p-4 dark:border-workspace-500/20 dark:bg-workspace-500/10 sm:w-72">
            <p className="mb-1 flex items-center gap-1.5 text-[13px] font-semibold text-workspace-700 dark:text-workspace-300">
              <Star className="h-3.5 w-3.5 fill-workspace-500 text-workspace-500" />
              Why this matters
            </p>
            <p className="text-xs leading-relaxed text-navy-500 dark:text-white/60">{whyItMatters}</p>
          </div>
        )}
      </div>

      <div className="mt-6">{children}</div>

      {tip && (
        <div className="no-print mt-5 flex items-start gap-2.5 rounded-xl bg-navy-50 px-4 py-3.5 dark:bg-white/5">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-workspace-500" />
          <p className="text-[13px] text-navy-500 dark:text-white/60">
            <span className="font-semibold text-navy-700 dark:text-white/80">Tip: </span>
            {tip}
          </p>
        </div>
      )}

      <div className="no-print mt-6 flex flex-col items-end gap-2">
        {saveError && (
          <p role="alert" className="text-sm font-medium text-red-500">
            {saveError}
          </p>
        )}
        <Button onClick={onContinue} isLoading={isSaving} className="!bg-workspace-500 hover:!bg-workspace-600">
          {isLast ? "Finish Workspace" : "Save & Continue"}
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
