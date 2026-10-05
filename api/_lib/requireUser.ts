import type { VercelRequest } from "@vercel/node";
import { getSupabaseAdmin } from "./supabaseAdmin.js";

/**
 * The signed-in member behind a request (Bearer access token), or null.
 * Endpoints that act for a member must take the member from here — never
 * from the request body.
 */
export async function requireUser(req: VercelRequest): Promise<{ id: string; email: string } | null> {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return null;
  const { data, error } = await getSupabaseAdmin().auth.getUser(token);
  if (error || !data.user || !data.user.email) return null;
  return { id: data.user.id, email: data.user.email };
}
