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
}: WorkspaceAccordionProps) {
  const totalSteps = content.sections.length;

  return (
    <div className="flex flex-col gap-4">
      {content.sections.map((section: SectionConfig) => {
        const progress = progressBySection[section.id];
        const { label, kind } = statusFor(progress);
        const Icon = getWorkspaceIcon(section.icon);

        if (section.id === activeId) {
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
            >
              <WorkspaceSectionFields section={section} data={data} onSectionValueChange={onSectionValueChange} />
            </WorkspaceSectionShell>
          );
        }

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
