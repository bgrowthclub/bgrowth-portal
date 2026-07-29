import type { ContentType } from "@/types/database";

/**
 * Single place that turns a content_type value into a "Product Type" label
 * — every surface that shows one (facet chips, card badges) reads through
 * here instead of formatting/guessing it inline. Mirrors formatPrice()'s
 * role in src/lib/pricing.ts.
 */
export const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  workspace: "Workspace",
  template: "Template",
  document: "Document",
  pdf: "PDF",
  course: "Course",
  calculator: "Calculator",
  ai_tool: "AI Tool",
  academy_lesson: "Academy Lesson",
};

export function formatContentType(contentType: ContentType): string {
  return CONTENT_TYPE_LABELS[contentType] ?? contentType;
}
