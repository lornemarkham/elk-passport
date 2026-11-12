"use client";

import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { blunt } from "@/domain/discovery/situation";
import { townById, type DiscoveryTown } from "@/domain/discovery/towns";
import {
  DEVICE_MAX_KM,
  choose as chooseIn,
  clearDestination,
  clearHome,
  nearestCovered,
  saved,
  setHome as setHomeIn,
  type LocationSource,
} from "@/domain/location/prefs";
import { distanceKm } from "@/lib/environment/geo";
import { getPrefs, getServerPrefs, subscribePrefs, updatePrefs } from "./store";

/**
 * **"Where is this person looking?", answered once for every experience.**
 *
 * ```
 * 1. a place they chose (this experience's, else the shared one), or a home
 * 2. a browser position they ALREADY granted — read silently, never asked for
 * 3. an approximate region from the network edge, or the launch region
 * ```
 *
 * Step 2 uses `navigator.permissions.query`, which reports a decision without
 * showing a prompt; a visitor who has not granted (or has denied) is simply
 * not asked, and falls to step 3. The only way a prompt can appear is the
 * person pressing *Use my location* (`locate`).
 *
 * Steps 2 and 3 are **not remembered** — they are re-worked each launch, so a
 * guess can never harden into a fact — and are marked `approximate`, so
 * whatever shows them says "around", never "you are in".
 */
type Fallback =
  | { readonly status: "idle" | "pending" }
  | {
      readonly status: "done";
      readonly townId: string;
      readonly source: Exclude<LocationSource, "chosen" | "home">;
    };

let fallback: Fallback = { status: "idle" };
const watchers = new Set<() => void>();
const setFallback = (next: Fallback) => {
  fallback = next;
  watchers.forEach((w) => w());
};
const subscribeFallback = (w: () => void) => {
  watchers.add(w);
  return () => watchers.delete(w);
};
const IDLE: Fallback = { status: "idle" };

export type LocateResult =
  | { readonly ok: true; readonly townId: string; readonly km: number }
  | { readonly ok: false; readonly why: "denied" | "outside" | "failed" };

function position(): Promise<{ latitude: number; longitude: number }> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve(blunt(coords.latitude, coords.longitude)),
      reject,
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    );
  });
}

async function resolveFallback(): Promise<void> {
  if (fallback.status !== "idle") return;
  setFallback({ status: "pending" });
  try {
    const permission = await navigator.permissions?.query({
      name: "geolocation",
    });
    if (permission?.state === "granted" && navigator.geolocation) {
      const near = nearestCovered(await position(), distanceKm, DEVICE_MAX_KM);
      if (near) {
        setFallback({ status: "done", townId: near.town.id, source: "device" });
        return;
      }
    }
  } catch {
    // Unsupported, or the fix failed: fall through to the regional guess.
  }
  try {
    const response = await fetch("/api/location/approximate");
    const body = (await response.json()) as {
      townId?: string;
      source?: string;
    };
    if (townById(body.townId)) {
      setFallback({
        status: "done",
        townId: body.townId!,
        source: body.source === "approximate" ? "approximate" : "default",
      });
      return;
    }
  } catch {
    // Offline: the launch region below.
  }
  setFallback({ status: "done", townId: "vernon", source: "default" });
}

export interface PassportLocation {
  /** False until the choice, the browser's grant and the regional guess are known. */
  readonly ready: boolean;
  readonly town?: DiscoveryTown;
  readonly townId?: string;
  readonly source?: LocationSource;
  /** True when what is shown is a guess, not something they said. */
  readonly approximate: boolean;
  readonly home?: DiscoveryTown;
  readonly recent: readonly DiscoveryTown[];
  /** This experience has its own destination, apart from the shared place. */
  readonly hasDestination: boolean;
  /** Choose a place. `onlyHere` keeps it to this experience (a destination). */
  readonly choose: (townId: string, options?: { onlyHere?: boolean }) => void;
  readonly makeHome: (townId: string) => void;
  readonly forgetHome: () => void;
  /** Drop this experience's own destination and follow the shared place. */
  readonly followShared: () => void;
  /** Ask the browser (this is what may show its prompt) and choose the nearest town. */
  readonly locate: (options?: { onlyHere?: boolean }) => Promise<LocateResult>;
}

/** `scope` names the experience (`"christmas"`, `"snow"`, `"go"`…). */
export function useLocation(scope?: string): PassportLocation {
  const prefs = useSyncExternalStore(subscribePrefs, getPrefs, getServerPrefs);
  const resolved = useSyncExternalStore(
    subscribeFallback,
    () => fallback,
    () => IDLE,
  );
  const said = saved(prefs, scope);
  const hasSaid = Boolean(said);

  useEffect(() => {
    if (!hasSaid) void resolveFallback();
  }, [hasSaid]);

  const townId =
    said?.townId ?? (resolved.status === "done" ? resolved.townId : undefined);
  const source: LocationSource | undefined = said
    ? said.source
    : resolved.status === "done"
      ? resolved.source
      : undefined;

  const choose = useCallback(
    (id: string, options?: { onlyHere?: boolean }) =>
      updatePrefs((p) =>
        chooseIn(p, id, options?.onlyHere && scope ? scope : undefined),
      ),
    [scope],
  );
  const locate = useCallback(
    async (options?: { onlyHere?: boolean }): Promise<LocateResult> => {
      if (typeof navigator === "undefined" || !navigator.geolocation)
        return { ok: false, why: "failed" };
      try {
        const near = nearestCovered(
          await position(),
          distanceKm,
          DEVICE_MAX_KM,
        );
        if (!near) return { ok: false, why: "outside" };
        choose(near.town.id, options);
        return { ok: true, townId: near.town.id, km: Math.round(near.km) };
      } catch (error) {
        const code = (error as GeolocationPositionError | undefined)?.code;
        return { ok: false, why: code === 1 ? "denied" : "failed" };
      }
    },
    [choose],
  );

  return useMemo(
    () => ({
      ready: Boolean(townId),
      ...(townId ? { townId, town: townById(townId)! } : {}),
      ...(source ? { source } : {}),
      approximate: source === "approximate" || source === "default",
      ...(townById(prefs.home) ? { home: townById(prefs.home)! } : {}),
      recent: prefs.recent.flatMap((id) => townById(id) ?? []),
      hasDestination: Boolean(scope && prefs.destinations[scope]),
      choose,
      makeHome: (id: string) => updatePrefs((p) => setHomeIn(p, id)),
      forgetHome: () => updatePrefs(clearHome),
      followShared: () =>
        scope ? updatePrefs((p) => clearDestination(p, scope)) : undefined,
      locate,
    }),
    [townId, source, prefs, scope, choose, locate],
  );
}

/** Tests only: forget the fallback so the next mount works it out again. */
export function resetFallbackForTest(): void {
  setFallback({ status: "idle" });
}
