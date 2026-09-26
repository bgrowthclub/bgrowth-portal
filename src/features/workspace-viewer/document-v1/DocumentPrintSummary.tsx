import { forwardRef, type CSSProperties } from "react";
import { Check } from "lucide-react";
import type { FormSectionConfig, SectionConfig, WorkspaceContent, WorkspaceData } from "@/types/workspaceContent";
import { getWorkspaceIcon } from "@/lib/workspaceIcons";
import bgrowthLogo from "@/assets/logo.png";

interface DocumentPrintSummaryProps {
  content: WorkspaceContent;
  data: WorkspaceData;
  percent: number;
  /** The saved instance's label (client/job ref), if any — shown in the Overview block. */
  instanceLabel?: string;
}

/**
 * Document V1 — a document-structured replacement for the *print/PDF*
 * output only (see DocumentWorkspaceRenderer.tsx for how this is mounted).
 * Isolated from bgrowth-studio's PrintableSummary.tsx and this repo's own
 * legacy WorkspacePrintSummary.tsx — neither of those files is imported or
 * modified here.
 *
 * Tree this component renders: Header -> Product Identity -> Progress/
 * Metadata -> Content Sections (heading, description, content) -> Continue
 * Your Journey -> Footer.
 *
 * Visual language is deliberately typographic, not "web app exported to
 * PDF": no boxed/bordered cards around sections, fields, or checklist
 * groups. Hierarchy comes from type size/weight, color, spacing, and a
 * handful of hairline rules used only where they genuinely separate one
 * section from the next — matching a premium printed document rather than
 * a UI screenshot. See the pagination doc comments below for why the
 * underlying flow structure (flat checklist siblings, grouped headings)
 * looks the way it does — that's a separate, load-bearing concern from
 * this visual layer and was validated against html2pdf's actual pagination
 * behavior, not guessed at.
 */

const SKIPPED_FIELD_TYPES = ["title", "static_text", "image", "static_image", "file", "link"];

/**
 * Recognizes BGrowth's recurring cross-product "Continue Your Journey" /
 * "Continue Sua Jornada" promotional section by its title text — no schema
 * field distinguishes a promotional section from any other content section
 * (see workspaceContent.schema.ts's sectionBaseSchema), so title matching
 * against this brand-standard, product-agnostic phrase (in either language
 * it's currently authored in) is the only available signal. Matches
 * regardless of an emoji/number prefix Studio may have added to the title.
 * Excludes the section from Print/PDF only — the online Workspace
 * (WorkspaceAccordion) never calls this and keeps rendering it unchanged.
 */
function isJourneyCtaSection(section: { title: string }): boolean {
  const normalized = section.title.toLowerCase();
  return normalized.includes("continue your journey") || normalized.includes("continue sua jornada");
}

/** Section container: keeps the whole section together when it's reasonably short (see rule #1/#6 — not applied unconditionally to arbitrarily long content). */
const SECTION_BLOCK_STYLE: CSSProperties = { breakInside: "avoid", pageBreakInside: "avoid" };
/** Heading-only protection: keeps a heading from ever landing alone at the bottom of a page even when the section body itself is allowed to flow across a break (long checklists). */
const HEADING_GROUP_STYLE: CSSProperties = { breakInside: "avoid", pageBreakInside: "avoid" };

function SectionHeading({ section, primaryColor }: { section: SectionConfig; primaryColor: string }) {
  const Icon = getWorkspaceIcon(section.icon);
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-[9.5px] font-bold tabular-nums" style={{ color: primaryColor }}>
        {String(section.number).padStart(2, "0")}
      </span>
      <Icon className="h-3 w-3 shrink-0 self-center" style={{ color: primaryColor }} />
      <h3 className="text-[12px] font-bold tracking-tight text-slate-900">{section.title}</h3>
      {section.optional && <span className="text-[9px] font-medium text-slate-400">(optional)</span>}
    </div>
  );
}

function FormLine({ label, value, isBlank }: { label: string; value?: string; isBlank: boolean }) {
  return (
    <div className="mb-2 break-words">
      <div className="text-[8.5px] font-semibold uppercase tracking-wide text-slate-400">{label}</div>
      {isBlank ? (
        // Blank document: a clean, unobtrusive writing line instead of a "—"
        // placeholder — a dash reads as "no content belongs here" rather
        // than "write your answer here". Reuses the same slate-300 hairline
        // already used for checkbox borders elsewhere in this file, sized to
        // the filled line's own height so the field grid's vertical rhythm
        // doesn't shift between filled and blank output.
        <div className="h-[14px] border-b border-slate-300" aria-hidden="true" />
      ) : (
        // Filled document: unchanged — an individual field the member left
        // empty still shows "—", exactly as before.
        <div className="text-[10.5px] leading-snug text-slate-900">{value || <span className="text-slate-300">—</span>}</div>
      )}
    </div>
  );
}

function FormSectionBody({ section, data, isBlank }: { section: FormSectionConfig; data: WorkspaceData; isBlank: boolean }) {
  const values = (data[section.id] as Record<string, string>) ?? {};
  const fields = section.fields.filter((field) => !SKIPPED_FIELD_TYPES.includes(field.type));

  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-0.5">
      {fields.map((field) => {
        const spanFull = field.fullWidth || field.type === "textarea";
        if (field.type === "checkbox") {
          const checked = values[field.id] === "true";
          return (
            <div key={field.id} className={`mb-2 flex items-center gap-1.5 text-[10.5px] ${spanFull ? "col-span-2" : ""}`}>
              <span className="flex h-3 w-3 shrink-0 items-center justify-center rounded-sm border border-slate-300">
                {checked && <Check className="h-2 w-2" strokeWidth={4} />}
              </span>
              <span className="text-slate-800">{field.placeholder || field.label}</span>
            </div>
          );
        }
        return (
          <div key={field.id} className={spanFull ? "col-span-2" : ""}>
            <FormLine label={field.label} value={values[field.id]} isBlank={isBlank} />
          </div>
        );
      })}
    </div>
  );
}

function ChecklistItemRow({ item, checked, primaryColor }: { item: { id: string; label: string }; checked: boolean; primaryColor: string }) {
  return (
    <div className="flex items-center gap-2 py-1" style={SECTION_BLOCK_STYLE}>
      <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm border border-slate-300">
        {checked && <Check className="h-2.5 w-2.5" strokeWidth={4} style={{ color: primaryColor }} />}
      </span>
      <span className="text-[10.5px] text-slate-800">{item.label}</span>
    </div>
  );
}

function OutcomeSectionBody({
  section,
  data,
  primaryColor,
}: {
  section: Extract<SectionConfig, { type: "outcome" }>;
  data: WorkspaceData;
  primaryColor: string;
}) {
  const values = (data[section.id] as Record<string, boolean>) ?? {};
  return (
    <div className="flex flex-wrap gap-x-6 gap-y-1.5">
      {section.items.map((item) => (
        <div key={item.id} className="flex items-center gap-1.5">
          <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm border border-slate-300">
            {values[item.id] && <Check className="h-2.5 w-2.5" strokeWidth={4} style={{ color: primaryColor }} />}
          </span>
          <span className="text-[10.5px] font-medium text-slate-800">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

function NotesSectionBody({ section, data }: { section: SectionConfig; data: WorkspaceData }) {
  const value = (data[section.id] as string) ?? "";
  return (
    <p className="min-h-[14px] whitespace-pre-wrap text-[10.5px] leading-relaxed text-slate-800">
      {value || <span className="text-slate-300">No notes recorded.</span>}
    </p>
  );
}

function ContentSection({
  section,
  data,
  primaryColor,
  isBlank,
}: {
  section: SectionConfig;
  data: WorkspaceData;
  primaryColor: string;
  isBlank: boolean;
}) {
  // Checklist sections are the one type long enough to reasonably span a
  // page break. html2pdf's `avoid-all` pagebreak mode doesn't read a CSS
  // `break-inside: auto` override to "release" a block it would otherwise
  // relocate whole — the only reliable way to let it slice between items
  // instead of jumping the whole section to the next page is to never give
  // it one tall parent element spanning every item in the first place. So
  // a checklist renders as flat siblings directly in the Content Sections
  // flow (heading+first-item kept atomic as one small group, every later
  // item its own tiny flow sibling) rather than one wrapping <section> —
  // each is small enough on its own that avoid-all has nothing large to
  // move, so the section fills whatever room is actually left on the page
  // instead of jumping wholesale. (This DOM shape is load-bearing for
  // pagination — see the PDF pipeline investigation report — and is kept
  // exactly as validated even though it's visually invisible.)
  if (section.type === "checklist") {
    const values = (data[section.id] as Record<string, boolean>) ?? {};
    const [firstItem, ...restItems] = section.items;
    return (
      <>
        <div className="border-t border-slate-100 pt-3 first:border-t-0 first:pt-0" style={HEADING_GROUP_STYLE}>
          <SectionHeading section={section} primaryColor={primaryColor} />
          {section.description && <p className="mt-0.5 pl-[27px] text-[9.5px] text-slate-400">{section.description}</p>}
          {firstItem && (
            <div className="mt-2 pl-[27px]">
              <ChecklistItemRow item={firstItem} checked={Boolean(values[firstItem.id])} primaryColor={primaryColor} />
            </div>
          )}
        </div>
        {restItems.map((item) => (
          <div key={item.id} className="pl-[27px]">
            <ChecklistItemRow item={item} checked={Boolean(values[item.id])} primaryColor={primaryColor} />
          </div>
        ))}
      </>
    );
  }

  return (
    <section className="border-t border-slate-100 pt-3 first:border-t-0 first:pt-0" style={SECTION_BLOCK_STYLE}>
      <div style={HEADING_GROUP_STYLE}>
        <SectionHeading section={section} primaryColor={primaryColor} />
        {section.description && <p className="mt-0.5 pl-[27px] text-[9.5px] text-slate-400">{section.description}</p>}
      </div>
      <div className="mt-2 pl-[27px]">
        {section.type === "form" && <FormSectionBody section={section} data={data} isBlank={isBlank} />}
        {section.type === "outcome" && <OutcomeSectionBody section={section} data={data} primaryColor={primaryColor} />}
        {section.type === "notes" && <NotesSectionBody section={section} data={data} />}
      </div>
    </section>
  );
}

export const DocumentPrintSummary = forwardRef<HTMLDivElement, DocumentPrintSummaryProps>(
  ({ content, data, percent }, ref) => {
    const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    const primaryColor = content.brand.primaryColor;
    // Same status concept as bgrowth-studio's PrintableSummary.tsx — the header's
    // metadata row shows document FILL STATUS ("Filled document"/"Blank template"),
    // not workspace/instance identity (an instance's client/job label, if any,
    // belongs in the document's own fields, not this header position — see the
    // PDF branding correction report).
    const isBlank = !data || Object.keys(data).length === 0;

    return (
      <div ref={ref} className="printable-summary document-v1 select-none px-8 pb-8 pt-5 font-sans text-slate-900">
        {/* Header — product title, logo, and generated date only. Fill/blank
            status used to also live here ("Filled document"/"100% complete"/
            "Blank template"/"Blank Form") — moved to live exclusively in the
            footer below, so status isn't duplicated in two places on the
            page (see the header/footer status cleanup report). */}
        <div className="flex items-start justify-between">
          <div>
            {/* No standalone "BGROWTH" eyebrow here — the product title is the
                only left-side text; BGrowth's own identity lives in the logo
                on the right (see the PDF header cleanup report). Matches
                bgrowth-studio's PrintableSummary.tsx. */}
            <h1 className="text-[21px] font-bold leading-tight tracking-tight text-[#0b1d3a]">{content.brand.name}</h1>
            <div className="mt-2 h-[2px] w-10" style={{ backgroundColor: primaryColor }} />
          </div>

          {/* Official BGrowth logo — same asset/design as bgrowth-studio's PrintableSummary.tsx
              (separate repos, each keeps its own local copy of the same logo; see the PDF
              branding correction report). Same placement/size as Studio's PDF header. */}
          <div className="flex items-center gap-1.5">
            <img src={bgrowthLogo} alt="BGrowth" className="h-7 w-7 rounded-lg object-cover shrink-0" />
            <div className="flex flex-col leading-none">
              <span className="text-[12.5px] font-extrabold tracking-tight text-[#0b1d3a]">BGrowth</span>
            </div>
          </div>
        </div>

        {/* Metadata — generated date only now (see header comment above). */}
        <div className="mt-3 flex items-center justify-end text-[10px] text-slate-500" style={SECTION_BLOCK_STYLE}>
          <span>Generated {today}</span>
        </div>

        {/* Content Sections — every section flows in document order, sized to its own content only.
            No flex `gap` here deliberately: a checklist section renders as flat sibling item rows
            (see ContentSection), and a `gap` on this container would apply between every single
            item row, not just between sections — each unit below spaces itself instead, via its
            own top border + padding (section starts) or its own compact `py` (checklist items).
            Excludes the "Continue Your Journey"/"Continue Sua Jornada" promotional section (see
            isJourneyCtaSection above) — Print/PDF ends with the member's real content, never
            this online-only cross-sell block. */}
        <div className="mt-4 flex flex-col">
          {content.sections
            .filter((section) => !isJourneyCtaSection(section))
            .map((section) => (
              <ContentSection key={section.id} section={section} data={data} primaryColor={primaryColor} isBlank={isBlank} />
            ))}
        </div>

        {/* Footer — page/document metadata, kept out of the content flow above.
            No "Continue Your Journey" promotional block before this: Studio's
            PDF ends at the last real content section, then the footer — see
            the PDF branding correction report. Studio and Portal now end the
            same way. */}
        <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-2 text-[9px] font-semibold">
          <span className="uppercase tracking-tight text-slate-700">{content.brand.companyLabel}</span>
          <span className="font-normal text-slate-400">
            Generated on {today} • {isBlank ? "Blank Form" : `${percent}% complete`}
          </span>
        </div>
      </div>
    );
  },
);

DocumentPrintSummary.displayName = "DocumentPrintSummary";
