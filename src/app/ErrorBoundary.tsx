import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * Top-level, app-wide safety net — there was no error boundary anywhere in
 * the app before this, so any uncaught render error (a null field, an
 * unexpected data shape from Studio, a third-party quirk) took the entire
 * app to a blank white screen with no recovery path. A full reload is the
 * only reliable recovery here (React error boundaries can't resume the
 * subtree that threw), so that's the one action offered.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("[ErrorBoundary] uncaught render error:", error, errorInfo.componentStack);
  }

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <p className="text-sm font-semibold uppercase tracking-wider text-primary">Something went wrong</p>
        <h1 className="mt-2 text-3xl font-bold text-navy-900 dark:text-white">We hit an unexpected error</h1>
        <p className="mt-3 max-w-md text-navy-500 dark:text-white/60">
          Reloading the page usually fixes this. If it keeps happening, reach out to the BGrowth Club team.
        </p>
        <Button className="mt-8" onClick={() => window.location.reload()}>
          Reload Page
        </Button>
      </div>
    );
  }
}
