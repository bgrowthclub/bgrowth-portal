// What visitors search for in the Browse catalog — the same daily totals
// the Website keeps (Portal migration 0052, portal.site_search_stats), the
// first data source for the future Product Discovery in Studio's Content
// Engine. Sent to the Website's public tracking function (bgrowth.app/api/
// ingles?action=search), so the Portal needs no new function. Nothing
// about the visitor is sent or kept.

const ENDPOINT = "https://bgrowth.app/api/ingles?action=search";

const isAutomated = () => typeof navigator !== "undefined" && navigator.webdriver === true;

/** Counts a finished search once per browser session. */
export function recordCatalogSearch(query: string, results: number) {
  const q = query.trim().replace(/\s+/g, " ").toLowerCase();
  if (q.length < 3 || isAutomated()) return;
  const key = `bgrowth.search.${q}`;
  try {
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
  } catch {
    /* private mode: count anyway */
  }
  try {
    // text/plain keeps it a "simple" cross-site request (no preflight).
    const payload = new Blob([JSON.stringify({ q, results })], { type: "text/plain" });
    if (navigator.sendBeacon?.(ENDPOINT, payload)) return;
    void fetch(ENDPOINT, { method: "POST", body: payload, mode: "no-cors", keepalive: true });
  } catch {
    /* counting never breaks the page */
  }
}
