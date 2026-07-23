import { Link } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthContext";
import { useAsync } from "@/hooks/useAsync";
import { productService } from "@/services/productService";
import { licenseService } from "@/services/licenseService";
import { attachAccessState } from "@/lib/workspaceAccess";
import { Spinner } from "@/components/ui/Spinner";
import { Button } from "@/components/ui/Button";
import { LibraryWorkspaceCard } from "./components/LibraryWorkspaceCard";

export function MyLibraryPage() {
  const { user } = useAuth();

  const { data: products, isLoading: isLoadingProducts } = useAsync(
    () => productService.fetchPublished(),
    [],
  );
  const { data: licenses, isLoading: isLoadingLicenses } = useAsync(
    () => (user ? licenseService.fetchForUser(user.id) : Promise.resolve([])),
    [user?.id],
  );

  const isLoading = isLoadingProducts || isLoadingLicenses;
  const hasAnyLicense = (licenses?.length ?? 0) > 0;
  const workspaces = products && licenses ? attachAccessState(products, licenses) : null;

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy-900 dark:text-white">My Library</h1>
          <p className="mt-1 text-sm text-navy-500 dark:text-white/60">
            Every BGrowth Workspace — trial, purchased, or available to buy.
          </p>
        </div>
      </div>

      {!isLoading && !hasAnyLicense && (
        <div className="card mt-6 flex flex-col items-center gap-4 p-8 text-center sm:flex-row sm:justify-between sm:text-left">
          <div>
            <h2 className="font-semibold text-navy-900 dark:text-white">
              You haven&apos;t activated your free trial yet
            </h2>
            <p className="mt-1 text-sm text-navy-500 dark:text-white/60">
              Pick one Workspace to try, completely free for 14 days.
            </p>
          </div>
          <Link to="/trial-selection">
            <Button>Choose a Free Trial</Button>
          </Link>
        </div>
      )}

      {isLoading && (
        <div className="flex justify-center py-16">
          <Spinner className="h-8 w-8" />
        </div>
      )}

      {!isLoading && workspaces && (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {workspaces.map((workspace) => (
            <LibraryWorkspaceCard key={workspace.id} workspace={workspace} />
          ))}
        </div>
      )}
    </div>
  );
}
