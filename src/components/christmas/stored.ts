"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * **A string kept in the browser, read the React way** — the pattern
 * `go/KeptDays.tsx` uses: `useSyncExternalStore` over storage, so the
 * server renders `null` and the browser hydrates to what is kept, with no
 * state set inside an effect. Writes in this tab notify readers in this tab
 * (the `storage` event only reaches other tabs).
 */
const EVENT = "passport-christmas-stored";

type Area = "local" | "session";
const area = (which: Area) =>
  which === "local" ? window.localStorage : window.sessionStorage;

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(EVENT, onChange);
  };
}

export function useStored(
  key: string,
  which: Area = "local",
): readonly [string | null, (value: string) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => {
      try {
        return area(which).getItem(key);
      } catch {
        return null;
      }
    },
    () => null,
  );
  const set = useCallback(
    (next: string) => {
      try {
        area(which).setItem(key, next);
      } catch {
        /* storage full or blocked: the choice lasts this render only */
      }
      window.dispatchEvent(new Event(EVENT));
    },
    [key, which],
  );
  return [value, set];
}

/** A JSON list kept in the browser. */
export function useStoredList(
  key: string,
  which: Area = "local",
): readonly [readonly string[], (next: readonly string[]) => void] {
  const [raw, set] = useStored(key, which);
  let list: string[] = [];
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed))
      list = parsed.filter((x): x is string => typeof x === "string");
  } catch {
    list = [];
  }
  const write = useCallback(
    (next: readonly string[]) => set(JSON.stringify(next)),
    [set],
  );
  return [list, write];
}

function subscribeMotion(onChange: () => void) {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/** Whether this person asked their device for less motion. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeMotion,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => true,
  );
}
