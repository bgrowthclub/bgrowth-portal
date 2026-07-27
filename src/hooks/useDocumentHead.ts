import { useEffect } from "react";

/**
 * Sets document.title and the meta-description tag for the current page.
 * This is a client-rendered SPA with no SSR/pre-rendering, so this covers
 * the browser tab and any client-side share-preview reading — it is not
 * equivalent to crawler-visible per-page SEO, which would need a separate
 * SSR/prerender decision.
 */
export function useDocumentHead(title: string, description?: string) {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = title;

    let meta = document.querySelector('meta[name="description"]');
    const previousDescription = meta?.getAttribute("content") ?? null;

    if (description) {
      if (!meta) {
        meta = document.createElement("meta");
        meta.setAttribute("name", "description");
        document.head.appendChild(meta);
      }
      meta.setAttribute("content", description);
    }

    return () => {
      document.title = previousTitle;
      if (meta && previousDescription !== null) meta.setAttribute("content", previousDescription);
    };
  }, [title, description]);
}
