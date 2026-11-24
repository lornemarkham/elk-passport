"use client";

import { useEffect, useState } from "react";

/**
 * **What a thing added on this phone is called.** My Christmas List keeps
 * what was added (an event with "Add to My Christmas List", a display with
 * "Add to tour") as ids in the browser. Ids alone left the list saying "1
 * thing added" without saying which, so the name and the page it came from
 * are remembered beside them at the moment of adding — on this device only,
 * like the ids themselves. Nothing is looked up or sent anywhere.
 */
export interface AddedName {
  readonly title: string;
  readonly href: string;
}

const KEY = "passport.christmas.names";
const EVENT = "xm-names-changed";
const MAX = 60;

function read(): Record<string, AddedName> {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    if (!v || typeof v !== "object" || Array.isArray(v)) return {};
    const out: Record<string, AddedName> = {};
    for (const [id, n] of Object.entries(v as Record<string, unknown>)) {
      const t = (n as { title?: unknown })?.title;
      const h = (n as { href?: unknown })?.href;
      if (typeof t === "string" && typeof h === "string" && h.startsWith("/"))
        out[id] = { title: t.slice(0, 160), href: h };
    }
    return out;
  } catch {
    return {};
  }
}

export function rememberName(id: string, name: AddedName) {
  try {
    const all = read();
    delete all[id];
    all[id] = name;
    const kept = Object.entries(all).slice(-MAX);
    localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(kept)));
    window.dispatchEvent(new Event(EVENT));
  } catch {
    /* private mode: the list falls back to saying how many */
  }
}

export function useAddedNames(): Record<string, AddedName> {
  const [names, setNames] = useState<Record<string, AddedName>>({});
  useEffect(() => {
    const sync = () => setNames(read());
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return names;
}
