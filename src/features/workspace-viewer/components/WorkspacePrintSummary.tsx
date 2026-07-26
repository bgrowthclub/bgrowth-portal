import type { WorkspaceContent, WorkspaceData, SectionConfig, FieldConfig } from "@/types/workspaceContent";

interface WorkspacePrintSummaryProps {
  content: WorkspaceContent;
  data: WorkspaceData;
}

function fieldValueLine(field: FieldConfig, values: Record<string, string>) {
  if (["title", "static_text", "image", "static_image", "file", "link"].includes(field.type)) return null;

  if (field.type === "checkbox") {
    const checked = values[field.id] === "true";
    return (
      <div key={field.id} className="flex items-center gap-2 py-0.5 text-[11px]">
        <span className="inline-flex h-3 w-3 shrink-0 items-center justify-center rounded-sm border border-slate-400">
          {checked ? "✓" : ""}
        </span>
        <span className="text-slate-800">{field.placeholder || field.label}</span>
      </div>
    );
  }

  return (
    <div key={field.id} className="flex gap-1 py-0.5 text-[11px]">
      <span className="shrink-0 font-semibold text-slate-700">{field.label}:</span>
      <span className="border-b border-slate-300 text-slate-900">{values[field.id] || "—"}</span>
    </div>
  );
}

function sectionBlock(section: SectionConfig, data: WorkspaceData) {
  if (section.type === "form") {
    const values = (data[section.id] as Record<string, string>) ?? {};
    return <div className="flex flex-col">{section.fields.map((field) => fieldValueLine(field, values))}</div>;
  }

  if (section.type === "checklist" || section.type === "outcome") {
    const values = (data[section.id] as Record<string, boolean>) ?? {};
    return (
      <div className="flex flex-col">
        {section.items.map((item) => (
          <div key={item.id} className="flex items-center gap-2 py-0.5 text-[11px]">
            <span className="inline-flex h-3 w-3 shrink-0 items-center justify-center rounded-sm border border-slate-400">
              {values[item.id] ? "✓" : ""}
            </span>
            <span className="text-slate-800">{item.label}</span>
          </div>
        ))}
      </div>
    );
  }

  // notes
  const value = (data[section.id] as string) ?? "";
  return <p className="whitespace-pre-wrap text-[11px] text-slate-800">{value || "—"}</p>;
}

/**
 * Hidden on screen (see .print-only in src/styles/index.css), shown only
 * when printing/saving as PDF — the accordion only ever renders one
 * section's fields at a time (the rest collapse to summary rows), so this
 * is the one place every section's filled-in values render together.
 * Fully data-driven, same as the rest of the Runtime — no per-product
 * branching, so it never needs a change when a new Workspace publishes.
 */
export function WorkspacePrintSummary({ content, data }: WorkspacePrintSummaryProps) {
  return (
    <div className="print-only bg-white p-6 text-slate-900">
      <div className="mb-4 border-b border-slate-200 pb-2">
        <h1 className="text-lg font-bold uppercase tracking-tight text-slate-900">{content.brand.name}</h1>
        <p className="text-[10px] text-slate-500">Generated on {new Date().toLocaleDateString()}</p>
      </div>
      {content.sections.map((section) => (
        <div key={section.id} className="mb-3" style={{ breakInside: "avoid" }}>
          <div className="bg-slate-800 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
            {section.number}. {section.title}
          </div>
          <div className="border border-t-0 border-slate-200 p-2.5">{sectionBlock(section, data)}</div>
        </div>
      ))}
    </div>
  );
}
