"use client";

import { useCallback, useEffect, useState } from "react";
import {
  parseMemories,
  withMemory,
  withoutMemory,
  type Memory,
} from "@/lib/adventures/companion";

/**
 * **What a person keeps about an adventure on their own phone**: whether they
 * started the day, which stops are done, how far behind they said they were,
 * and their memories. Nothing here is sent anywhere — personal memories stay
 * private unless the person shares one (ADR 014) — and a phone that won't
 * keep it still shows it for the visit.
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

  const remember = useCallback(
    (m: Omit<Memory, "id" | "at">) => {
      const memory: Memory = {
        ...m,
        id: crypto.randomUUID(),
        at: new Date().toISOString(),
      };
      setMemories((prev) => {
        const next = withMemory(prev, memory);
        setSaved(write(memoriesKey, JSON.stringify(next)));
        return next;
      });
    },
    [memoriesKey],
  );

  const forget = useCallback(
    (id: string) => {
      setMemories((prev) => {
        const next = withoutMemory(prev, id);
        write(memoriesKey, JSON.stringify(next));
        return next;
      });
    },
    [memoriesKey],
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
