"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  ArenaAction,
  ArenaView,
  CheckIn,
} from "@/domain/hockey/arena-mode";

/** Same rhythm as the night page: only while somebody is looking. */
const POLL_MS = 5000;

/**
 * **The group's arena, kept current.**
 *
 * Polls while the tab is visible (a phone in a pocket asks nothing), and
 * sends every action to the server, which answers with the whole view as
 * that person may see it. Checking in and vanishing move your own dot at
 * once and are then replaced by what the server says, so a refusal reverts
 * rather than lies.
 */
export function useArena(initial: ArenaView) {
  const [view, setView] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date(initial.now));
  const generation = useRef(0);
  const id = initial.nightId;

  const refresh = useCallback(async () => {
    const started = generation.current;
    try {
      const res = await fetch(`/hockey/api/occasions/${id}/arena`, {
        cache: "no-store",
      });
      if (res.status === 404 || res.status === 401) {
        window.location.href = "/hockey?gone=1";
        return;
      }
      if (!res.ok) return;
      const next = (await res.json()) as ArenaView;
      if (generation.current === started) setView(next);
    } catch {
      // Arena Wi-Fi. The next poll will try again.
    }
  }, [id]);

  useEffect(() => {
    const poll = window.setInterval(() => {
      setNow(new Date());
      if (document.visibilityState === "visible") void refresh();
    }, POLL_MS);
    const wake = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("focus", wake);
    return () => {
      window.clearInterval(poll);
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("focus", wake);
    };
  }, [refresh]);

  const send = useCallback(
    async (
      action: ArenaAction,
      opts: {
        optimistic?: (v: ArenaView) => ArenaView;
        done?: string;
      } = {},
    ): Promise<boolean> => {
      generation.current += 1;
      const mine = generation.current;
      setError(null);
      if (opts.optimistic) setView((v) => opts.optimistic!(v));
      try {
        const res = await fetch(`/hockey/api/occasions/${id}/arena`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(action),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(body.error ?? "That didn't work.");
          await refresh();
          return false;
        }
        if (generation.current === mine) setView(body as ArenaView);
        if (opts.done) setFlash(opts.done);
        return true;
      } catch {
        setError("Couldn't reach Passport. Arena Wi-Fi, probably.");
        await refresh();
        return false;
      }
    },
    [id, refresh],
  );

  useEffect(() => {
    if (!flash) return;
    const t = window.setTimeout(() => setFlash(null), 2600);
    return () => window.clearTimeout(t);
  }, [flash]);

  const me = view.me;
  return {
    view,
    now,
    error,
    flash,
    clearError: () => setError(null),
    send,
    checkIn: (place: string, status = "") =>
      send(
        { type: "checkin", place, status },
        {
          optimistic: (v) => ({
            ...v,
            checkins: [
              ...v.checkins.filter((c) => c.user !== me),
              { user: me, place, status, at: new Date().toISOString() },
            ] satisfies CheckIn[],
          }),
          done: "Checked in. The herd can see you.",
        },
      ),
    vanish: () =>
      send(
        { type: "vanish" },
        {
          optimistic: (v) => ({
            ...v,
            checkins: v.checkins.filter((c) => c.user !== me),
          }),
          done: "Vanished. Nobody can see where you are.",
        },
      ),
  };
}

export type Arena = ReturnType<typeof useArena>;
