import { z } from "zod";

/**
 * The "Workspace JSON" schema, as a zod schema rather than a hand-written
 * type — this is what the Publishing Engine's publish endpoint validates an
 * incoming payload against, and `src/types/workspaceContent.ts` derives its
 * TS types from these same schemas via z.infer, so validation and typing can
 * never drift apart.
 *
 * Mirrors BGrowth Studio's Checklist Generator Engine config shape
 * (`bgrowth-studio/src/engine/types.ts`) field-for-field. Keep in sync
 * whenever that changes.
 */

export const fieldTypeSchema = z.enum([
  "text",
  "email",
  "phone",
  "date",
  "time",
  "number",
  "select",
  "textarea",
  "title",
  "static_text",
  "image",
  "static_image",
  "checkbox",
  "link",
  "file",
]);

export const fieldConfigSchema = z.object({
  id: z.string(),
  label: z.string(),
  type: fieldTypeSchema,
  icon: z.string(),
  required: z.boolean().optional(),
  placeholder: z.string().optional(),
  staticImageUrl: z.string().optional(),
  options: z.array(z.string()).optional(),
  fullWidth: z.boolean().optional(),
});

export const checklistItemConfigSchema = z.object({
  id: z.string(),
  label: z.string(),
});

const sectionBaseSchema = z.object({
  id: z.string(),
  number: z.number(),
  title: z.string(),
  description: z.string(),
  icon: z.string(),
  optional: z.boolean().optional(),
  whyItMatters: z.string().optional(),
  tip: z.string().optional(),
});

export const formSectionConfigSchema = sectionBaseSchema.extend({
  type: z.literal("form"),
  fields: z.array(fieldConfigSchema),
});

export const checklistSectionConfigSchema = sectionBaseSchema.extend({
  type: z.literal("checklist"),
  items: z.array(checklistItemConfigSchema),
});

export const notesSectionConfigSchema = sectionBaseSchema.extend({
  type: z.literal("notes"),
});

export const outcomeSectionConfigSchema = sectionBaseSchema.extend({
  type: z.literal("outcome"),
  items: z.array(checklistItemConfigSchema),
});

export const sectionConfigSchema = z.discriminatedUnion("type", [
  formSectionConfigSchema,
  checklistSectionConfigSchema,
  notesSectionConfigSchema,
  outcomeSectionConfigSchema,
]);

export const workspaceBrandSchema = z.object({
  name: z.string(),
  companyLabel: z.string(),
  primaryColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{3,8}$/, "primaryColor must be a hex color, e.g. #1061EC"),
});

export const workspaceFooterSchema = z.object({
  proTip: z.string(),
  helpText: z.string(),
  helpUrl: z.string().url().optional(),
});

export const workspaceContentSchema = z.object({
  productId: z.string(),
  brand: workspaceBrandSchema,
  footer: workspaceFooterSchema,
  sections: z.array(sectionConfigSchema).min(1, "A Workspace must have at least one section"),
});

export type FieldType = z.infer<typeof fieldTypeSchema>;
export type FieldConfig = z.infer<typeof fieldConfigSchema>;
export type ChecklistItemConfig = z.infer<typeof checklistItemConfigSchema>;
export type FormSectionConfig = z.infer<typeof formSectionConfigSchema>;
export type ChecklistSectionConfig = z.infer<typeof checklistSectionConfigSchema>;
export type NotesSectionConfig = z.infer<typeof notesSectionConfigSchema>;
export type OutcomeSectionConfig = z.infer<typeof outcomeSectionConfigSchema>;
export type SectionConfig = z.infer<typeof sectionConfigSchema>;
export type SectionType = SectionConfig["type"];
export type WorkspaceBrand = z.infer<typeof workspaceBrandSchema>;
export type WorkspaceFooter = z.infer<typeof workspaceFooterSchema>;
export type WorkspaceContent = z.infer<typeof workspaceContentSchema>;

/** Filled-in member data, keyed by section id — matches Studio's ChecklistData shape. */
export type WorkspaceData = Record<string, Record<string, string> | Record<string, boolean> | string>;
