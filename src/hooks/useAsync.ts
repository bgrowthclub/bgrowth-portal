import { useEffect, useState } from "react";

interface AsyncState<T> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
}

/** Small shared helper for the common "fetch on mount" pattern used across features. */
export function useAsync<T>(factory: () => Promise<T>, deps: unknown[] = []): AsyncState<T> {
  const [state, setState] = useState<AsyncState<T>>({ data: null, isLoading: true, error: null });

  useEffect(() => {
    let isMounted = true;
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    factory()
      .then((data) => {
        if (isMounted) setState({ data, isLoading: false, error: null });
      })
      .catch((err) => {
        if (isMounted) {
          setState({
            data: null,
            isLoading: false,
            error: err instanceof Error ? err.message : "Something went wrong.",
          });
        }
      });

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return state;
}
