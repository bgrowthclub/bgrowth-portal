import type { WorkspaceContent, WorkspaceData, SectionConfig } from "@/types/workspaceContent";
import type { SectionProgress } from "../hooks/useWorkspaceProgress";
import type { WorkspaceStatusKind } from "./WorkspaceStatusBadge";
import { getWorkspaceIcon } from "@/lib/workspaceIcons";
import { WorkspaceSectionShell } from "./WorkspaceSectionShell";
import { WorkspaceSectionSummaryRow } from "./WorkspaceSectionSummaryRow";
import { WorkspaceSectionFields } from "./WorkspaceSectionFields";

interface WorkspaceAccordionProps {
  content: WorkspaceContent;
  data: WorkspaceData;
  activeId: string;
  onSelect: (id: string) => void;
  onContinue: (id: string) => void;
  onSectionValueChange: (sectionId: string, value: WorkspaceData[string]) => void;
  progressBySection: Record<string, SectionProgress>;
  /** Whether the active section's "Save & Continue"/"Finish Workspace" click is currently saving. */
  isContinueSaving: boolean;
  /** Set when that save fails — shown on the active section so the member knows why they're still here. */
  continueError: string | null;
}

function statusFor(progress: SectionProgress): { label: string; kind: WorkspaceStatusKind } {
  if (progress.isOptional) return { label: "Optional", kind: "optional" };
  if (progress.isComplete) return { label: "Completed", kind: "completed" };
  return { label: `${progress.filled} / ${progress.total} completed`, kind: "progress" };
}

export function WorkspaceAccordion({
  content,
  data,
  activeId,
  onSelect,
  onContinue,
  onSectionValueChange,
  progressBySection,
  isContinueSaving,
  continueError,
}: WorkspaceAccordionProps) {
  const totalSteps = content.sections.length;

  // TEMPORARY DIAGNOSTIC — instrumenting the "Save & Continue" insertBefore
  // crash now that duplicate section/field/item ids have been ruled out by
  // Studio's Template Integrity Validator (on the Studio-side draft). This
  // re-checks the same thing against the LIVE, published content this
  // component is actually rendering, in case the published version differs
  // from whatever the validator scanned (a stale/older publish, a version
  // mismatch, etc.) — logs every render's section id list, which id is
  // marked active, and flags a duplicate directly if one is found here.
  // Remove once the root cause is found and fixed.
  const sectionIds = content.sections.map((s) => s.id);
  const duplicateSectionIds = sectionIds.filter((id, idx) => sectionIds.indexOf(id) !== idx);
  console.log("[WORKSPACE DIAGNOSTIC] WorkspaceAccordion render", {
    activeId,
    sectionIds,
    reactKeys: sectionIds, // key={section.id} everywhere below — identical by construction
    duplicateSectionIdsFoundAtRuntime: duplicateSectionIds,
  });
  if (duplicateSectionIds.length > 0) {
    console.error("[WORKSPACE DIAGNOSTIC] Duplicate section.id found in the LIVE rendered content:", duplicateSectionIds);
  }

  return (
    <div className="flex flex-col gap-4">
      {content.sections.map((section: SectionConfig) => {
        const progress = progressBySection[section.id];
        const { label, kind } = statusFor(progress);
        const Icon = getWorkspaceIcon(section.icon);

        if (section.id === activeId) {
          console.log("[WORKSPACE DIAGNOSTIC] → ACTIVE slot (WorkspaceSectionShell)", {
            id: section.id,
            number: section.number,
            title: section.title,
            key: section.id,
          });
          return (
            <WorkspaceSectionShell
              key={section.id}
              number={section.number}
              totalSteps={totalSteps}
              icon={<Icon />}
              title={section.title}
              description={section.description}
              whyItMatters={section.whyItMatters}
              tip={section.tip}
              isLast={section.number === totalSteps}
              onContinue={() => onContinue(section.id)}
              isSaving={isContinueSaving}
              saveError={continueError}
            >
              <WorkspaceSectionFields section={section} data={data} onSectionValueChange={onSectionValueChange} />
            </WorkspaceSectionShell>
          );
        }

        console.log("[WORKSPACE DIAGNOSTIC] → summary slot (WorkspaceSectionSummaryRow)", {
          id: section.id,
          number: section.number,
          title: section.title,
          key: section.id,
        });
        return (
          <WorkspaceSectionSummaryRow
            key={section.id}
            number={section.number}
            icon={<Icon />}
            title={section.title}
            description={section.description}
            statusLabel={label}
            statusKind={kind}
            isCompleted={progress.isComplete}
            onClick={() => onSelect(section.id)}
          />
        );
      })}
    </div>
  );
}
