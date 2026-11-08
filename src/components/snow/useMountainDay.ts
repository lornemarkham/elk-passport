"use client";

import { useCallback, useEffect, useState } from "react";
import type { SnowDay } from "@/domain/snow/day";
import { crewPick, parseTweaks, type Tweaks } from "@/domain/snow/itinerary";
import { MOUNTAINS, type Mountain } from "@/domain/snow/mountains";
import type { Gap, Pick } from "@/domain/snow/nearby";

/** The mountain the crew is going to (locked) or leaning towards. */
export function mountainOf(day: SnowDay): {
  mountain?: Mountain;
  label?: string;
  locked: boolean;
} {
  const c = crewPick(day, "mountain");
  if (!c) return { locked: false };
  return {
    mountain: MOUNTAINS.find(
      (m) => m.name.toLowerCase() === c.proposal.label.toLowerCase(),
    ),
    label: c.proposal.label,
    locked: c.locked,
  };
}

export type Nearby =
  | { status: "idle" | "loading" }
  | { status: "unavailable" }
  | { status: "connected"; picks: Pick[]; gaps: Gap[]; request: string };

/**
 * Atlas around the mountain. Fetched once per mountain; "unavailable"
 * (Atlas or the signal didn't answer) is never shown as "nothing here".
 */
export function useNearby(mountainId: string | undefined): Nearby {
  const [state, setState] = useState<Nearby>({ status: "idle" });
  useEffect(() => {
    if (!mountainId) return;
    let live = true;
    /* eslint-disable-next-line react-hooks/set-state-in-effect -- starts a fetch for a new mountain */
    setState({ status: "loading" });
    fetch(`/snow/api/nearby?mountain=${encodeURIComponent(mountainId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((body: Nearby | null) => {
        if (!live) return;
        setState(
          body && body.status === "connected"
            ? body
            : { status: "unavailable" },
        );
      })
      .catch(() => live && setState({ status: "unavailable" }));
    return () => {
      live = false;
    };
  }, [mountainId]);
  return mountainId ? state : { status: "idle" };
}

const tweaksKey = (dayId: string) => `passport.snow.tweaks.${dayId}`;

/**
 * Timing tweaks ("lunch earlier", "keep us on the mountain") live on this
 * phone. The crew's picks — lunch, après, activities — are votes and are
 * shared; how one person likes the day laid out is theirs.
 */
export function useTweaks(dayId: string) {
  const [tweaks, setTweaks] = useState<Tweaks>(() => parseTweaks(null));
  const [before, setBefore] = useState<Tweaks | null>(null);
  useEffect(() => {
    try {
      /* eslint-disable-next-line react-hooks/set-state-in-effect -- reads this phone's storage once */
      setTweaks(
        parseTweaks(
          JSON.parse(localStorage.getItem(tweaksKey(dayId)) ?? "null"),
        ),
      );
    } catch {
      /* private mode: defaults */
    }
  }, [dayId]);
  const save = useCallback(
    (next: Tweaks) => {
      setBefore(tweaks);
      setTweaks(next);
      try {
        localStorage.setItem(tweaksKey(dayId), JSON.stringify(next));
      } catch {
        /* still applied for this visit */
      }
    },
    [dayId, tweaks],
  );
  const undo = useCallback(() => {
    if (!before) return;
    setTweaks(before);
    setBefore(null);
    try {
      localStorage.setItem(tweaksKey(dayId), JSON.stringify(before));
    } catch {
      /* ignore */
    }
  }, [before, dayId]);
  return { tweaks, save, undo, canUndo: before !== null };
}
