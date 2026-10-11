"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { LegsAnswer } from "./atlasLegs";
import type { Journey, TravelMode } from "./journey";
import { isPlaced, type Leg } from "./legs";
import type { TravelStatus } from "./useTravelTimes";

/**
 * **Atlas's journey for each leg of a day**, in one mode.
 *
 * The shape of `useTravelTimes`, for a chain rather than a fan: POSTed so no
 * point enters a URL, keyed on what is asked so a rebuilt array of the same
 * legs does not refetch, and an answer to an older question is discarded
 * rather than shown under a newer one.
 *
 * `journeys[i]` belongs to `legs[i]`. A leg with an unplaced end is never
 * asked about and answers `undefined`, as does every leg until Atlas has
 * answered. A start point is rounded to ~1 km **here**, before it leaves the
 * browser, and again on the server.
 *
 * `retry()` asks the same question again after a failure. Nothing retries on
 * its own: a person looking at "could not get travel times" decides.
 */
export function useTravelLegs(
  legs: readonly Leg[],
  mode: TravelMode,
): {
  readonly status: TravelStatus;
  readonly journeys: readonly (Journey | undefined)[];
  readonly retry: () => void;
} {
  const asked = useMemo(
    () =>
      legs.flatMap((leg, index) =>
        isPlaced(leg)
          ? [{ index, from: wire(leg.from), to: wire(leg.to) }]
          : [],
      ),
    [legs],
  );
  const [attempt, setAttempt] = useState(0);
  const question =
    asked.length > 0
      ? JSON.stringify({
          mode,
          legs: asked.map(({ from, to }) => ({ from, to })),
        })
      : undefined;
  const key = question ? `${question}#${attempt}` : undefined;
  const [result, setResult] = useState<{ key: string; answer?: LegsAnswer }>();

  useEffect(() => {
    if (!key || !question) return;
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/travel/legs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: question,
        });
        if (!response.ok) throw new Error(String(response.status));
        const answer = (await response.json()) as LegsAnswer;
        if (!cancelled) setResult({ key, answer });
      } catch {
        if (!cancelled) setResult({ key });
      }
    })();
    return () => {
      cancelled = true;
    };
    // `key` carries the question and the attempt.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  const none: (Journey | undefined)[] = legs.map(() => undefined);

  if (!key) return { status: "idle", journeys: none, retry };
  if (result?.key !== key) return { status: "loading", journeys: none, retry };
  const answer = result.answer;
  if (!answer) return { status: "failed", journeys: none, retry };
  if (answer.state === "not-served") {
    return { status: "not-served", journeys: none, retry };
  }
  const journeys = [...none];
  asked.forEach(({ index }, k) => {
    journeys[index] = answer.journeys[k];
  });
  return { status: "ready", journeys, retry };
}

const wire = (end: Leg["from"] & { at: NonNullable<Leg["from"]["at"]> }) => {
  const places = end.id ? 5 : 2;
  const f = 10 ** places;
  return {
    ...(end.id ? { id: end.id } : {}),
    latitude: Math.round(end.at.latitude * f) / f,
    longitude: Math.round(end.at.longitude * f) / f,
  };
};
