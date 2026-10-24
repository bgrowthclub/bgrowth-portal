import { z } from "zod";

/**
 * A Journey's content (products.content when content_type is 'journey',
 * migration 0068) — built in BGrowth Studio → Journeys, shown only on the
 * BGrowth Website. A Journey is ordered stages of actions; an action only
 * REFERENCES an existing product (by id) or Knowledge article (by slug) —
 * it never copies their content. The database resolves each reference when
 * the Website asks for it (portal.get_journey_outline), so a draft product
 * shows as "coming soon" without exposing anything about it.
 *
 * Stage names are free: the "Become a Mobile Notary" pilot uses Discover /
 * Qualify / Build / Launch / Operate, other Journeys can use others.
 */

const id = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9][a-z0-9-]*$/, "Use lower-case letters, numbers and dashes.");

// Two-letter US state / territory code (e.g. "CA").
const stateCode = z.string().regex(/^[A-Z]{2}$/, "Use a two-letter state code.");

const journeyActionObject = z.object({
  id,
  title: z.string().trim().min(1).max(160),
  instructions: z.string().max(4000).default(""),
  optional: z.boolean().default(false),
  // Estimated time in minutes; the Website adds them up per stage and Journey.
  estimatedMinutes: z.number().int().min(1).max(1440).optional(),
  kind: z.enum(["product", "article", "video", "link", "manual"]),
  productId: z.string().uuid().optional(),
  articleSlug: z.string().trim().min(1).max(200).optional(),
  url: z.string().url().startsWith("https://").max(2000).optional(),
  // Only for these states — and only once they are in validatedStates.
  states: z.array(stateCode).max(60).optional(),
  // What members see while the resource isn't published: "coming soon"
  // (default) or nothing at all (for internal or sensitive steps).
  whenUnavailable: z.enum(["coming_soon", "hide"]).default("coming_soon"),
});

export const journeyActionSchema = journeyActionObject.superRefine((action, ctx) => {
  const need = { product: "productId", article: "articleSlug", video: "url", link: "url", manual: null }[action.kind];
  if (need && !action[need as "productId" | "articleSlug" | "url"]) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: [need], message: `A ${action.kind} action needs ${need}.` });
  }
});

export const journeyStageSchema = z.object({
  id,
  title: z.string().trim().min(1).max(120),
  summary: z.string().max(1000).default(""),
  // Where the stage sits: getting started, good practices, or growing.
  level: z.enum(["beginner", "best_practices", "expansion"]).optional(),
  actions: z.array(journeyActionSchema).min(1).max(50),
});

function uniqueIds(content: { stages: { id: string; actions: { id: string }[] }[] }, ctx: z.RefinementCtx) {
  const stages = new Set<string>();
  const actions = new Set<string>();
  content.stages.forEach((stage, s) => {
    if (stages.has(stage.id)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["stages", s, "id"], message: "Stage ids must be unique." });
    stages.add(stage.id);
    stage.actions.forEach((action, a) => {
      if (actions.has(action.id)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["stages", s, "actions", a, "id"], message: "Action ids must be unique." });
      }
      actions.add(action.id);
    });
  });
}

const journeyBase = z.object({
  kind: z.literal("journey"),
  version: z.literal(1),
  goal: z.string().trim().min(1).max(300),
  intro: z.string().max(4000).default(""),
  completionMessage: z.string().max(2000).default(""),
  // Who the Journey is for, and what the member should have at the end.
  audience: z.string().trim().max(500).default(""),
  outcomes: z.array(z.string().trim().min(1).max(200)).max(10).default([]),
  // Always shown: general information does not replace each state's law.
  notice: z.string().trim().min(1).max(1000),
  // States whose specific requirements were checked; [] = general content only.
  validatedStates: z.array(stateCode).max(60).default([]),
  stages: z.array(journeyStageSchema).min(1).max(12),
});

export const journeyContentSchema = journeyBase.superRefine(uniqueIds);

// A draft may be saved unfinished: no stages yet, stages without actions.
export const journeyDraftContentSchema = journeyBase
  .extend({
    goal: z.string().trim().max(300).default(""),
    notice: z.string().trim().max(1000).default(""),
    stages: z
      .array(
        journeyStageSchema.extend({
          title: z.string().trim().max(120),
          actions: z.array(journeyActionObject.extend({ title: z.string().trim().max(160) })).max(50),
        }),
      )
      .max(12),
  })
  .superRefine(uniqueIds);

export type JourneyContent = z.infer<typeof journeyContentSchema>;
