import { useState, useCallback, useRef } from "react";

export function useThrottledSearch<
  T extends (...args: any[]) => any,
  V = string
>(callback: T, delay = 500) {
  const [value, setValue] = useState<V>();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastExecutionRef = useRef<number>(0);

  const throttledCallback = useCallback(
    (...args: Parameters<T>) => {
      const now = Date.now();

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      if (now - lastExecutionRef.current >= delay) {
        callback(...args);
        lastExecutionRef.current = now;
      } else {
        timeoutRef.current = setTimeout(() => {
          callback(...args);
          lastExecutionRef.current = Date.now();
        }, delay);
      }
    },
    [callback, delay]
  );

  const handleChange = useCallback(
    (newValue: any) => {
      setValue(newValue);
      throttledCallback(newValue);
    },
    [throttledCallback]
  );

  return {
    value,
    setValue,
    handleChange,
  };
}
