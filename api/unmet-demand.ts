import type { VercelRequest, VercelResponse } from "@vercel/node";
import { z } from "zod";
import { getSupabaseAdmin } from "../_lib/supabaseAdmin.js";

const contentTypes = [
  "workspace", "template", "document", "course", "calculator", "ai_tool", "academy_lesson",
] as const;

const bodySchema = z.object({
  query: z.string().trim().min(2).max(100),
  categorySlug: z.string().trim().max(80).optional(),
  contentType: z.enum(contentTypes).optional(),
  filters: z.object({
    freeOnly: z.boolean().optional(),
    tags: z.array(z.string().trim().max(40)).max(8).optional(),
  }).optional(),
});

function normalizeQuery(input: string): string | null {
  const value = input
    .normalize("NFKC")
    .toLowerCase()
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, " ")
    .replace(/\b\+?\d[\d\s().-]{7,}\d\b/g, " ")
    .replace(/[^\p{L}\p{N}\s'-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);
  if (value.length < 2) return null;
  // If an email-like value survived normalization, discard rather than store it.
  if (/[\w.+-]+@[\w.-]+\.[a-z]{2,}/i.test(value)) return null;
  return value;
}

/**
 * Record aggregate catalog searches that returned no results.
 * No authentication is required, but input is constrained and PII-like
 * strings are removed before persistence. The client never receives table data.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) return res.status(422).json({ ok: false, error: "Invalid request" });

  const normalizedQuery = normalizeQuery(parsed.data.query);
  if (!normalizedQuery) return res.status(200).json({ ok: true, recorded: false });

  const categorySlug = (parsed.data.categorySlug ?? "").toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 80);
  const contentType = parsed.data.contentType ?? "";
  const filterSignature = JSON.stringify({
    freeOnly: parsed.data.filters?.freeOnly === true,
    tags: [...new Set((parsed.data.filters?.tags ?? []).map((tag) =>
      tag.toLowerCase().replace(/[^\p{L}\p{N}-]/gu, "").slice(0, 40),
    ).filter(Boolean))].sort().slice(0, 8),
  });

  try {
    // This endpoint only uses the server-side service role. The public client
    // cannot query or enumerate the aggregate table because RLS has no public policy.
    const supabase = getSupabaseAdmin() as any;
    const { error } = await supabase.rpc("record_unmet_demand", {
      p_normalized_query: normalizedQuery,
      p_category_slug: categorySlug,
      p_content_type: contentType,
      p_filter_signature: filterSignature,
    });
    if (error) throw error;
    return res.status(200).json({ ok: true, recorded: true });
  } catch {
    // Do not expose database details or fail the browse experience.
    return res.status(503).json({ ok: false, error: "Could not record search demand" });
  }
}
