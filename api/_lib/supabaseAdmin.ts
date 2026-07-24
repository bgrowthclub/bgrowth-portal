import { createClient } from "@supabase/supabase-js";
import type { Database } from "../../src/types/database";

/**
 * Service-role Supabase client for server-side Publishing Engine routes
 * only. Never import this from anything that ships to the browser — it
 * bypasses Row Level Security entirely, which is exactly why it's confined
 * to /api (Vercel serverless functions run server-side, never bundled into
 * the Vite client build).
 *
 * Deliberately reads plain process.env vars, not import.meta.env: these
 * functions run under Node on Vercel, not through Vite.
 */
export function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables for the Publishing Engine's API routes.",
    );
  }

  return createClient<Database>(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
