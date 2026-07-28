import { Component, type ErrorInfo, type ReactNode } from "react";

interface WorkspaceRuntimeErrorBoundaryProps {
  children: ReactNode;
}

interface WorkspaceRuntimeErrorBoundaryState {
  error: Error | null;
}

/**
 * TEMPORARY DIAGNOSTIC — instrumenting the "Save & Continue" insertBefore
 * crash now that Studio's Template Integrity Validator has ruled out
 * duplicate section/field/item ids as the cause. Wraps WorkspaceAccordion
 * specifically so a crash there is caught with its full React component
 * stack (componentStack below — this is the exact call chain of React
 * components at the moment of the crash, the single most useful piece of
 * data for finding which component's reconciliation actually failed),
 * instead of only bubbling up to the app-wide ErrorBoundary
 * (src/app/ErrorBoundary.tsx), which catches it too far from the source to
 * show anything but a generic message. Remove this file, its import in
 * WorkspaceRenderer.tsx, and the [WORKSPACE DIAGNOSTIC] logs in
 * WorkspaceAccordion.tsx/WorkspaceSectionShell.tsx once the root cause is
 * found and fixed.
 */
export class WorkspaceRuntimeErrorBoundary extends Component<
  WorkspaceRuntimeErrorBoundaryProps,
  WorkspaceRuntimeErrorBoundaryState
> {
  state: WorkspaceRuntimeErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): WorkspaceRuntimeErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[WORKSPACE DIAGNOSTIC] ==================== CRASH CAUGHT ====================");
    console.error("[WORKSPACE DIAGNOSTIC] error.message:", error.message);
    console.error("[WORKSPACE DIAGNOSTIC] error.name:", error.name);
    console.error("[WORKSPACE DIAGNOSTIC] error.stack:", error.stack);
    console.error("[WORKSPACE DIAGNOSTIC] React component stack (where in the tree this happened):", errorInfo.componentStack);
    console.error("[WORKSPACE DIAGNOSTIC] =======================================================");
  }

  render() {
    if (this.state.error) {
      return (
        <div className="no-print rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          <p className="font-semibold">Workspace crashed (diagnostic mode)</p>
          <p className="mt-1 text-xs">{this.state.error.message}</p>
          <p className="mt-2 text-xs text-red-500">
            Full details, including the React component stack, were logged to the browser console — search for
            "[WORKSPACE DIAGNOSTIC]".
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}
