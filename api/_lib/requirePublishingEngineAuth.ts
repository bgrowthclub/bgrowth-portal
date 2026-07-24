import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * Shared-secret check for every Publishing Engine route. Studio never holds
 * this secret in browser code — it calls its own serverless proxy
 * (bgrowth-studio/api/publish.js), which attaches this header server-side.
 * Returns true if the request is authorized; writes a 401 and returns false
 * otherwise, so callers can just `if (!requirePublishingEngineAuth(req, res)) return;`.
 */
export function requirePublishingEngineAuth(req: VercelRequest, res: VercelResponse): boolean {
  const expected = process.env.PUBLISHING_ENGINE_SECRET;
  if (!expected) {
    res.status(500).json({ ok: false, error: "PUBLISHING_ENGINE_SECRET is not configured on the Portal." });
    return false;
  }

  const provided = req.headers["x-publishing-engine-secret"];
  if (provided !== expected) {
    res.status(401).json({ ok: false, error: "Unauthorized" });
    return false;
  }

  return true;
}
