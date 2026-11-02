"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  applyAction,
  parseDay,
  type Action,
  type SnowDay,
} from "@/domain/snow/day";
import { plan } from "@/domain/snow/shared";

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

export type Status =
  | "loading"
  | "missing"
  | "ready"
  /** A shared day needs an account to open. */
  | "signin"
  /** A shared day that could not be reached (offline, or the service is down). */
  | "down";

/** What both hooks hand the screen. */
export interface DayState {
  day: SnowDay | null;
  status: Status;
  act: (action: Action) => boolean;
  problem: string | null;
  clearProblem: () => void;
  me: string | null;
  setMe: (personId: string) => void;
  /** Present only for a day shared between phones. */
  shared?: { readonly isOwner: boolean };
}

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

// -------------------------------------------------------------- shared days

const SHARED = "snow:shared";
interface Remembered {
  id: string;
  title: string;
}

/** Shared days this phone has opened, so "Your snow days" can list them. */
export function listSharedDays(): Remembered[] {
  try {
    const raw = JSON.parse(localStorage.getItem(SHARED) ?? "[]");
    return Array.isArray(raw)
      ? raw.filter(
          (x): x is Remembered =>
            typeof x?.id === "string" && typeof x?.title === "string",
        )
      : [];
  } catch {
    return [];
  }
}

export function rememberSharedDay(id: string, title: string) {
  try {
    const rest = listSharedDays().filter((d) => d.id !== id);
    localStorage.setItem(
      SHARED,
      JSON.stringify([{ id, title }, ...rest].slice(0, 30)),
    );
  } catch {
    /* it is listed under adventures regardless */
  }
}

interface ServerView {
  day: SnowDay;
  me: string;
  isOwner: boolean;
}

const POLL_MS = 5000;

/**
 * **A day shared between phones.** The server is the one copy: this hook
 * reads it, keeps it fresh while the page is visible, and sends each change
 * as the same `Action` the local screen runs. A change shows at once (the
 * same `plan()` the server will run decides it, so a refusal needs no round
 * trip) and is replaced by the server's answer; if the server disagrees or
 * cannot be reached, the screen goes back to what the crew has and says so.
 */
export function useSharedSnowDay(id: string): DayState {
  const [view, setView] = useState<ServerView | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [problem, setProblem] = useState<string | null>(null);
  const ref = useRef<ServerView | null>(null);
  // Changes we have sent and not heard back about. A poll that lands in the
  // middle must not undo them.
  const pending = useRef(0);
  const queue = useRef<Promise<unknown>>(Promise.resolve());

  const adopt = useCallback((next: ServerView) => {
    ref.current = next;
    setView(next);
    setStatus("ready");
    rememberSharedDay(next.day.id, next.day.title);
  }, []);

  const refresh = useCallback(async () => {
    if (pending.current > 0) return;
    try {
      const res = await fetch(`/snow/api/${id}`, { cache: "no-store" });
      if (pending.current > 0) return;
      if (res.status === 401) return setStatus("signin");
      if (res.status === 404) return setStatus("missing");
      if (!res.ok) return ref.current ? undefined : setStatus("down");
      adopt((await res.json()) as ServerView);
    } catch {
      // No signal: keep showing the last thing the crew had.
      if (!ref.current) setStatus("down");
    }
  }, [id, adopt]);

  useEffect(() => {
    /* eslint-disable-next-line react-hooks/set-state-in-effect -- the first read of the shared day */
    void refresh();
    const tick = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, POLL_MS);
    const back = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", back);
    window.addEventListener("online", back);
    return () => {
      clearInterval(tick);
      document.removeEventListener("visibilitychange", back);
      window.removeEventListener("online", back);
    };
  }, [refresh]);

  const act = useCallback(
    (action: Action): boolean => {
      const current = ref.current;
      if (!current) return false;
      const now = new Date().toISOString();
      const decided = plan(
        current.day,
        action,
        { me: current.me, isOwner: current.isOwner },
        now,
      );
      if (!decided.ok) {
        setProblem(decided.reason);
        return false;
      }
      setProblem(null);
      const optimistic = { ...current, day: decided.day };
      ref.current = optimistic;
      setView(optimistic);
      pending.current += 1;
      queue.current = queue.current.then(async () => {
        try {
          const res = await fetch(`/snow/api/${id}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action }),
          });
          const body = await res.json().catch(() => ({}));
          if (res.ok && body?.left) {
            window.location.assign("/snow");
            return;
          }
          if (res.ok) adopt(body as ServerView);
          else {
            setProblem(
              typeof body?.error === "string"
                ? body.error
                : "That didn't reach the crew. Try again.",
            );
            pending.current -= 1;
            await refresh();
            pending.current += 1;
          }
        } catch {
          setProblem(
            "No signal — that change didn't reach the crew. Try again when you're back online.",
          );
          pending.current -= 1;
          await refresh();
          pending.current += 1;
        } finally {
          pending.current -= 1;
        }
      });
      return true;
    },
    [id, adopt, refresh],
  );

  return {
    day: view?.day ?? null,
    status,
    act,
    problem,
    clearProblem: () => setProblem(null),
    me: view?.me ?? null,
    setMe: () => undefined,
    shared: view ? { isOwner: view.isOwner } : undefined,
  };
}
