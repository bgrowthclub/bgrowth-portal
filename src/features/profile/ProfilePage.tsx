import { useAuth } from "@/features/auth/AuthContext";
import { useAsync } from "@/hooks/useAsync";
import { userService } from "@/services/userService";
import { licenseService } from "@/services/licenseService";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { LicenseRowItem } from "./components/LicenseRow";

export function ProfilePage() {
  const { user } = useAuth();

  const { data: profile, isLoading: isLoadingProfile } = useAsync(
    () => (user ? userService.fetchProfile(user.id) : Promise.resolve(null)),
    [user?.id],
  );
  const { data: licenses, isLoading: isLoadingLicenses } = useAsync(
    () => (user ? licenseService.fetchForUserWithProduct(user.id) : Promise.resolve([])),
    [user?.id],
  );

  const isLoading = isLoadingProfile || isLoadingLicenses;

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-bold text-navy-900 dark:text-white">Profile</h1>

      <Card className="mt-6 p-6">
        <h2 className="font-semibold text-navy-900 dark:text-white">Personal Information</h2>
        {isLoadingProfile ? (
          <div className="mt-4 flex justify-center">
            <Spinner />
          </div>
        ) : (
          <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-navy-400 dark:text-white/40">
                Full name
              </dt>
              <dd className="mt-1 text-sm text-navy-900 dark:text-white">
                {profile?.full_name ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-navy-400 dark:text-white/40">
                Email
              </dt>
              <dd className="mt-1 text-sm text-navy-900 dark:text-white">{user?.email ?? "—"}</dd>
            </div>
          </dl>
        )}
      </Card>

      <Card className="mt-6 p-6">
        <h2 className="font-semibold text-navy-900 dark:text-white">Licenses &amp; Purchases</h2>
        {isLoading ? (
          <div className="mt-4 flex justify-center">
            <Spinner />
          </div>
        ) : licenses && licenses.length > 0 ? (
          <div className="mt-2">
            {licenses.map((license) => (
              <LicenseRowItem key={license.id} license={license} />
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-navy-500 dark:text-white/60">
            You don&apos;t have any active licenses yet.
          </p>
        )}
      </Card>
    </div>
  );
}
