import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthContext";
import { useAsync } from "@/hooks/useAsync";
import { productService } from "@/services/productService";
import { licenseService } from "@/services/licenseService";
import { Spinner } from "@/components/ui/Spinner";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { FetchErrorState } from "@/components/ui/FetchErrorState";
import { TrialWorkspaceCard } from "./components/TrialWorkspaceCard";
import type { ProductRow } from "@/types/database";

export function TrialSelectionPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<ProductRow | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const [activationError, setActivationError] = useState<string | null>(null);

  const {
    data: hasUsedTrial,
    isLoading: isCheckingTrial,
    error: trialCheckError,
    refetch: refetchTrialCheck,
  } = useAsync(() => (user ? licenseService.hasUsedTrial(user.id) : Promise.resolve(false)), [user?.id]);

  const {
    data: products,
    isLoading: isLoadingProducts,
    error: productsError,
    refetch: refetchProducts,
  } = useAsync(() => productService.fetchTrialEligible(), []);

  if (!isCheckingTrial && hasUsedTrial) {
    return <Navigate to="/library" replace />;
  }

  async function handleConfirm() {
    if (!user || !selected) return;
    setActivationError(null);
    setIsActivating(true);
    try {
      await licenseService.activateTrial(user.id, selected.id);
      navigate("/library", { replace: true, state: { justActivatedName: selected.name } });
    } catch (err) {
      setActivationError(err instanceof Error ? err.message : "Unable to activate your trial. Please try again.");
      setIsConfirmOpen(false);
    } finally {
      setIsActivating(false);
    }
  }

  const isLoading = isCheckingTrial || isLoadingProducts;
  const fetchError = trialCheckError ?? productsError;

  function handleRetry() {
    refetchTrialCheck();
    refetchProducts();
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      <div className="mx-auto max-w-2xl text-center">
        <span className="text-sm font-semibold uppercase tracking-wider text-primary">
          Free Trial Activation
        </span>
        <h1 className="mt-3 text-3xl font-bold text-navy-900 dark:text-white sm:text-4xl">
          Choose your one free Workspace
        </h1>
        <p className="mt-4 text-navy-500 dark:text-white/60">
          You may activate exactly one Workspace as a free trial. Choose carefully — this choice cannot
          be changed once confirmed.
        </p>
      </div>

      {activationError && (
        <p role="alert" className="mx-auto mt-8 max-w-md rounded-lg bg-red-50 px-4 py-2.5 text-center text-sm text-red-600 dark:bg-red-400/10 dark:text-red-300">
          {activationError}
        </p>
      )}

      {isLoading && (
        <div className="flex justify-center py-16">
          <Spinner className="h-8 w-8" />
        </div>
      )}

      {!isLoading && fetchError && (
        <div className="mx-auto mt-12 max-w-md">
          <FetchErrorState message="Couldn't load Workspaces right now." onRetry={handleRetry} />
        </div>
      )}

      {!isLoading && !fetchError && products && products.length === 0 && (
        <p className="mt-12 text-center text-sm text-navy-400 dark:text-white/40">
          New Workspaces are on the way — check back soon.
        </p>
      )}

      {!isLoading && !fetchError && products && products.length > 0 && (
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => (
            <TrialWorkspaceCard
              key={product.id}
              product={product}
              isSelected={selected?.id === product.id}
              onSelect={(chosen) => {
                setSelected(chosen);
                setIsConfirmOpen(true);
              }}
            />
          ))}
        </div>
      )}

      <ConfirmDialog
        isOpen={isConfirmOpen}
        title="Activate this Workspace?"
        description={
          <>
            You&apos;re about to activate <strong>{selected?.name}</strong> as your free trial.{" "}
            <span className="font-semibold text-navy-700 dark:text-white/80">
              This choice cannot be changed.
            </span>
          </>
        }
        confirmLabel="Activate Trial"
        isConfirming={isActivating}
        onConfirm={handleConfirm}
        onCancel={() => setIsConfirmOpen(false)}
      />
    </div>
  );
}
