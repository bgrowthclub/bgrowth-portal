import { Link } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface WorkspaceCompletionPanelProps {
  workspaceName: string;
  onReviewSections: () => void;
}

/** Shown once the member finishes the last section — the missing "you're done" moment. */
export function WorkspaceCompletionPanel({ workspaceName, onReviewSections }: WorkspaceCompletionPanelProps) {
  return (
    <div className="card flex flex-col items-center gap-3 border-workspace-200 bg-workspace-50 p-8 text-center dark:border-workspace-500/20 dark:bg-workspace-500/10">
      <CheckCircle2 className="h-10 w-10 text-workspace-500" />
      <h2 className="text-xl font-bold text-navy-900 dark:text-white">Workspace complete — nice work!</h2>
      <p className="max-w-md text-sm text-navy-500 dark:text-white/60">
        You&apos;ve been through every section of {workspaceName}. You can head back to your Library, or
        keep reviewing and updating any section below.
      </p>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
        <Link to="/library">
          <Button size="sm">Back to My Library</Button>
        </Link>
        <Button size="sm" variant="secondary" onClick={onReviewSections}>
          Review Sections
        </Button>
      </div>
    </div>
  );
}
