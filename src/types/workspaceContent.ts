/**
 * The "Workspace JSON" schema — mirrors BGrowth Studio's Checklist Generator
 * Engine config shape (`bgrowth-studio/src/engine/types.ts`) field-for-field.
 * This is deliberately NOT a Portal-invented format: Studio is the single
 * source of truth for the schema, since Studio is where products are
 * authored and published. Keep this in sync with Studio's `engine/types.ts`
 * whenever that changes.
 *
 * A product's `products.content` column holds a value of this shape. The
 * Portal never hardcodes a product's sections/fields — everything renders
 * generically through `WorkspaceRenderer` off this data, so a brand-new
 * product published from Studio (any brand color, any section/field mix)
 * appears in the Portal with zero Portal code changes.
 */

export type FieldType =
  | "text"
  | "email"
  | "phone"
  | "date"
  | "time"
  | "number"
  | "select"
  | "textarea"
  | "title"
  | "static_text"
  | "image"
  | "static_image"
  | "checkbox"
  | "link"
  | "file";

export type FieldConfig = {
  id: string;
  label: string;
  type: FieldType;
  icon: string;
  required?: boolean;
  placeholder?: string;
  staticImageUrl?: string;
  /** Required for type === 'select'. */
  options?: string[];
  fullWidth?: boolean;
};

export type ChecklistItemConfig = {
  id: string;
  label: string;
};

export type SectionType = "form" | "checklist" | "notes" | "outcome";

type SectionBase = {
  id: string;
  number: number;
  title: string;
  description: string;
  /** lucide-react icon name, e.g. "user", "calendar-days" — see src/lib/icons.ts. */
  icon: string;
  optional?: boolean;
  whyItMatters?: string;
  tip?: string;
};

export type FormSectionConfig = SectionBase & { type: "form"; fields: FieldConfig[] };
export type ChecklistSectionConfig = SectionBase & { type: "checklist"; items: ChecklistItemConfig[] };
export type NotesSectionConfig = SectionBase & { type: "notes" };
export type OutcomeSectionConfig = SectionBase & { type: "outcome"; items: ChecklistItemConfig[] };

export type SectionConfig =
  | FormSectionConfig
  | ChecklistSectionConfig
  | NotesSectionConfig
  | OutcomeSectionConfig;

export type WorkspaceBrand = {
  name: string;
  companyLabel: string;
  /** Base hex color; the renderer derives a full 50–900 scale from it at runtime. */
  primaryColor: string;
};

export type WorkspaceFooter = {
  proTip: string;
  helpText: string;
  helpUrl?: string;
};

/** The full shape stored in `products.content`. */
export type WorkspaceContent = {
  productId: string;
  brand: WorkspaceBrand;
  footer: WorkspaceFooter;
  sections: SectionConfig[];
};

/** Filled-in member data, keyed by section id — matches Studio's ChecklistData shape. */
export type WorkspaceData = Record<string, Record<string, string> | Record<string, boolean> | string>;
