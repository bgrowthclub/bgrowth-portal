import { supabase } from "@/services/supabaseClient";

/**
 * The member's BGrowth news e-mails (newsletter) — kept by the Website
 * (bgrowth.app, api/newsletter.ts, Portal migration 0036). Same Supabase
 * account, so the Portal sends the member's token and the Website answers
 * cross-origin. VITE_WEBSITE_URL overrides the address (e.g. a preview).
 */
const WEBSITE_URL = (import.meta.env.VITE_WEBSITE_URL as string | undefined)?.replace(/\/$/, "") || "https://bgrowth.app";

export const NEWSLETTER_AREAS = [
  { id: "business-entrepreneurship", label: "Business & Entrepreneurship" },
  { id: "careers-professions", label: "Careers & Professions" },
  { id: "languages", label: "Languages" },
  { id: "personal-finance", label: "Personal Finance" },
  { id: "productivity", label: "Productivity" },
  { id: "education", label: "Education" },
  { id: "health-wellness", label: "Health & Wellness" },
  { id: "family-lifestyle", label: "Family & Lifestyle" },
] as const;

export interface NewsletterSettings {
  email: string;
  status: "none" | "pending" | "subscribed" | "unsubscribed";
  /** Area ids; empty = every area. */
  interests: string[];
}

async function call(method: "GET" | "PUT", body?: unknown): Promise<NewsletterSettings> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Sign in to continue.");
  const response = await fetch(`${WEBSITE_URL}/api/newsletter?resource=me`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string } & NewsletterSettings;
  if (!response.ok || !json.ok) throw new Error(json.error ?? `Request failed (${response.status}).`);
  return json;
}

export const newsletterService = {
  get: () => call("GET"),
  save: (subscribed: boolean, interests: string[]) => call("PUT", { subscribed, interests }),
};
