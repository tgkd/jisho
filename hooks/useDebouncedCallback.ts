import { useCallback, useEffect, useMemo, useRef } from "react";

export function useCallbackRef<T extends (...args: any[]) => any>(
  callback: T | undefined
): T {
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  });

  return useMemo(() => ((...args) => callbackRef.current?.(...args)) as T, []);
}

const noop = () => {};

export function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  options: number | { delay: number; flushOnUnmount?: boolean }
) {
  const delay = typeof options === "number" ? options : options.delay;
  const flushOnUnmount =
    typeof options === "number" ? false : options.flushOnUnmount;
  const handleCallback = useCallbackRef(callback);
  const debounceTimerRef = useRef(0);
  const flushRef = useRef<() => void>(noop);

  const lastCallback = useCallback(
    (...args: Parameters<T>) => {
      window.clearTimeout(debounceTimerRef.current);
      const flush = () => {
        if (debounceTimerRef.current !== 0) {
          debounceTimerRef.current = 0;
          handleCallback(...args);
        }
      };
      flushRef.current = flush;
      debounceTimerRef.current = window.setTimeout(flush, delay);
    },
    [handleCallback, delay]
  );

  useEffect(
    () => () => {
      window.clearTimeout(debounceTimerRef.current);
      if (flushOnUnmount) {
        flushRef.current();
      }
    },
    [flushOnUnmount]
  );

  return lastCallback;
}
