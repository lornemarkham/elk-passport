"use client";

import { useEffect, useState } from "react";
import { answerMemo } from "./answerMemo";
import type { Origin, TravelAnswer } from "./atlasTravel";
import type { Journey, TravelMode } from "./journey";

export type TravelStatus =
  /** No origin yet: nothing to measure from. */
  | "idle"
  | "loading"
  | "ready"
  /** Atlas answered and has no travel times. Show straight-line, labelled. */
  | "not-served"
  /** Nothing usable came back. Say so; do not show an empty answer. */
  | "failed";

/**
 * **Atlas's travel times from the origin on screen**, in one mode.
 *
 * The shape of `useDistances`, on purpose: POSTed so a position never enters
 * a URL, keyed on the origin to ~1 km and the mode, and an answer to an older
 * question is discarded rather than shown under a newer one.
 *
 * Five states rather than "journeys or nothing", because each one means
 * something different to say: still asking, Atlas cannot do this yet, and
 * Atlas could not be reached are three different sentences, and none of them
 * is "no route".
 *
 * An answer is kept for five minutes (`answerMemo`), so going back to an
 * origin and mode already asked about costs Atlas nothing.
 */
const remembered = answerMemo<TravelAnswer>();

/** For tests: forget every answer this tab has kept. */
export const forgetTravelTimes = () => remembered.clear();

export function useTravelTimes(
  origin: Origin | undefined,
  mode: TravelMode,
): {
  readonly status: TravelStatus;
  readonly journeys?: Readonly<Record<string, Journey>>;
} {
  const key = origin
    ? `${origin.latitude.toFixed(2)},${origin.longitude.toFixed(2)},${mode}`
    : undefined;
  const [result, setResult] = useState<{
    key: string;
    answer?: TravelAnswer;
  }>();

  useEffect(() => {
    if (!key || !origin || remembered.get(key)) return;
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/discovery/travel", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            latitude: origin.latitude,
            longitude: origin.longitude,
            mode,
          }),
        });
        if (!response.ok) throw new Error(String(response.status));
        const answer = (await response.json()) as TravelAnswer;
        if (answer.state !== "ready" || !answer.temporary)
          remembered.set(key, answer);
        if (!cancelled) setResult({ key, answer });
      } catch {
        if (!cancelled) setResult({ key });
      }
    })();
    return () => {
      cancelled = true;
    };
    // `key` carries the origin and mode; a rebuilt `origin` object with the
    // same coordinates must not refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (!key) return { status: "idle" };
  const kept = remembered.get(key);
  if (!kept && result?.key !== key) return { status: "loading" };
  const answer = kept ?? result?.answer;
  if (!answer) return { status: "failed" };
  if (answer.state === "not-served") return { status: "not-served" };
  return { status: "ready", journeys: answer.journeys };
}
