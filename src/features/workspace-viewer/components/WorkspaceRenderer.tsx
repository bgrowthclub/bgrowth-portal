import { useEffect, useRef, useState } from "react";
import type { WorkspaceContent, WorkspaceData } from "@/types/workspaceContent";
import { applyWorkspaceTheme } from "@/lib/workspaceTheme";
import { useWorkspaceProgress } from "../hooks/useWorkspaceProgress";
import { WorkspaceAccordion } from "./WorkspaceAccordion";
import { WorkspaceCompletionPanel } from "./WorkspaceCompletionPanel";

interface WorkspaceRendererProps {
  content: WorkspaceContent;
  /** Optional persisted fill-in data (e.g. loaded from storage in a future increment). */
  initialData?: WorkspaceData;
}

/**
 * Renders any published Workspace JSON — the entire UI (sections, fields,
 * icons, brand color, progress) is derived from `content`. Nothing here
 * branches on a specific product; a new Workspace published from BGrowth
 * Studio renders correctly the moment its JSON lands in `products.content`.
 */
export function WorkspaceRenderer({ content, initialData }: WorkspaceRendererProps) {
  const [data, setData] = useState<WorkspaceData>(initialData ?? {});
  const [activeId, setActiveId] = useState(content.sections[0]?.id ?? "");
  const [hasReachedEnd, setHasReachedEnd] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const progress = useWorkspaceProgress(content, data);

  useEffect(() => {
    if (rootRef.current) applyWorkspaceTheme(content.brand.primaryColor, rootRef.current);
  }, [content.brand.primaryColor]);

  function handleSectionValueChange(sectionId: string, value: WorkspaceData[string]) {
    setData((prev) => ({ ...prev, [sectionId]: value }));
  }

  function handleContinue(sectionId: string) {
    const index = content.sections.findIndex((section) => section.id === sectionId);
    const next = content.sections[index + 1];
    setActiveId(next ? next.id : sectionId);
    if (next) {
      rootRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      setHasReachedEnd(true);
    }
  }

  return (
    <div ref={rootRef} className="flex flex-col gap-8">
      <div className="card flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-workspace-600 dark:text-workspace-300">
            {content.brand.companyLabel}
          </p>
          <h1 className="mt-1 text-xl font-bold text-navy-900 dark:text-white">{content.brand.name}</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="h-2 w-32 overflow-hidden rounded-full bg-navy-100 dark:bg-white/10">
            <div
              className="h-full rounded-full bg-workspace-500 transition-all duration-300"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
          <span className="text-sm font-semibold text-navy-700 dark:text-white/80">{progress.percent}%</span>
        </div>
      </div>

      {hasReachedEnd && (
        <WorkspaceCompletionPanel
          workspaceName={content.brand.name}
          onReviewSections={() => setHasReachedEnd(false)}
        />
      )}

      <WorkspaceAccordion
        content={content}
        data={data}
        activeId={activeId}
        onSelect={setActiveId}
        onContinue={handleContinue}
        onSectionValueChange={handleSectionValueChange}
        progressBySection={progress.sections}
      />

      <div className="no-print rounded-xl bg-navy-50 p-5 text-sm text-navy-500 dark:bg-white/5 dark:text-white/60">
        <p>
          <span className="font-semibold text-navy-700 dark:text-white/80">Pro tip: </span>
          {content.footer.proTip}
        </p>
        <p className="mt-2">
          {content.footer.helpText}{" "}
          {content.footer.helpUrl && (
            <a href={content.footer.helpUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-workspace-600 hover:underline dark:text-workspace-300">
              {content.footer.helpUrl}
            </a>
          )}
        </p>
      </div>
    </div>
  );
}
