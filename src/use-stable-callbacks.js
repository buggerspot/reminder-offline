import { useLayoutEffect, useMemo, useRef } from "react";

// Memoized presenters keep their identity while actions always see the most
// recent committed reminders/settings. No screen needs a stale callback.
export function useStableCallbacks(callbacks) {
  const latest = useRef(callbacks);
  useLayoutEffect(() => { latest.current = callbacks; });
  return useMemo(() => Object.fromEntries(Object.keys(callbacks).map(name => [name,
    (...args) => latest.current[name](...args),
  ])), []);
}
