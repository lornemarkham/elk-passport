"use client";

import { useEffect, useState } from "react";

/**
 * **My tour, on this phone.** The stops someone added from the map, kept in
 * the browser until they build the tour — no account needed. Saving it as an
 * adventure is what puts it on the server.
 */
const KEY = "passport.christmas.lights.tour";
const EVENT = "xm-tour-changed";

export function readStash(): string[] {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v)
      ? v.filter((x): x is string => typeof x === "string").slice(0, 20)
      : [];
  } catch {
    return [];
  }
}

export function writeStash(ids: readonly string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify([...new Set(ids)].slice(0, 20)));
    window.dispatchEvent(new Event(EVENT));
  } catch {
    /* private mode: the tour simply isn't kept */
  }
}

export function toggleStash(id: string): boolean {
  const now = readStash();
  const has = now.includes(id);
  writeStash(has ? now.filter((x) => x !== id) : [...now, id]);
  return !has;
}

export function useStash(): string[] {
  const [ids, setIds] = useState<string[]>([]);
  useEffect(() => {
    const sync = () => setIds(readStash());
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return ids;
}
