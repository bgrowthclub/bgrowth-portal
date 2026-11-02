import { z } from "zod";

/**
 * A course's content (products.content when content_type is 'course') —
 * built in BGrowth Studio → Academy, worked through in BGrowth Workspace.
 *
 * A course is a product like any other, so it inherits price, free/paid,
 * bundles, plan inclusion, coupons, reviews and the release flow, and the
 * access rule that serves `content` only to someone who owns it. See
 * ARCHITECTURE.md §10 in the Website repo, and VISION.md's "Growth Systems,
 * not courses": a course teaches the decision and hands over the Growth
 * System that does the work — that handoff is the `product` block.
 *
 * Shape: modules → lessons → blocks, the same idea as a Journey's stages →
 * actions. A lesson never copies a Growth System's content; it points at it.
 */

const id = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/, "Use letters, numbers, dashes and underscores.");

const httpsUrl = z.string().trim().url().startsWith("https://").max(2000);

// What a lesson is made of. Every kind is something the ecosystem already
// has; nothing here is author-written markup, so no sanitizer is needed.
const courseBlock = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text"), body: z.string().trim().min(1).max(20000) }),
  z.object({
    type: z.literal("image"),
    url: httpsUrl,
    alt: z.string().trim().max(300).optional(),
    caption: z.string().trim().max(300).optional(),
  }),
  // Played by its own host (YouTube, TikTok, Instagram) — BGrowth stores none.
  z.object({ type: z.literal("video"), url: httpsUrl, title: z.string().trim().max(200).optional() }),
  // A file from the Studio's File Library.
  z.object({
    type: z.literal("file"),
    url: httpsUrl,
    label: z.string().trim().max(200).optional(),
    note: z.string().trim().max(500).optional(),
  }),
  z.object({
    type: z.literal("link"),
    url: httpsUrl,
    label: z.string().trim().max(200).optional(),
    note: z.string().trim().max(500).optional(),
  }),
  // The handoff: the Growth System, Journey, calculator, download or article
  // this lesson gives the student, by its address on the Website.
  // A short self-check inside a lesson (02/11/2026). Deliberately NOT a
  // gate: the student answers, sees at once whether they got it right and
  // why, and moves on either way — no passing grade, no limit on retries.
  // Wix's own programs only use a passing grade to decide who COMPLETES a
  // program, not to block the next step; if BGrowth ever issues
  // certificates, that is when a passing grade earns its place.
  z.object({
    type: z.literal("quiz"),
    title: z.string().trim().max(200).optional(),
    questions: z
      .array(
        z.object({
          // Stable: the student's answer is saved against it, so renaming
          // the text keeps the answer and changing the id loses it.
          id,
          prompt: z.string().trim().min(1).max(1000),
          options: z
            .array(z.object({ id, text: z.string().trim().min(1).max(300) }))
            .min(2)
            .max(6),
          // The id of the one right option.
          answer: id,
          // Shown after answering, right or wrong — this is where a quiz
          // teaches instead of just scoring.
          explanation: z.string().trim().max(1000).optional(),
        }),
      )
      .min(1)
      .max(30),
  }),
  z.object({
    type: z.literal("product"),
    slug: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .regex(/^[a-z0-9][a-z0-9-]*$/, "Use the product's address: lower-case letters, numbers and dashes."),
    label: z.string().trim().max(200).optional(),
    note: z.string().trim().max(500).optional(),
  }),
]);

const courseLesson = z.object({
  id,
  title: z.string().trim().min(1).max(200),
  // How long it takes; the Website adds them up per module and course.
  minutes: z.number().int().min(1).max(1440).optional(),
  blocks: z.array(courseBlock).max(100).default([]),
});

const courseModule = z.object({
  id,
  title: z.string().trim().min(1).max(200),
  summary: z.string().trim().max(1000).optional(),
  lessons: z.array(courseLesson).min(1).max(100),
});

export const courseContentSchema = z
  .object({
    kind: z.literal("course"),
    version: z.literal(1),
    intro: z.string().trim().max(4000).optional(),
    // What the student will be able to do by the end.
    outcomes: z.array(z.string().trim().min(1).max(300)).max(10).optional(),
    modules: z.array(courseModule).min(1).max(60),
  })
  .superRefine((course, ctx) => {
    // Ids are how progress is kept (workspace_instances, data.kind 'course'),
    // so a repeated one would make two lessons share a tick.
    const moduleIds = new Set<string>();
    const lessonIds = new Set<string>();
    // Quiz answers are saved per question id, in the same record as the
    // ticked lessons — so a repeated id would make two questions share one
    // answer, exactly as a repeated lesson id would share a tick.
    const questionIds = new Set<string>();
    course.modules.forEach((module, m) => {
      if (moduleIds.has(module.id))
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["modules", m, "id"], message: "Two modules share this id." });
      moduleIds.add(module.id);
      module.lessons.forEach((lesson, l) => {
        if (lessonIds.has(lesson.id))
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["modules", m, "lessons", l, "id"],
            message: "Two lessons share this id — progress is kept per lesson id.",
          });
        lessonIds.add(lesson.id);

        lesson.blocks.forEach((block, b) => {
          if (block.type !== "quiz") return;
          block.questions.forEach((question, q) => {
            const at = ["modules", m, "lessons", l, "blocks", b, "questions", q] as const;
            if (questionIds.has(question.id))
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: [...at, "id"],
                message: "Two questions share this id — an answer is saved per question id.",
              });
            questionIds.add(question.id);

            const optionIds = new Set<string>();
            question.options.forEach((option, o) => {
              if (optionIds.has(option.id))
                ctx.addIssue({ code: z.ZodIssueCode.custom, path: [...at, "options", o, "id"], message: "Two options share this id." });
              optionIds.add(option.id);
            });
            if (!optionIds.has(question.answer))
              ctx.addIssue({ code: z.ZodIssueCode.custom, path: [...at, "answer"], message: "The right answer must be one of the options." });
          });
        });
      });
    });
  });

export type CourseContent = z.infer<typeof courseContentSchema>;
