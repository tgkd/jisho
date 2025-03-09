import { useState, useCallback } from "react";

type FetchFunction = (signal?: AbortSignal | null) => Promise<Response>;

interface UseFetchResult<T> {
  response: T | null;
  error: Error | null;
  abort: () => void;
  isLoading: boolean;
  fetchData: () => Promise<void>;
}

/**
 * Custom hook for handling fetch requests with JSON parsing and abort capability
 * @param fetchFn - Function that performs the fetch operation and returns a Response
 * @returns Object containing parsed response, error, abort function, loading state, and manual fetch function
 */
export const useFetch = <T>(
  fetchFn: FetchFunction,
  onSuccess?: (data: T) => void
): UseFetchResult<T> => {
  const [response, setResponse] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [abortController, setAbortController] =
    useState<AbortController | null>(null);

  const abort = useCallback(() => {
    if (abortController) {
      abortController.abort();
    }
  }, [abortController]);

  const fetchData = useCallback(async () => {
    // Abort any existing request
    abort();

    const controller = new AbortController();
    setAbortController(controller);

    try {
      setIsLoading(true);
      setError(null);

      const res = await fetchFn(controller.signal);

      if (!res.ok) {
        throw new Error(`HTTP error! Status: ${res.status}`);
      }

      const data = (await res.json()) as T;
      setResponse(data);
      onSuccess?.(data);
    } catch (err) {
      if (err instanceof Error && err.name !== "AbortError") {
        setError(err as Error);
      }
    } finally {
      setIsLoading(false);
    }
  }, [fetchFn, abort]);

  return { response, error, abort, isLoading, fetchData };
};
