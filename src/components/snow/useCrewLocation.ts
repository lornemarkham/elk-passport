"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  SEND_EVERY_MS,
  type CrewPosition,
  type Fix,
  type ShareMinutes,
  type Sharing,
} from "@/domain/snow/location";

export type CrewLocation = {
  /** The server says location sharing is not switched on for this database. */
  readonly off: boolean;
  readonly sharing: { readonly expiresAt: string } | null;
  readonly others: readonly CrewPosition[];
  /** This phone's last reading — kept in memory only, never stored. */
  readonly mine: Fix | null;
  readonly problem: string | null;
  readonly busy: boolean;
  start(minutes: ShareMinutes): void;
  stop(): void;
};

const POLL_MS = 10_000;

/**
 * **Sharing where you are, for a while, only if you say so.**
 *
 * Lives above the tabs so a share keeps updating while you look at the plan —
 * and stops the moment the page closes (there is no service worker, and no
 * background tracking: ADR 011). Nothing is read from the phone's location
 * until `start()` is called from a tap, which is what makes the browser ask.
 * The last reading is held in React state only.
 */
export function useCrewLocation(sharedId: string | null): CrewLocation {
  const [off, setOff] = useState(false);
  const [state, setState] = useState<Sharing>({ sharing: null, others: [] });
  const [mine, setMine] = useState<Fix | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const lastSent = useRef(0);
  const sharing = state.sharing;

  const url = sharedId ? `/snow/api/${sharedId}/location` : null;

  const take = useCallback(async (res: Response): Promise<boolean> => {
    if (res.status === 501) {
      setOff(true);
      return false;
    }
    if (!res.ok) throw new Error(String(res.status));
    setState((await res.json()) as Sharing);
    setProblem(null);
    return true;
  }, []);

  // What the server knows (a share started on another phone, or already over).
  useEffect(() => {
    if (!url) return;
    let alive = true;
    const read = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (alive) await take(res);
      } catch {
        /* no signal: keep what we had, say nothing new */
      }
    };
    void read();
    const t = setInterval(read, POLL_MS);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [url, take]);

  // While a share is running and the page is open: keep the dot current.
  const endsAt = sharing?.expiresAt;
  useEffect(() => {
    if (!url || !endsAt || !("geolocation" in navigator)) return;
    const watch = navigator.geolocation.watchPosition(
      (pos) => {
        const fix: Fix = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracyM: Math.round(pos.coords.accuracy),
        };
        setMine(fix);
        const t = Date.now();
        if (t - lastSent.current < SEND_EVERY_MS) return;
        lastSent.current = t;
        void fetch(url, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(fix),
        })
          .then((r) => (r.ok || r.status === 404 ? take(r) : undefined))
          .catch(() => undefined);
      },
      () => setProblem("Couldn't get a position just now."),
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 20_000 },
    );
    // It ends by itself: when the time is up, drop the share locally too.
    const left = Math.max(0, Date.parse(endsAt) - Date.now());
    const end = setTimeout(
      () => setState((s) => ({ ...s, sharing: null, others: [] })),
      left,
    );
    return () => {
      navigator.geolocation.clearWatch(watch);
      clearTimeout(end);
    };
  }, [url, endsAt, take]);

  const start = useCallback(
    (minutes: ShareMinutes) => {
      if (!url) return;
      if (!("geolocation" in navigator)) {
        setProblem("This browser can't share a position.");
        return;
      }
      setBusy(true);
      setProblem(null);
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const fix: Fix = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracyM: Math.round(pos.coords.accuracy),
          };
          setMine(fix);
          try {
            const res = await fetch(url, {
              method: "PUT",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ ...fix, minutes }),
            });
            lastSent.current = Date.now();
            if (!(await take(res))) return;
          } catch {
            setProblem("No signal. Nothing was shared.");
          } finally {
            setBusy(false);
          }
        },
        (err) => {
          setBusy(false);
          setProblem(
            err.code === err.PERMISSION_DENIED
              ? "Your phone said no, so nothing was shared."
              : "Couldn't get a position, so nothing was shared.",
          );
        },
        { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
      );
    },
    [url, take],
  );

  const stop = useCallback(() => {
    if (!url) return;
    // Stop locally first: asking to stop is never slower than the network.
    setState({ sharing: null, others: [] });
    setMine(null);
    void fetch(url, { method: "DELETE" }).catch(() =>
      setProblem(
        "You're offline, so the stop hasn't reached the server yet. It still ends on its own time.",
      ),
    );
  }, [url]);

  return {
    off,
    sharing,
    others: state.others,
    mine,
    problem,
    busy,
    start,
    stop,
  };
}
