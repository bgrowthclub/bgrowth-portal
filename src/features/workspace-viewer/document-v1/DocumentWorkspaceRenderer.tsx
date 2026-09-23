import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Printer, Download, RotateCcw } from "lucide-react";
import type { WorkspaceContent, WorkspaceData } from "@/types/workspaceContent";
import { applyWorkspaceTheme } from "@/lib/workspaceTheme";
import { downloadElementAsPdf } from "@/lib/pdf";
import { useWorkspaceProgress } from "../hooks/useWorkspaceProgress";
import { WorkspaceAccordion } from "../components/WorkspaceAccordion";
import { WorkspaceCompletionPanel } from "../components/WorkspaceCompletionPanel";
import { WorkspaceRuntimeErrorBoundary } from "../components/WorkspaceRuntimeErrorBoundary";
import { DocumentPrintSummary } from "./DocumentPrintSummary";
import { Button } from "@/components/ui/Button";
import { Menu } from "@/components/ui/Menu";

interface DocumentWorkspaceRendererProps {
  content: WorkspaceContent;
  initialData?: WorkspaceData;
  onSave?: (data: WorkspaceData) => Promise<void>;
  instanceLabel?: string;
}

/**
 * Document V1 — the Workspace Viewer's real rendering path (see
 * WorkspaceViewerPage.tsx). Takes the exact same inputs the legacy
 * WorkspaceRenderer did (content, initialData, onSave, instanceLabel), so
 * this was a drop-in swap at that one call site. Still also used by
 * DocumentV1PreviewPage.tsx (the dev-only `/dev/document-v1-preview`
 * route) for isolated testing against fixture data — same component,
 * different caller.
 *
 * The interactive fill UI reuses the existing, unmodified WorkspaceAccordion
 * — the structural PDF/print problems this replaced were in the print
 * layer only, not the on-screen fill experience, so this still only
 * replaces the print/document layer (DocumentPrintSummary), never the
 * interactive editing surface, the save/progress logic, or persisted data.
 */
export function DocumentWorkspaceRenderer({ content, initialData, onSave, instanceLabel }: DocumentWorkspaceRendererProps) {
  const [data, setData] = useState<WorkspaceData>(initialData ?? {});
  const [activeId, setActiveId] = useState(content.sections[0]?.id ?? "");
  const [hasReachedEnd, setHasReachedEnd] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [isSectionSaving, setIsSectionSaving] = useState(false);
  const [sectionSaveError, setSectionSaveError] = useState<string | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  // True only for the brief window a blank print/PDF is being captured —
  // DocumentPrintSummary always renders `isBlankPrintPending ? {} : data`
  // (derived, never a stored snapshot) so there is no copy of `data` that
  // could drift from it; see handlePrintBlank/handleDownloadBlankPdf.
  const [isBlankPrintPending, setIsBlankPrintPending] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const printableRef = useRef<HTMLDivElement>(null);

  const progress = useWorkspaceProgress(content, data);
  const printData = isBlankPrintPending ? {} : data;

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

  function handleReset() {
    if (!window.confirm("Reset this Workspace? Any unsaved changes will be cleared.")) return;
    setData(initialData ?? {});
  }

  function handlePrintFilled() {
    window.print();
  }

  /**
   * `window.print()`'s own completion isn't reliably synchronous across
   * browsers, so reverting `isBlankPrintPending` can't happen right after
   * calling it — `afterprint` is the standard, correct signal that the
   * print dialog has actually been dismissed, in either browser's timing.
   */
  function handlePrintBlank() {
    flushSync(() => setIsBlankPrintPending(true));
    const revert = () => {
      setIsBlankPrintPending(false);
      window.removeEventListener("afterprint", revert);
    };
    window.addEventListener("afterprint", revert);
    window.print();
  }

  /**
   * Same downloadElementAsPdf helper the legacy renderer uses (src/lib/pdf.ts) — only the
   * target element differs (DocumentPrintSummary instead of WorkspacePrintSummary) — plus two
   * opt-in options the legacy renderer does NOT pass (it keeps the helper's unchanged defaults):
   *
   * - `pagebreakMode: ["css", "legacy"]` — with `avoid-all` on (the default), html2pdf relocates
   *   any whole element under one page tall that straddles a page boundary, regardless of this
   *   component's own `break-inside: avoid` styles — which is what stranded a checklist section
   *   on a near-empty trailing page during multi-scenario testing. Dropping `avoid-all` here
   *   makes only the elements DocumentPrintSummary explicitly marks non-splittable actually
   *   non-splittable, matching how a real browser Print of the same content already paginates it.
   *
   * - `margin: [5, 10, 5, 10]` — the one option that actually controls usable page height (see
   *   the margin doc comment in pdf.ts). The default `[10, 12, 10, 12]` left html2pdf computing
   *   roughly one text line less page height than a real browser Print computes for identical
   *   content, which is what stranded "Continue Your Journey" on a near-empty trailing page in
   *   the long-content scenario even after the pagebreakMode fix. Confirmed empirically (see the
   *   PDF/Print unification report) that only the top/bottom values move the actual page-break
   *   point — left/right margin has no measurable effect on pagination, since html2pdf's
   *   pxPageHeight is driven by top+bottom alone — and that 5mm is the practical floor: testing
   *   down to 3mm produced byte-identical page breaks to 5mm on every fixture tried, so 5mm keeps
   *   the largest margin that still buys the full available improvement (still ≈0.2in, printable
   *   on real hardware) rather than shaving margin with no further pagination benefit. This
   *   packs each page as full as the content allows; a short final page can still occur when the
   *   total content is genuinely a little over N pages — see this file's still-true note above
   *   about html2pdf's own page-height accounting gap versus a real browser Print — but it no
   *   longer leaves genuine, avoidable empty room at the bottom of the page before it.
   */
  async function downloadCurrentlyRenderedPdf(filenameSuffix: string) {
    if (!printableRef.current) return;
    setIsGeneratingPdf(true);
    try {
      const filenameBase = `${content.brand.name.replace(/\s+/g, "-")}-${(instanceLabel ?? "").replace(/\s+/g, "-") || "Workspace"}`;
      await downloadElementAsPdf(printableRef.current, `${filenameBase}${filenameSuffix}.pdf`, {
        pagebreakMode: ["css", "legacy"],
        margin: [5, 10, 5, 10],
      });
    } finally {
      setIsGeneratingPdf(false);
    }
  }

  function handleDownloadFilledPdf() {
    void downloadCurrentlyRenderedPdf("");
  }

  /**
   * Awaiting downloadElementAsPdf (unlike window.print()) means the whole
   * html2canvas capture + jsPDF save completes before this function
   * returns, so reverting isBlankPrintPending in `finally` is safe here —
   * no equivalent to print's afterprint-timing problem.
   */
  async function handleDownloadBlankPdf() {
    flushSync(() => setIsBlankPrintPending(true));
    try {
      await downloadCurrentlyRenderedPdf("-Blank");
    } finally {
      setIsBlankPrintPending(false);
    }
  }

  return (
    <div ref={rootRef} className="flex flex-col gap-8">
      {/* Everything in this no-print wrapper is interactive-screen chrome — the
          whole point of Document V1 is a print/PDF layer that's a separate
          concern from the on-screen fill UI (see DocumentPrintSummary.tsx's
          own doc comment). Without this wrapper, a real `window.print()`
          would print this card + the accordion IN ADDITION to the actual
          document (which renders after them via .printable-summary-container)
          — confirmed by testing Browser Print on the preview before this
          wrapper was added. */}
      <div className="no-print flex flex-col gap-8">
        <div className="card flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-workspace-600 dark:text-workspace-300">
              {content.brand.companyLabel}
            </p>
            <h1 className="mt-1 text-xl font-bold text-navy-900 dark:text-white">{content.brand.name}</h1>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <div className="h-2 w-32 overflow-hidden rounded-full bg-navy-100 dark:bg-white/10">
                <div
                  className="h-full rounded-full bg-workspace-500 transition-all duration-300"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
              <span className="text-sm font-semibold text-navy-700 dark:text-white/80">{progress.percent}%</span>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              {onSave && (
                <>
                  <Button size="sm" onClick={handleSave} isLoading={isSaving} className="w-full sm:w-auto">
                    Save Checklist
                  </Button>
                  {justSaved && <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Saved ✓</span>}
                </>
              )}
              <Menu
                trigger={
                  <>
                    <Printer className="h-4 w-4" />
                    Print
                  </>
                }
                items={[
                  { label: "Print filled", description: "Prints your current answers", onSelect: handlePrintFilled },
                  { label: "Print blank", description: "Prints an empty copy to fill by hand", onSelect: handlePrintBlank },
                ]}
              />
              <Menu
                trigger={
                  <>
                    <Download className="h-4 w-4" />
                    {isGeneratingPdf ? "Preparing…" : "PDF"}
                  </>
                }
                items={[
                  { label: "Download PDF", description: "Includes your current answers", onSelect: handleDownloadFilledPdf },
                  { label: "Download blank PDF", description: "An empty copy to fill by hand", onSelect: handleDownloadBlankPdf },
                ]}
              />
              <Button size="sm" variant="secondary" onClick={handleReset} className="w-full sm:w-auto">
                <RotateCcw className="h-4 w-4" />
                Reset
              </Button>
            </div>
          </div>
        </div>

        {hasReachedEnd && (
          <WorkspaceCompletionPanel workspaceName={content.brand.name} onReviewSections={() => setHasReachedEnd(false)} />
        )}

        <WorkspaceRuntimeErrorBoundary>
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
        </WorkspaceRuntimeErrorBoundary>
      </div>

      {/* Off-screen but laid out (reuses the existing global .printable-summary-container rule
          in src/styles/index.css — shared, not owned by the legacy renderer). Both "Print"
          (window.print) and "Download PDF" (downloadElementAsPdf) target this. Renders
          `printData` (filled `data`, or `{}` for the brief window a blank print/PDF is being
          captured — see isBlankPrintPending above), not `data` directly. */}
      <div className="printable-summary-container">
        <DocumentPrintSummary
          ref={printableRef}
          content={content}
          data={printData}
          percent={isBlankPrintPending ? 0 : progress.percent}
          instanceLabel={instanceLabel}
        />
      </div>
    </div>
  );
}
