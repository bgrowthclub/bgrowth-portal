import type { LicenseWithProduct } from "@/types/workspace";
import { deriveAccessState } from "@/lib/workspaceAccess";
import { AccessStateBadge } from "@/components/ui/Badge";

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function LicenseRowItem({ license }: { license: LicenseWithProduct }) {
  const accessState = deriveAccessState(license);

  return (
    <div className="flex items-center justify-between gap-4 border-b border-navy-100/60 py-4 last:border-0 dark:border-white/10">
      <div>
        <p className="font-medium text-navy-900 dark:text-white">
          {license.products?.name ?? "Workspace"}
        </p>
        <p className="text-xs text-navy-400 dark:text-white/40">
          Activated {formatDate(license.activated_at)}
          {license.expires_at && ` · Expires ${formatDate(license.expires_at)}`}
        </p>
      </div>
      <AccessStateBadge state={accessState} />
    </div>
  );
}
