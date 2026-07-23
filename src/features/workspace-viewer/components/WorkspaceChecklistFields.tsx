import type { ChecklistSectionConfig, OutcomeSectionConfig } from "@/types/workspaceContent";

interface WorkspaceChecklistFieldsProps {
  section: ChecklistSectionConfig | OutcomeSectionConfig;
  values: Record<string, boolean>;
  onToggle: (itemId: string, checked: boolean) => void;
  layout: "stack" | "grid";
}

export function WorkspaceChecklistFields({ section, values, onToggle, layout }: WorkspaceChecklistFieldsProps) {
  return (
    <div className={layout === "grid" ? "grid gap-3 sm:grid-cols-2" : "flex flex-col gap-3"}>
      {section.items.map((item) => (
        <label
          key={item.id}
          className="flex cursor-pointer items-start gap-3 rounded-xl border border-navy-100 px-4 py-3 transition-colors hover:border-workspace-300 dark:border-white/10"
        >
          <input
            type="checkbox"
            checked={Boolean(values[item.id])}
            onChange={(event) => onToggle(item.id, event.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 rounded accent-workspace-500"
          />
          <span className="text-sm text-navy-700 dark:text-white/80">{item.label}</span>
        </label>
      ))}
    </div>
  );
}
