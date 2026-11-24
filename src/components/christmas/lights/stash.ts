"use client";

import { useEffect, useState } from "react";
import { rememberName } from "../names";

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

export function clearStash() {
  writeStash([]);
}

export function toggleStash(id: string, name?: string): boolean {
  const now = readStash();
  const has = now.includes(id);
  if (name && !has)
    rememberName(id, { title: name, href: `/christmas/lights/${id}` });
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

/**
 * **Saved displays, on this phone** — the ❤️ on the map. A family's own
 * list of displays they love, kept apart from tonight's tour: wanting to see
 * one again is not the same as going tonight (doctrine §2.2).
 */
const SAVED = "passport.christmas.lights.saved";
const SAVED_EVENT = "xm-saved-changed";

export function readSaved(): string[] {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(SAVED) ?? "[]");
    return Array.isArray(v)
      ? v.filter((x): x is string => typeof x === "string").slice(0, 100)
      : [];
  } catch {
    return [];
  }
}

export function toggleSaved(id: string): boolean {
  const now = readSaved();
  const has = now.includes(id);
  try {
    localStorage.setItem(
      SAVED,
      JSON.stringify(has ? now.filter((x) => x !== id) : [...now, id]),
    );
    window.dispatchEvent(new Event(SAVED_EVENT));
  } catch {
    /* private mode */
  }
  return !has;
}

export function useSaved(): string[] {
  const [ids, setIds] = useState<string[]>([]);
  useEffect(() => {
    const sync = () => setIds(readSaved());
    sync();
    window.addEventListener(SAVED_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(SAVED_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return ids;
}
