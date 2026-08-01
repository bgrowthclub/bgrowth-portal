import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Scrolls to the element whose id matches the current URL's hash fragment
 * (e.g. "#benefits") — call this once from the page that actually owns
 * those section ids (HomePage). Fires on mount (so a Link like
 * `to="/#benefits"` clicked from another route lands scrolled to the right
 * section once Home mounts) and again whenever the hash changes while
 * already on this page, since React Router's client-side navigation
 * doesn't trigger the browser's native "jump to anchor" behavior the way a
 * full page load does.
 */
export function useScrollToHash() {
  const location = useLocation();

  useEffect(() => {
    if (!location.hash) return;
    const id = location.hash.slice(1);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [location.hash]);
}
