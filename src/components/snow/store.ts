"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  applyAction,
  parseDay,
  type Action,
  type SnowDay,
} from "@/domain/snow/day";

/**
 * **A snow day lives on this device.**
 *
 * `localStorage`, one key per day. That is the honest scope of this first
 * slice: it is why the day still opens, and still takes changes, when the
 * mountain has no signal — and why it is *one phone's* copy until the shared
 * tables exist (docs/product/snow/SHARING.md). Nothing here is sent anywhere.
 */
const KEY = (id: string) => `snow:day:${id}`;
const INDEX = "snow:days";
const ME = (id: string) => `snow:me:${id}`;

export function listDayIds(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(INDEX) ?? "[]");
    return Array.isArray(raw)
      ? raw.filter((x): x is string => typeof x === "string")
      : [];
  } catch {
    return [];
  }
}

export function readDay(id: string): SnowDay | null {
  try {
    const raw = localStorage.getItem(KEY(id));
    return raw ? parseDay(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

/** Returns an explanation instead of throwing when the device is full. */
export function writeDay(day: SnowDay): string | null {
  try {
    localStorage.setItem(KEY(day.id), JSON.stringify(day));
    const ids = listDayIds();
    if (!ids.includes(day.id))
      localStorage.setItem(INDEX, JSON.stringify([day.id, ...ids]));
    return null;
  } catch {
    return "This phone has no room left to save that. Remove a photo and try again.";
  }
}

export function forgetDay(id: string) {
  try {
    localStorage.removeItem(KEY(id));
    localStorage.removeItem(ME(id));
    localStorage.setItem(
      INDEX,
      JSON.stringify(listDayIds().filter((x) => x !== id)),
    );
  } catch {
    /* nothing to forget */
  }
}

export function readMe(id: string): string | null {
  try {
    return localStorage.getItem(ME(id));
  } catch {
    return null;
  }
}
export function writeMe(id: string, personId: string) {
  try {
    localStorage.setItem(ME(id), personId);
  } catch {
    /* the picker simply asks again */
  }
}

export function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID().slice(0, 12)
    : Math.random().toString(36).slice(2, 14);
}

export type Status = "loading" | "missing" | "ready";

/**
 * The day, its actions, and the last thing that went wrong in words.
 * Reads after mount (the server cannot see this device), writes through
 * on every action.
 */
export function useSnowDay(id: string) {
  const [day, setDay] = useState<SnowDay | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [problem, setProblem] = useState<string | null>(null);
  const [me, setMeState] = useState<string | null>(null);
  const ref = useRef<SnowDay | null>(null);

  useEffect(() => {
    // Reading the device after mount is the point: the server cannot see it.
    const d = readDay(id);
    ref.current = d;
    /* eslint-disable react-hooks/set-state-in-effect */
    setDay(d);
    setMeState(readMe(id));
    setStatus(d ? "ready" : "missing");
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [id]);

  const act = useCallback((action: Action): boolean => {
    const current = ref.current;
    if (!current) return false;
    const result = applyAction(current, action, new Date().toISOString());
    if (!result.ok) {
      setProblem(result.reason);
      return false;
    }
    const failed = writeDay(result.day);
    if (failed) {
      setProblem(failed);
      return false;
    }
    ref.current = result.day;
    setDay(result.day);
    setProblem(null);
    return true;
  }, []);

  const setMe = useCallback(
    (personId: string) => {
      writeMe(id, personId);
      setMeState(personId);
    },
    [id],
  );

  return {
    day,
    status,
    act,
    problem,
    clearProblem: () => setProblem(null),
    me,
    setMe,
  };
}
