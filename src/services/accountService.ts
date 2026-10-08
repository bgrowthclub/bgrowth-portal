import { supabase } from "@/services/supabaseClient";

/**
 * Asking to delete the account and its data — kept by the Website
 * (bgrowth.app, api/account.ts, Portal migration 0039), where the team
 * reviews and completes it. Same pattern as newsletterService: the
 * member's token, answered cross-origin. VITE_WEBSITE_URL overrides the
 * address (e.g. a preview).
 */
const WEBSITE_URL = (import.meta.env.VITE_WEBSITE_URL as string | undefined)?.replace(/\/$/, "") || "https://bgrowth.app";

export interface DeletionRequest {
  id: string;
  status: "pending" | "cancelled" | "completed" | "rejected";
  requested_at: string;
  admin_note: string | null;
}

async function call(method: "GET" | "POST" | "DELETE", body?: unknown): Promise<DeletionRequest | null> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Sign in to continue.");
  const response = await fetch(`${WEBSITE_URL}/api/account?resource=deletion`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string; request?: DeletionRequest | null };
  if (!response.ok || !json.ok) throw new Error(json.error ?? `Request failed (${response.status}).`);
  return json.request ?? null;
}

export const accountService = {
  getDeletionRequest: () => call("GET"),
  requestDeletion: (reason: string) => call("POST", { reason, source: "portal" }),
  cancelDeletion: () => call("DELETE"),
};
