"use client";

import { useEffect, useState } from "react";
import type { Point } from "@/domain/discovery/situation";
import type { CandidateDistance } from "@/lib/data/types";

export interface DistanceReading {
  readonly withinKm: number;
  readonly distances: Readonly<Record<string, CandidateDistance>>;
}

/**
 * **Atlas's distance reading for the origin on screen** — ADR 094.
 *
 * Asked through `/api/discovery/distance` in a POST body, so a shared position
 * never enters a URL. Keyed by the origin and the radius; a reading for an
 * older question is discarded rather than shown under a newer one.
 *
 * `status` lets the page say "measuring" instead of briefly showing the
 * unmeasured province, and say "couldn't measure" instead of pretending a
 * failed reading is an empty one.
 */
export function useDistances(
  origin: Point | undefined,
  withinKm: number,
): {
  readonly reading?: DistanceReading;
  readonly status: "idle" | "measuring" | "ready" | "failed";
} {
  const key = origin
    ? `${origin.latitude.toFixed(2)},${origin.longitude.toFixed(2)},${withinKm}`
    : undefined;
  const [result, setResult] = useState<{
    key: string;
    reading?: DistanceReading;
    failed?: boolean;
  }>();

  useEffect(() => {
    if (!key || !origin) return;
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/discovery/distance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            latitude: origin.latitude,
            longitude: origin.longitude,
            withinKm,
          }),
        });
        if (!response.ok) throw new Error(String(response.status));
        const reading = (await response.json()) as DistanceReading;
        if (!cancelled) setResult({ key, reading });
      } catch {
        if (!cancelled) setResult({ key, failed: true });
      }
    })();
    return () => {
      cancelled = true;
    };
    // `key` carries the origin and radius; the object identity of `origin`
    // changes on every render that rebuilds it and must not refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (!key) return { status: "idle" };
  if (result?.key !== key) return { status: "measuring" };
  if (result.failed || !result.reading) return { status: "failed" };
  return { reading: result.reading, status: "ready" };
}
