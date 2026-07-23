import type { SectionConfig, WorkspaceData } from "@/types/workspaceContent";
import { WorkspaceFieldRenderer } from "./WorkspaceFieldRenderer";
import { WorkspaceChecklistFields } from "./WorkspaceChecklistFields";
import { WorkspaceNotesField } from "./WorkspaceNotesField";

interface WorkspaceSectionFieldsProps {
  section: SectionConfig;
  data: WorkspaceData;
  /** Replaces this section's entire value in the top-level data map. */
  onSectionValueChange: (sectionId: string, value: WorkspaceData[string]) => void;
}

/**
 * Dispatches purely on `section.type` — this is the one place that would
 * need a new branch if Studio ever introduces a fifth section type. Every
 * existing section type, and every field type within a form section, is
 * fully data-driven: no product-specific branching anywhere in this tree.
 */
export function WorkspaceSectionFields({ section, data, onSectionValueChange }: WorkspaceSectionFieldsProps) {
  if (section.type === "form") {
    const values = (data[section.id] as Record<string, string>) ?? {};
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        {section.fields.map((field) => (
          <WorkspaceFieldRenderer
            key={field.id}
            field={field}
            value={values[field.id] ?? ""}
            onChange={(value) => onSectionValueChange(section.id, { ...values, [field.id]: value })}
          />
        ))}
      </div>
    );
  }

  if (section.type === "checklist" || section.type === "outcome") {
    const values = (data[section.id] as Record<string, boolean>) ?? {};
    return (
      <WorkspaceChecklistFields
        section={section}
        values={values}
        layout={section.type === "outcome" ? "grid" : "stack"}
        onToggle={(itemId, checked) => onSectionValueChange(section.id, { ...values, [itemId]: checked })}
      />
    );
  }

  // notes
  const value = (data[section.id] as string) ?? "";
  return <WorkspaceNotesField value={value} onChange={(next) => onSectionValueChange(section.id, next)} />;
}
