import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(dirname, "./src"),
    },
  },
  build: {
    // TEMP DIAGNOSTIC — the currently-deployed bundle has no sourcemaps at
    // all (this was previously unset, defaulting to false), so a production
    // stack trace like "WorkspaceViewerPage-CvWEfZ_c.js:7830" can't be
    // mapped back to source by anyone, including in the browser's own
    // DevTools. Enabling this means the *next* deploy's crashes map
    // automatically in Chrome/browser DevTools — no manual mapping needed.
    sourcemap: true,
  },
});
