import { FetchResponse } from "expo/build/winter/fetch/FetchResponse";
import { useState, useCallback } from "react";

type ResponseType<T> = T | Blob | string | null;

interface UseFetchResult<T> {
  response: ResponseType<T>;
  error: Error | null;
  abort: () => void;
  isLoading: boolean;
  fetchData: () => Promise<void>;
}

interface FetchOptions<T> {
  type?: "json" | "text" | "blob";
  headers?: HeadersInit;
}

export const useFetch = <T>(
  fetchFn: (signal?: AbortSignal | null) => Promise<Response | FetchResponse>,
  options: FetchOptions<T> = { type: "json" },
  onSuccess?: (data: ResponseType<T>) => void,
  onError?: (error: Error) => void
): UseFetchResult<T> => {
  const [response, setResponse] = useState<ResponseType<T>>(null);
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

      if (options?.type === "json") {
        const data = (await res.json()) as T;
        setResponse(data);
        onSuccess?.(data);
        return;
      }
      if (options?.type === "text") {
        const data = await res.text();
        setResponse(data);
        onSuccess?.(data);
        return;
      }

      if (options?.type === "blob") {
        const data = await res.blob();
        setResponse(data);
        onSuccess?.(data);
        return;
      }

      const data = (await res.json()) as T;
      setResponse(data);
      onSuccess?.(data);
    } catch (err) {
      if (err instanceof Error && err.name !== "AbortError") {
        setError(err as Error);
      }
      onError?.(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, [fetchFn, abort]);

  return { response, error, abort, isLoading, fetchData };
};

export const useTextStream = (
  fetchFn: (...args: any[]) => Promise<any>,
  onChunk: (chunk: string) => void,
  onComplete?: (fullText: string, reqParams: any[]) => void
) => {
  const [fullText, setFullText] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = async (...args: any[]) => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetchFn(...args);
      if (!response.ok) {
        throw new Error(
          `HTTP error: ${response.status} ${response.statusText}`
        );
      }

      const reader = response.body?.getReader();
      if (!reader) {
        const text = await response.text();
        onChunk(text);
        return text;
      }

      const decoder = new TextDecoder();
      let fullText = "";

      try {
        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            break;
          }

          const chunk = decoder.decode(value, { stream: true });
          fullText += chunk;
          onChunk(chunk);
        }

        const remaining = decoder.decode();
        if (remaining) {
          fullText += remaining;
          onChunk(remaining);
        }

        setFullText(fullText);
        onComplete?.(fullText, args);
      } catch (error) {
        throw new Error(`Stream reading error: ${error}`);
      }
    } catch (error) {
      setError(error as Error);
    } finally {
      setIsLoading(false);
    }
  };

  return { fetchData, isLoading, error, fullText };
};
