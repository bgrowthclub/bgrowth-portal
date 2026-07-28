/**
 * TEMPORARY DIAGNOSTIC — instrumenting the "Save & Continue" insertBefore
 * crash after WorkspaceRuntimeErrorBoundary never caught it.
 *
 * That's itself a meaningful finding, not a bug in the boundary: React
 * Error Boundaries only catch errors thrown synchronously during render,
 * commit, or a class lifecycle method. They do NOT catch errors thrown
 * from event handlers, timers (setTimeout/rAF), Promise continuations, or
 * any other callback that runs outside React's own call stack — see
 * https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary.
 * A DOMException the boundary never sees is strong evidence the
 * insertBefore/removeChild call throwing it is happening OUTSIDE React's
 * commit phase entirely — most commonly a MutationObserver callback or
 * similar async DOM-watching code (browser extensions like Grammarly are
 * the most common real-world source of exactly this pattern: they inject
 * elements into form inputs, then asynchronously reconcile their own
 * wrapper nodes against whatever the page's own DOM does next).
 *
 * These two global handlers catch exactly what an Error Boundary can't:
 * - window.onerror / the window 'error' event: an uncaught synchronous
 *   exception anywhere on the page, including inside a timer/native
 *   callback that never touches React's render cycle at all.
 * - 'unhandledrejection': a Promise that rejected with nothing awaiting
 *   or .catch()-ing it.
 *
 * Both log the full stack trace. With production sourcemaps already
 * enabled (vite.config.ts, committed separately) and correctly deployed
 * (nothing in vercel.json excludes *.map files), that stack should map
 * back to original .ts/.tsx source in the browser's own DevTools instead
 * of stopping at the bundled WorkspaceViewerPage-*.js.
 *
 * Call installGlobalErrorDiagnostics() once, as early as possible (see
 * main.tsx). Remove this file and its call site once the root cause is
 * found and fixed.
 */
export function installGlobalErrorDiagnostics(): void {
  const previousOnError = window.onerror;
  window.onerror = (message, source, lineno, colno, error) => {
    console.error("[WORKSPACE DIAGNOSTIC] ==================== window.onerror ====================");
    console.error("[WORKSPACE DIAGNOSTIC] message:", message);
    console.error("[WORKSPACE DIAGNOSTIC] source:", source, "line:", lineno, "col:", colno);
    console.error("[WORKSPACE DIAGNOSTIC] error.name:", error?.name);
    console.error("[WORKSPACE DIAGNOSTIC] error.message:", error?.message);
    console.error("[WORKSPACE DIAGNOSTIC] error.stack (should map to original source via sourcemaps):", error?.stack);
    console.error("[WORKSPACE DIAGNOSTIC] =========================================================");
    // Preserve any previously-registered handler and the browser's own
    // default console logging — this augments, never suppresses.
    if (typeof previousOnError === "function") {
      return previousOnError(message, source, lineno, colno, error);
    }
    return false;
  };

  window.addEventListener("error", (event: ErrorEvent) => {
    // A broken <img>/<script> src also fires this event on window, but
    // without a real Error object — only log genuine uncaught exceptions.
    if (!event.error) return;
    console.error("[WORKSPACE DIAGNOSTIC] ==================== window 'error' event ====================");
    console.error("[WORKSPACE DIAGNOSTIC] message:", event.message);
    console.error("[WORKSPACE DIAGNOSTIC] filename:", event.filename, "line:", event.lineno, "col:", event.colno);
    console.error("[WORKSPACE DIAGNOSTIC] error.name:", event.error?.name);
    console.error("[WORKSPACE DIAGNOSTIC] error.message:", event.error?.message);
    console.error("[WORKSPACE DIAGNOSTIC] error.stack (should map to original source via sourcemaps):", event.error?.stack);
    console.error("[WORKSPACE DIAGNOSTIC] ================================================================");
  });

  window.addEventListener("unhandledrejection", (event: PromiseRejectionEvent) => {
    console.error("[WORKSPACE DIAGNOSTIC] ==================== unhandledrejection ====================");
    console.error("[WORKSPACE DIAGNOSTIC] reason:", event.reason);
    console.error("[WORKSPACE DIAGNOSTIC] reason?.stack (should map to original source via sourcemaps):", event.reason?.stack);
    console.error("[WORKSPACE DIAGNOSTIC] ============================================================");
  });

  console.log(
    "[WORKSPACE DIAGNOSTIC] Global error diagnostics installed (window.onerror, window 'error', 'unhandledrejection')",
  );
}
