import { useCallback, useEffect, useRef, useState } from "react";

interface UseAsyncOptions {
  /** Translate raw errors to user-facing messages. Defaults to err.message. */
  mapError?: (error: unknown) => string;
}

interface UseAsyncResult<T> {
  data: T | null;
  isLoading: boolean;
  error: string | null;
  reload: () => void;
}

const defaultMapError = (err: unknown) =>
  err instanceof Error ? err.message : "An unexpected error occurred.";

export const useAsync = <T>(
  fetchFn: () => Promise<T>,
  deps: unknown[] = [],
  options: UseAsyncOptions = {},
): UseAsyncResult<T> => {
  const { mapError = defaultMapError } = options;
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchFnRef = useRef(fetchFn);
  fetchFnRef.current = fetchFn;

  const load = useCallback(() => {
    let cancelled = false;

    setIsLoading(true);
    setError(null);

    fetchFnRef
      .current()
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setIsLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          console.error("useAsync fetch failed:", err);
          setError(mapError(err));
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    const cancel = load();
    return cancel;
  }, [load]);

  return { data, isLoading, error, reload: load };
};
