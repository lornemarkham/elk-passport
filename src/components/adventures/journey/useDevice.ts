"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  mergeMemories,
  parseMemories,
  withMemory,
  withoutMemory,
  type Memory,
} from "@/lib/adventures/companion";

/**
 * **What a person keeps about an adventure on their own phone**: whether they
 * started the day, which stops are done, how far behind they said they were,
 * and their memories. Personal memories stay
 * private unless the person shares one (ADR 014). Signed in, they are also
 * kept against the account — readable by that person alone — so they follow
 * them to another device; where that is not switched on (or the person is
 * signed out) the phone keeps them exactly as before. A phone that won't keep
 * one still shows it for the visit.
 *
 * Done marks keep the key `TodayPanel` has always used.
 */
const read = (key: string): string | null => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};
const write = (key: string, value: string | null) => {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
};

export function useDevice(adventureId: string, onDay: string | null) {
  const doneKey = `gh.done.${adventureId}.${onDay}`;
  const startedKey = `gh.started.${adventureId}.${onDay}`;
  const skippedKey = `gh.skipped.${adventureId}.${onDay}`;
  const behindKey = `gh.behind.${adventureId}.${onDay}`;
  const memoriesKey = `gh.memories.${adventureId}`;

  const [ready, setReady] = useState(false);
  const [done, setDone] = useState<readonly string[]>([]);
  const [skipped, setSkipped] = useState<readonly string[]>([]);
  const [started, setStarted] = useState<string | null>(null);
  const [behind, setBehind] = useState(0);
  const [memories, setMemories] = useState<readonly Memory[]>([]);
  const [saved, setSaved] = useState(true);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- read once from this device, after hydration */
    try {
      const d = JSON.parse(read(doneKey) ?? "[]");
      setDone(
        Array.isArray(d)
          ? d.filter((s): s is string => typeof s === "string")
          : [],
      );
    } catch {
      setDone([]);
    }
    try {
      const k = JSON.parse(read(skippedKey) ?? "[]");
      setSkipped(
        Array.isArray(k)
          ? k.filter((s): s is string => typeof s === "string")
          : [],
      );
    } catch {
      setSkipped([]);
    }
    setStarted(read(startedKey));
    setBehind(Number(read(behindKey)) || 0);
    setMemories(parseMemories(read(memoriesKey)));
    setReady(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [doneKey, skippedKey, startedKey, behindKey, memoriesKey]);

  const markDone = useCallback(
    (id: string, on: boolean) => {
      setDone((prev) => {
        const next = on
          ? [...new Set([...prev, id])]
          : prev.filter((d) => d !== id);
        write(doneKey, JSON.stringify(next));
        return next;
      });
    },
    [doneKey],
  );

  const markSkipped = useCallback(
    (id: string, on: boolean) => {
      setSkipped((prev) => {
        const next = on
          ? [...new Set([...prev, id])]
          : prev.filter((d) => d !== id);
        write(skippedKey, JSON.stringify(next));
        return next;
      });
    },
    [skippedKey],
  );

  const start = useCallback(() => {
    const at = new Date().toISOString();
    setStarted(at);
    write(startedKey, at);
  }, [startedKey]);

  const stop = useCallback(() => {
    setStarted(null);
    write(startedKey, null);
  }, [startedKey]);

  const runBehind = useCallback(
    (by: number) => {
      setBehind((prev) => {
        const next = Math.max(0, prev + by);
        write(behindKey, String(next));
        return next;
      });
    },
    [behindKey],
  );

  // The latest list, for the account sync to diff against.
  const latest = useRef<readonly Memory[]>([]);
  useEffect(() => {
    latest.current = memories;
  }, [memories]);
  /** Best effort: a phone with no account (or no table yet) just keeps its own. */
  const account = useRef<"unknown" | "on" | "off">("unknown");

  const send = useCallback(
    (method: "POST" | "DELETE", memory: Memory) => {
      if (account.current === "off") return;
      const url = `/api/adventures/${adventureId}/memories`;
      void (
        method === "POST"
          ? fetch(url, {
              method,
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(memory),
            })
          : fetch(`${url}/${memory.id}`, { method })
      )
        .then((res) => {
          if (res.status === 401 || res.status === 409) account.current = "off";
        })
        .catch(() => undefined);
    },
    [adventureId],
  );

  // Bring in what this person kept on another device, and send up what only
  // this phone has. Both directions are by id, so it is safe to repeat.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/adventures/${adventureId}/memories`);
        if (!res.ok) {
          account.current = "off";
          return;
        }
        account.current = "on";
        const body = (await res.json()) as { memories?: Memory[] };
        const theirs = parseMemories(JSON.stringify(body.memories ?? []));
        const here = parseMemories(read(memoriesKey));
        const merged = mergeMemories(here, theirs);
        if (cancelled) return;
        const known = new Set(theirs.map((m) => m.id));
        for (const m of here) if (!known.has(m.id)) send("POST", m);
        if (merged.length !== here.length) {
          write(memoriesKey, JSON.stringify(merged));
          setMemories(merged);
        }
      } catch {
        account.current = "off";
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [adventureId, memoriesKey, send]);

  const remember = useCallback(
    (m: Omit<Memory, "id" | "at">) => {
      const memory: Memory = {
        ...m,
        id: crypto.randomUUID(),
        at: new Date().toISOString(),
      };
      const prev = latest.current;
      const next = withMemory(prev, memory);
      latest.current = next;
      setMemories(next);
      setSaved(write(memoriesKey, JSON.stringify(next)));
      // A favourite is a toggle: the one it replaced is let go, not kept twice.
      for (const gone of prev)
        if (!next.some((n) => n.id === gone.id)) send("DELETE", gone);
      if (next.some((n) => n.id === memory.id)) send("POST", memory);
    },
    [memoriesKey, send],
  );

  const forget = useCallback(
    (id: string) => {
      const gone = latest.current.find((m) => m.id === id);
      const next = withoutMemory(latest.current, id);
      latest.current = next;
      setMemories(next);
      write(memoriesKey, JSON.stringify(next));
      if (gone) send("DELETE", gone);
    },
    [memoriesKey, send],
  );

  return {
    ready,
    done,
    markDone,
    skipped,
    markSkipped,
    started,
    start,
    stop,
    behind,
    runBehind,
    memories,
    remember,
    forget,
    /** False when the phone refused to keep the last memory (storage full). */
    saved,
  };
}
