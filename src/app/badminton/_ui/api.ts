"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LiveView } from "@/lib/courtqueue/view";

/**
 * **Staying in sync on a phone in a gym.** Every phone asks the server what
 * changed every couple of seconds — and immediately when the app comes back
 * to the front, or the signal comes back. Polling, not a socket: it survives
 * an iPhone locking, switching apps and dropping Wi-Fi without anything to
 * reconnect, and "nothing changed" is a tiny answer.
 */

export type NotReadyInfo = { because: string };

const POLL_MS = 2_000;

export function useLive(focus: string | null) {
  const [view, setView] = useState<LiveView | null>(null);
  const [notReady, setNotReady] = useState<NotReadyInfo | null>(null);
  const [online, setOnline] = useState(true);
  const [offset, setOffset] = useState(0);
  const version = useRef<string | null>(null);
  const lastOk = useRef(0);
  const inFlight = useRef(false);

  const accept = useCallback((v: LiveView) => {
    version.current = v.version;
    setOffset(v.now - Date.now());
    setView(v);
  }, []);

  const refresh = useCallback(
    async (force = false) => {
      if (inFlight.current && !force) return;
      inFlight.current = true;
      try {
        const q = new URLSearchParams();
        if (!force && version.current) q.set("v", version.current);
        if (focus) q.set("org", focus);
        const res = await fetch(`/api/badminton/live?${q}`, {
          cache: "no-store",
        });
        if (res.status === 503) {
          setNotReady(await res.json());
          return;
        }
        if (!res.ok) throw new Error(String(res.status));
        const body = await res.json();
        lastOk.current = Date.now();
        setOnline(true);
        setNotReady(null);
        if (body.unchanged) setOffset(body.now - Date.now());
        else accept(body as LiveView);
      } catch {
        if (Date.now() - lastOk.current > 6_000) setOnline(false);
      } finally {
        inFlight.current = false;
      }
    },
    [accept, focus],
  );

  useEffect(() => {
    lastOk.current = Date.now();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the first read of an external system (the server) is the subscription itself
    void refresh(true);
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, POLL_MS);
    const wake = () => {
      if (document.visibilityState === "visible") void refresh(true);
    };
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("online", wake);
    window.addEventListener("focus", wake);
    window.addEventListener("pageshow", wake);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("online", wake);
      window.removeEventListener("focus", wake);
      window.removeEventListener("pageshow", wake);
    };
  }, [refresh]);

  return { view, notReady, online, offset, refresh, accept };
}

export interface ActResult {
  ok: boolean;
  error?: string;
  view?: LiveView;
}

export async function post(path: string, body: unknown): Promise<ActResult> {
  try {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.status === 429)
      return { ok: false, error: "Slow down a moment, then try again." };
    const json = await res.json().catch(() => ({}));
    if (res.status === 503)
      return { ok: false, error: "CourtQueue isn't switched on yet." };
    return {
      ok: res.ok && json.ok !== false,
      error: json.error,
      view: json.view,
    };
  } catch {
    return {
      ok: false,
      error: "No signal — try again when you're back online.",
    };
  }
}
