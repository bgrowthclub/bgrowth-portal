import { Link, useSearchParams } from "react-router-dom";
import { notaryWorkspaceContent } from "./fixtures/notaryWorkspaceContent";
import { notaryWorkspaceData } from "./fixtures/notaryWorkspaceData";
import { notaryWorkspaceDataEmpty } from "./fixtures/notaryWorkspaceDataEmpty";
import { notaryWorkspaceDataLong } from "./fixtures/notaryWorkspaceDataLong";
import { DocumentWorkspaceRenderer } from "./DocumentWorkspaceRenderer";
import type { WorkspaceData } from "@/types/workspaceContent";

type Scenario = "populated" | "empty" | "long";

const SCENARIOS: Record<Scenario, { label: string; data: WorkspaceData; instanceLabel: string }> = {
  populated: { label: "Populated", data: notaryWorkspaceData, instanceLabel: "Preview — Elena Marquez" },
  empty: { label: "Mostly Empty", data: notaryWorkspaceDataEmpty, instanceLabel: "Preview — Elena Marquez (just started)" },
  long: { label: "Long Content", data: notaryWorkspaceDataLong, instanceLabel: "Preview — Elena Marquez-Whitfield (multi-doc signing)" },
};

/**
 * Isolated, dev-only preview for Document V1 (see ../../../app/routes.tsx —
 * this route only exists when `import.meta.env.DEV`, so it never ships in a
 * production build and can never be reached in production).
 *
 * Renders the Notary Appointment Checklist™'s real, currently-published
 * content (copied verbatim from supabase/seed.sql into ./fixtures) against
 * three separate data fixtures — populated, mostly empty, and long-form —
 * switchable via ?scenario=populated|empty|long, so the same renderer's
 * pagination can be validated across very different content lengths without
 * touching any real workspace_instances row. No Supabase query, no auth.
 */
export function DocumentV1PreviewPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get("scenario");
  const scenario: Scenario = requested === "empty" || requested === "long" ? requested : "populated";
  const { data, instanceLabel } = SCENARIOS[scenario];

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <div className="no-print card mb-4 flex flex-col gap-1 rounded-xl border border-amber-300 bg-amber-50 p-4 text-[13px] text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
        <strong>Document V1 preview</strong> — isolated test harness using fixture data, not a real product or saved
        instance. This is the same DocumentWorkspaceRenderer the real Workspace route now uses; only the data below is
        fake.
      </div>
      <div className="no-print flex flex-wrap items-center justify-between gap-4">
        <Link to="/" className="text-sm font-medium text-primary hover:underline">
          ← Back to Portal
        </Link>
        <div className="flex gap-2 rounded-lg border border-navy-100 bg-white p-1 dark:border-white/10 dark:bg-white/5">
          {(Object.keys(SCENARIOS) as Scenario[]).map((key) => (
            <button
              key={key}
              onClick={() => setSearchParams(key === "populated" ? {} : { scenario: key })}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                scenario === key
                  ? "bg-workspace-500 text-white"
                  : "text-navy-500 hover:bg-navy-50 dark:text-white/60 dark:hover:bg-white/10"
              }`}
            >
              {SCENARIOS[key].label}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-4">
        {/* key forces a clean remount per scenario — no stale interactive fill state carried over from a previous scenario's accordion. */}
        <DocumentWorkspaceRenderer
          key={scenario}
          content={notaryWorkspaceContent}
          initialData={data}
          instanceLabel={instanceLabel}
        />
      </div>
    </div>
  );
}
