import { useMemo } from "react";
import type { SectionConfig, WorkspaceContent, WorkspaceData } from "@/types/workspaceContent";

export interface SectionProgress {
  id: string;
  filled: number;
  total: number;
  isComplete: boolean;
  isOptional: boolean;
}

const isNonEmpty = (value: unknown) => typeof value === "string" && value.trim().length > 0;

function progressForSection(section: SectionConfig, data: WorkspaceData): SectionProgress {
  const isOptional = Boolean(section.optional);

  if (section.type === "form") {
    const values = (data[section.id] as Record<string, string>) ?? {};
    const requiredFields = section.fields.filter((field) => field.required);
    const countedFields = section.fields.filter(
      (field) => !["title", "static_text", "image", "file", "link"].includes(field.type),
    );
    const filled = countedFields.filter((field) => isNonEmpty(values[field.id])).length;
    const isComplete = requiredFields.every((field) => isNonEmpty(values[field.id]));
    return { id: section.id, filled, total: countedFields.length, isComplete, isOptional };
  }

  if (section.type === "checklist") {
    const values = (data[section.id] as Record<string, boolean>) ?? {};
    const filled = section.items.filter((item) => values[item.id]).length;
    return { id: section.id, filled, total: section.items.length, isComplete: filled === section.items.length, isOptional };
  }

  if (section.type === "outcome") {
    const values = (data[section.id] as Record<string, boolean>) ?? {};
    const filled = section.items.filter((item) => values[item.id]).length;
    return { id: section.id, filled, total: section.items.length, isComplete: filled > 0, isOptional };
  }

  // notes
  const value = (data[section.id] as string) ?? "";
  const filled = isNonEmpty(value) ? 1 : 0;
  return { id: section.id, filled, total: 1, isComplete: filled === 1, isOptional };
}

export function useWorkspaceProgress(content: WorkspaceContent, data: WorkspaceData) {
  return useMemo(() => {
    const sections: Record<string, SectionProgress> = {};
    for (const section of content.sections) {
      sections[section.id] = progressForSection(section, data);
    }

    const countable = Object.values(sections).filter((section) => !section.isOptional);
    const totalFields = countable.reduce((sum, section) => sum + section.total, 0);
    const completedFields = countable.reduce((sum, section) => sum + section.filled, 0);
    const percent = totalFields === 0 ? 0 : Math.round((completedFields / totalFields) * 100);

    return { sections, totalFields, completedFields, percent };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, JSON.stringify(data)]);
}
