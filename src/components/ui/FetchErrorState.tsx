import { Button } from "./Button";

interface FetchErrorStateProps {
  message?: string;
  onRetry: () => void;
}

/** Shared "couldn't load this" state for any page that reads via useAsync — pairs with its refetch(). */
export function FetchErrorState({ message = "Something went wrong loading this page.", onRetry }: FetchErrorStateProps) {
  return (
    <div className="card flex flex-col items-center gap-4 p-10 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-500 dark:bg-red-400/10 dark:text-red-300">
        <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden="true">
          <path
            d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <p className="text-sm text-navy-500 dark:text-white/60">{message}</p>
      <Button variant="secondary" size="sm" onClick={onRetry}>
        Try Again
      </Button>
    </div>
  );
}
