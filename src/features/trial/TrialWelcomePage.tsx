import { Link, Navigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { formatTrialSentence } from "@/lib/trial";
import type { TrialUnit } from "@/types/database";

interface TrialWelcomeState {
  productName: string;
  productSlug: string;
  trialDuration: number | null;
  trialUnit: TrialUnit;
}

const WELCOME_GUIDE_URL = import.meta.env.VITE_WELCOME_GUIDE_URL as string | undefined;

/**
 * Shown once, right after a trial is activated (TrialSelectionPage navigates
 * here instead of straight to /library) — the "you're in" moment, separate
 * from just landing in a list. Only reachable via that navigation's state;
 * a direct visit (no state) redirects to /library rather than rendering
 * blank/incorrect content.
 */
export function TrialWelcomePage() {
  const location = useLocation();
  const state = location.state as TrialWelcomeState | null;

  if (!state?.productName) {
    return <Navigate to="/library" replace />;
  }

  const { productName, productSlug, trialDuration, trialUnit } = state;

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center px-6 py-12 text-center">
      <span className="text-sm font-semibold uppercase tracking-wider text-primary">Trial Activated</span>
      <h1 className="mt-3 text-3xl font-bold text-navy-900 dark:text-white sm:text-4xl">
        Welcome to {productName} 🎉
      </h1>
      <p className="mt-4 text-navy-500 dark:text-white/60">
        {trialDuration != null
          ? `You have full access for the next ${formatTrialSentence(trialDuration, trialUnit)}.`
          : "Your trial is active."}{" "}
        Explore every section — this is exactly what you'll get if you decide to keep it.
      </p>

      <div className="mt-8 flex w-full flex-col items-center gap-3 sm:flex-row sm:justify-center">
        <Link to={`/workspace/${productSlug}`} className="w-full sm:w-auto">
          <Button size="lg" className="w-full">
            Open Workspace
          </Button>
        </Link>
        {WELCOME_GUIDE_URL && (
          <a href={WELCOME_GUIDE_URL} target="_blank" rel="noopener noreferrer" className="w-full sm:w-auto">
            <Button size="lg" variant="secondary" className="w-full">
              Download Welcome Guide
            </Button>
          </a>
        )}
      </div>

      <Link to="/library" className="mt-6 text-sm font-medium text-navy-400 hover:text-primary dark:text-white/40">
        Go to My Library →
      </Link>
    </div>
  );
}
