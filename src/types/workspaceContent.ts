/**
 * Re-exports the Workspace JSON types from src/schemas/workspaceContent.schema.ts,
 * which defines them as zod schemas so the Publishing Engine's validation and
 * these TS types can never drift apart. Existing imports from
 * "@/types/workspaceContent" keep working unchanged — this file is now just
 * the type-only entry point; import the schemas themselves from
 * "@/schemas/workspaceContent.schema" when you need runtime validation.
 */
export type {
  FieldType,
  FieldConfig,
  ChecklistItemConfig,
  SectionType,
  FormSectionConfig,
  ChecklistSectionConfig,
  NotesSectionConfig,
  OutcomeSectionConfig,
  SectionConfig,
  WorkspaceBrand,
  WorkspaceFooter,
  WorkspaceContent,
  WorkspaceData,
} from "@/schemas/workspaceContent.schema";
