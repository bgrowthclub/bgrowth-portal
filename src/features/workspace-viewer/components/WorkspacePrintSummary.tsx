import { forwardRef } from "react";
import { Check } from "lucide-react";
import type { WorkspaceContent, WorkspaceData, FormSectionConfig } from "@/types/workspaceContent";
import { getWorkspaceIcon } from "@/lib/workspaceIcons";

interface WorkspacePrintSummaryProps {
  content: WorkspaceContent;
  data: WorkspaceData;
  percent: number;
}

/**
 * Same layout/visual pattern as bgrowth-studio's PrintableSummary.tsx
 * "Dynamic / Standard Fallback Layout" branch (its generic, non-Notary-
 * hardcoded path) — colored section header bars, 2-column form grid,
 * checkbox-square checklist rows. Deliberately doesn't port Studio's
 * per-product NOTARY_OVERRIDES branching: this Runtime never hardcodes a
 * specific product's content (see README), so every section here renders
 * purely from `content`/`data`, and the header color reads
 * content.brand.primaryColor instead of a hardcoded hex, matching how
 * every other themed surface in this Runtime already works.
 */
function FormLine({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex items-start gap-1 py-0.5 text-[10.5px] leading-tight" style={{ breakInside: "avoid" }}>
      <span className="mr-1 shrink-0 font-semibold text-slate-800">{label}:</span>
      <span className="min-h-[15px] grow border-b border-slate-300 pl-1 font-medium text-slate-900">{value || ""}</span>
    </div>
  );
}

export const WorkspacePrintSummary = forwardRef<HTMLDivElement, WorkspacePrintSummaryProps>(
  ({ content, data, percent }, ref) => {
    const primaryColor = content.brand.primaryColor;
    const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

    return (
      <div ref={ref} className="printable-summary select-none p-6 font-sans text-slate-900">
        <div className="mb-4 flex items-start justify-between border-b border-slate-200 pb-2.5">
          <div>
            <h1 className="text-[19px] font-black uppercase leading-tight tracking-tight text-[#0b1d3a]">
              {content.brand.name}
            </h1>
            <p className="mt-0.5 text-[10px] font-medium text-slate-500">{content.brand.companyLabel}</p>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3.5">
          {content.sections
            .filter((section): section is FormSectionConfig => section.type === "form")
            .map((section) => {
              const values = (data[section.id] as Record<string, string>) ?? {};
              const SectionIcon = getWorkspaceIcon(section.icon);
              return (
                <div key={section.id} className="flex min-w-0 flex-col" style={{ breakInside: "avoid" }}>
                  <div
                    className="flex items-center gap-1.5 rounded-t-md px-2.5 py-1.5 text-[10px] font-extrabold uppercase tracking-wide text-white"
                    style={{ backgroundColor: primaryColor }}
                  >
                    <SectionIcon className="h-3 w-3 shrink-0" />
                    <span>{section.title}</span>
                    {section.optional && <span className="font-normal normal-case text-white/70">(optional)</span>}
                  </div>
                  <div className="flex min-h-[80px] flex-col gap-1 rounded-b-md border border-t-0 border-slate-200 bg-white p-2.5">
                    {section.fields.map((field) => {
                      if (["title", "static_text", "image", "static_image", "file", "link"].includes(field.type)) {
                        return null;
                      }
                      if (field.type === "checkbox") {
                        const checked = values[field.id] === "true";
                        return (
                          <div key={field.id} className="my-0.5 flex items-center gap-2 text-[10.5px] leading-tight">
                            <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm border border-slate-400 bg-white">
                              {checked && <Check className="h-2.5 w-2.5" strokeWidth={4} style={{ color: primaryColor }} />}
                            </span>
                            <span className="font-medium text-slate-800">{field.placeholder || field.label}</span>
                          </div>
                        );
                      }
                      return <FormLine key={field.id} label={field.label} value={values[field.id]} />;
                    })}
                  </div>
                </div>
              );
            })}
        </div>

        {content.sections
          .filter((section) => section.type === "checklist")
          .map((section, idx) => {
            if (section.type !== "checklist") return null;
            const values = (data[section.id] as Record<string, boolean>) ?? {};
            return (
              <div key={section.id} className="mt-3" style={{ breakInside: "avoid" }}>
                <div
                  className="rounded-[3px] px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-wide text-white"
                  style={{ backgroundColor: primaryColor }}
                >
                  Section {idx + 1}: {section.title}
                </div>
                <div className="divide-y divide-slate-100 rounded-b-[3px] border border-t-0 border-slate-200 bg-white">
                  {section.items.map((item) => (
                    <div key={item.id} className="flex items-center gap-2 px-2.5 py-1">
                      <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[3px] border border-slate-400 bg-white">
                        {values[item.id] && <Check className="h-2.5 w-2.5" strokeWidth={4} style={{ color: primaryColor }} />}
                      </span>
                      <span className="text-[10.5px] font-semibold text-slate-800">{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

        {content.sections
          .filter((section) => section.type === "notes")
          .map((section) => {
            const value = (data[section.id] as string) ?? "";
            return (
              <div key={section.id} className="mt-3">
                <div className="rounded-sm bg-[#0b1d3a] px-3 py-1 text-[9.5px] font-extrabold uppercase tracking-wider text-white">
                  {section.title}
                </div>
                <div className="mt-1 min-h-[17px] whitespace-pre-wrap border-b border-slate-300 px-1 pb-0.5 text-[10.5px] font-medium text-slate-800">
                  {value}
                </div>
              </div>
            );
          })}

        {content.sections
          .filter((section) => section.type === "outcome")
          .map((section) => {
            if (section.type !== "outcome") return null;
            const values = (data[section.id] as Record<string, boolean>) ?? {};
            return (
              <div key={section.id} className="mt-3">
                <div className="rounded-sm bg-[#0b1d3a] px-3 py-1 text-[9.5px] font-extrabold uppercase tracking-wider text-white">
                  {section.title}
                </div>
                <div className="mt-2 flex flex-wrap justify-between gap-4 px-1">
                  {section.items.map((item) => (
                    <div key={item.id} className="flex items-center gap-2">
                      <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[3px] border border-slate-400 bg-white">
                        {values[item.id] && <Check className="h-2.5 w-2.5" strokeWidth={4} style={{ color: primaryColor }} />}
                      </span>
                      <span className="text-[10px] font-bold text-slate-700">{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

        <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-1 text-[9px] font-extrabold">
          <span className="uppercase tracking-tight text-slate-800">{content.brand.companyLabel}</span>
          <span className="font-normal text-slate-400">
            Generated on {today} • {percent}% complete
          </span>
        </div>
      </div>
    );
  },
);

WorkspacePrintSummary.displayName = "WorkspacePrintSummary";
