"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * **A shared page that stays current while it is open** — Hockey Night's
 * `useSharedNight` polling, generalised: ask every few seconds only while the
 * tab is visible (a phone in a pocket asks nothing), ask again on focus, and
 * never let a poll that started before a write overwrite what the write
 * returned (`generation`).
 *
 * This is the "realtime" the shared modules have: seconds, not instant. The
 * local stack has no Supabase Realtime, and Hockey ships on the same
 * polling. Swapping in a subscription later changes this one hook.
 */
export function usePoll<T>(
  url: string,
  pick: (json: Record<string, unknown>) => T,
  initial: T,
  everyMs = 5000,
) {
  const [data, setData] = useState<T>(initial);
  const [gone, setGone] = useState(false);
  const generation = useRef(0);
  const pickRef = useRef(pick);
  useEffect(() => {
    pickRef.current = pick;
  });

  const refresh = useCallback(async () => {
    const mine = ++generation.current;
    try {
      const r = await fetch(url, { cache: "no-store" });
      if (r.status === 404 || r.status === 401) {
        setGone(true);
        return;
      }
      if (!r.ok) return;
      const json = (await r.json()) as Record<string, unknown>;
      if (mine === generation.current) setData(pickRef.current(json));
    } catch {
      // Offline for a moment: keep what we have.
    }
  }, [url]);

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const timer = window.setInterval(tick, everyMs);
    document.addEventListener("visibilitychange", tick);
    window.addEventListener("focus", tick);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
      window.removeEventListener("focus", tick);
    };
  }, [refresh, everyMs]);

  return { data, setData, refresh, gone };
}

/** POST JSON, and say what went wrong in words. */
export async function send(
  url: string,
  body: unknown,
  method = "POST",
): Promise<
  { ok: true; json: Record<string, unknown> } | { ok: false; message: string }
> {
  try {
    const r = await fetch(url, {
      method,
      headers: { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const json = (await r.json().catch(() => ({}))) as Record<string, unknown>;
    if (r.ok) return { ok: true, json };
    const issues = json.issues as { message: string }[] | undefined;
    return {
      ok: false,
      message:
        issues?.[0]?.message ??
        (r.status === 409
          ? "That's full."
          : r.status === 403
            ? "That isn't yours to change."
            : r.status === 404
              ? "That's gone."
              : "That didn't work. Try again."),
    };
  } catch {
    return { ok: false, message: "You're offline. Try again in a moment." };
  }
}
