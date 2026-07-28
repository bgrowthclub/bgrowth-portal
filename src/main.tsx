import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { ErrorBoundary } from "@/app/ErrorBoundary";
import { installGlobalErrorDiagnostics } from "@/app/globalErrorDiagnostics";
import "./styles/index.css";

// TEMPORARY DIAGNOSTIC — see src/app/globalErrorDiagnostics.ts for why this
// exists (catching what WorkspaceRuntimeErrorBoundary structurally can't).
// Installed before the first render so it's active for the entire session.
// Remove this call once the "Save & Continue" insertBefore crash's root
// cause is found and fixed.
installGlobalErrorDiagnostics();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
