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

  const lastCallback = Object.assign(
    useCallback(
      (...args: Parameters<T>) => {
        window.clearTimeout(debounceTimerRef.current);
        const flush = () => {
          if (debounceTimerRef.current !== 0) {
            debounceTimerRef.current = 0;
            handleCallback(...args);
          }
        };
        lastCallback.flush = flush;
        debounceTimerRef.current = window.setTimeout(flush, delay);
      },
      [handleCallback, delay]
    ),
    { flush: noop }
  );

  useEffect(
    () => () => {
      window.clearTimeout(debounceTimerRef.current);
      if (flushOnUnmount) {
        lastCallback.flush();
      }
    },
    [lastCallback, flushOnUnmount]
  );

  return lastCallback;
}
