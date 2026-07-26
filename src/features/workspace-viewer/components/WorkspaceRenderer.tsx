import { useEffect, useRef, useState } from "react";
import type { WorkspaceContent, WorkspaceData } from "@/types/workspaceContent";
import { applyWorkspaceTheme } from "@/lib/workspaceTheme";
import { useWorkspaceProgress } from "../hooks/useWorkspaceProgress";
import { WorkspaceAccordion } from "./WorkspaceAccordion";
import { WorkspaceCompletionPanel } from "./WorkspaceCompletionPanel";
import { WorkspacePrintSummary } from "./WorkspacePrintSummary";
import { Button } from "@/components/ui/Button";

interface WorkspaceRendererProps {
  content: WorkspaceContent;
  /** Persisted fill-in data for a saved Workspace instance, if one is being opened. */
  initialData?: WorkspaceData;
  /** Present only when this render is backed by a saved instance — shows a Save Checklist button that persists the current field values. */
  onSave?: (data: WorkspaceData) => Promise<void>;
}

/**
 * Renders any published Workspace JSON — the entire UI (sections, fields,
 * icons, brand color, progress) is derived from `content`. Nothing here
 * branches on a specific product; a new Workspace published from BGrowth
 * Studio renders correctly the moment its JSON lands in `products.content`.
 */
export function WorkspaceRenderer({ content, initialData, onSave }: WorkspaceRendererProps) {
  const [data, setData] = useState<WorkspaceData>(initialData ?? {});
  const [activeId, setActiveId] = useState(content.sections[0]?.id ?? "");
  const [hasReachedEnd, setHasReachedEnd] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  // Distinct from isSaving/justSaved above (the manual "Save Checklist"
  // button) — this tracks the section-level "Save & Continue"/"Finish
  // Workspace" CTA's own save-then-advance, so the two controls never show
  // each other's loading/error state.
  const [isSectionSaving, setIsSectionSaving] = useState(false);
  const [sectionSaveError, setSectionSaveError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const progress = useWorkspaceProgress(content, data);

  useEffect(() => {
    if (rootRef.current) applyWorkspaceTheme(content.brand.primaryColor, rootRef.current);
  }, [content.brand.primaryColor]);

  function handleSectionValueChange(sectionId: string, value: WorkspaceData[string]) {
    setData((prev) => ({ ...prev, [sectionId]: value }));
  }

  function advance(sectionId: string) {
    const index = content.sections.findIndex((section) => section.id === sectionId);
    const next = content.sections[index + 1];
    setActiveId(next ? next.id : sectionId);
    if (next) {
      rootRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      setHasReachedEnd(true);
    }
  }

  /**
   * "Save & Continue" (and "Finish Workspace" on the last section — same
   * handler, advance() already treats "no next section" as finishing) must
   * actually match its label: save first, wait for it, and only move on
   * once that save succeeds. Without a saved instance to write to
   * (onSave undefined — the ordinary unsaved "Open Workspace" flow), there's
   * nothing to persist, so it just advances as before.
   */
  async function handleContinue(sectionId: string) {
    setSectionSaveError(null);
    if (!onSave) {
      advance(sectionId);
      return;
    }
    setIsSectionSaving(true);
    try {
      await onSave(data);
      advance(sectionId);
    } catch (err) {
      setSectionSaveError(err instanceof Error ? err.message : "Couldn't save your progress. Please try again.");
    } finally {
      setIsSectionSaving(false);
    }
  }

  async function handleSave() {
    if (!onSave) return;
    setIsSaving(true);
    setJustSaved(false);
    try {
      await onSave(data);
      setJustSaved(true);
      window.setTimeout(() => setJustSaved(false), 2500);
    } finally {
      setIsSaving(false);
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
          <div className="no-print flex items-center gap-2">
            {onSave && (
              <>
                <Button size="sm" onClick={handleSave} isLoading={isSaving}>
                  Save Checklist
                </Button>
                {justSaved && <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Saved ✓</span>}
              </>
            )}
            <Button size="sm" variant="secondary" onClick={() => window.print()}>
              Download PDF
            </Button>
          </div>
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
        isContinueSaving={isSectionSaving}
        continueError={sectionSaveError}
      />

      {/* Hidden on screen, shown only when printing — see .print-only in
          src/styles/index.css. The accordion above only ever renders one
          section's fields at a time, so this is what actually prints/exports
          to PDF: every section's values, together. */}
      <WorkspacePrintSummary content={content} data={data} />

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
