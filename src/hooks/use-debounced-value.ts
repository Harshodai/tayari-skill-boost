import { useEffect, useState } from "react";

/**
 * Debounce a rapidly-changing value (typing, slider drags) so downstream
 * filtering/queries settle instead of thrashing on every keystroke.
 */
export function useDebouncedValue<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(id);
  }, [value, delay]);

  return debounced;
}

/** True while `value` has not yet caught up with its debounced counterpart. */
export function useIsSettling<T>(value: T, debounced: T): boolean {
  return value !== debounced;
}
