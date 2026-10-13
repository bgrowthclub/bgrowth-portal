/**
 * Privacy-conscious GA4 helpers for the Portal.
 *
 * Tracking is disabled unless VITE_GA_MEASUREMENT_ID is configured.
 * Never pass names, email addresses, user IDs, free-form form values, or
 * other personal data to trackEvent().
 */
type Gtag = (...args: unknown[]) => void;

declare global {
  interface Window {
    dataLayer?: unknown[][];
    gtag?: Gtag;
  }
}

let initialized = false;

export function initAnalytics(measurementId?: string): void {
  if (initialized || !measurementId || typeof window === "undefined") return;
  initialized = true;

  window.dataLayer = window.dataLayer ?? [];
  window.gtag = function gtag(...args: unknown[]) {
    window.dataLayer?.push(args);
  };

  window.gtag("js", new Date());
  window.gtag("config", measurementId, { send_page_view: false });

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
  document.head.appendChild(script);
}

export function trackPageView(path: string, measurementId?: string): void {
  if (!measurementId || !window.gtag) return;
  // Route path only. Query strings are intentionally omitted to avoid
  // accidental collection of emails, tokens, or other sensitive URL values.
  window.gtag("event", "page_view", {
    page_path: path.split("?")[0].split("#")[0],
    page_title: document.title,
  });
}

export function trackEvent(
  eventName: string,
  params: Record<string, string | number | boolean> = {},
): void {
  if (!window.gtag) return;
  window.gtag("event", eventName, params);
}
