import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase environment variables. Copy .env.example to .env and set " +
      "VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY before running the app.",
  );
}

// db.schema: "portal" targets the Portal's dedicated schema — this database
// is shared with the existing BGrowth Academy LMS, which lives in its own
// schemas (lms_core_identity, lms_course_engine, lms_enrollment_progress).
// Requires "portal" to be added to this Supabase project's exposed schemas
// (Project Settings → API → Exposed schemas) or every query below 404s —
// see DEPLOYMENT.md. auth.* calls are unaffected by this setting; Auth has
// its own API surface, not routed through db.schema.
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  db: { schema: "portal" },
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
