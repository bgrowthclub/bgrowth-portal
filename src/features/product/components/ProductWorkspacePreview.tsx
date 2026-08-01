import type { ProductRow } from "@/types/database";
import type { SectionConfig } from "@/types/workspaceContent";
import { getWorkspaceIcon } from "@/lib/workspaceIcons";

interface ProductWorkspacePreviewProps {
  product: Pick<ProductRow, "content">;
}

/** Field/checklist item labels for one section — the closest thing to a "table of contents" without exposing any filled-in customer data (there is none here; this reads only the published template, never workspace_instances). */
function getSectionItemLabels(section: SectionConfig): string[] {
  if (section.type === "form") return section.fields.map((field) => field.label);
  if (section.type === "checklist" || section.type === "outcome") return section.items.map((item) => item.label);
  return [];
}

/**
 * Read-only "What's Inside" discovery view — lets a signed-out visitor see
 * every section this Workspace actually contains (title, description, and
 * the fields/checklist items within) before creating an account. Reuses
 * `product.content` as-is (the same published Workspace JSON the Runtime
 * fills in) rather than a second, duplicated content source — this
 * component only ever reads titles/descriptions/labels from it, never
 * renders an input, and has no path to workspace_instances or any other
 * member's saved data. `/product/:slug` (where this renders) has always
 * been a public route; `/workspace/:slug` (the actual fillable Runtime)
 * stays behind ProtectedRoute exactly as before.
 */
export function ProductWorkspacePreview({ product }: ProductWorkspacePreviewProps) {
  const sections = product.content?.sections;
  if (!sections || sections.length === 0) return null;

  return (
    <section className="bg-white py-16 dark:bg-navy-950/40">
      <div className="mx-auto max-w-3xl px-6">
        <div className="text-center">
          <span className="text-sm font-semibold uppercase tracking-wider text-primary">What&apos;s Inside</span>
          <h2 className="mt-3 text-3xl font-bold text-navy-900 dark:text-white sm:text-4xl">
            Every section of this Workspace
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-navy-500 dark:text-white/50">
            See exactly what you&apos;ll work through — no account needed to look around.
          </p>
        </div>

        <ol className="mx-auto mt-10 flex flex-col gap-3">
          {sections.map((section) => {
            const Icon = getWorkspaceIcon(section.icon);
            const itemLabels = getSectionItemLabels(section);

            return (
              <li key={section.id} className="card p-5">
                <div className="flex items-start gap-4">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-workspace-50 text-workspace-600 dark:bg-workspace-500/10 dark:text-workspace-300">
                    <Icon className="h-[18px] w-[18px]" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-semibold text-navy-800 dark:text-white">
                      {section.number}. {section.title}
                      {section.optional && (
                        <span className="ml-2 rounded-full bg-navy-100 px-2 py-0.5 text-[11px] font-medium text-navy-500 dark:bg-white/10 dark:text-white/50">
                          Optional
                        </span>
                      )}
                    </p>
                    <p className="mt-1 text-sm text-navy-500 dark:text-white/50">{section.description}</p>

                    {itemLabels.length > 0 && (
                      <ul className="mt-3 flex flex-wrap gap-1.5">
                        {itemLabels.map((label, index) => (
                          <li
                            key={`${section.id}-${index}`}
                            className="rounded-full bg-navy-50 px-2.5 py-1 text-xs text-navy-600 dark:bg-white/5 dark:text-white/60"
                          >
                            {label}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
