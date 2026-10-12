"use client";

import { useEffect, useState } from "react";
import { MapPin } from "lucide-react";
import type { NearbyPlace } from "@/domain/hockey/nearby";
import { walkLabel } from "@/domain/hockey/nearby";
import type { SharedNight } from "./useSharedNight";

type Nearby = { places: NearbyPlace[]; outage?: string };

/**
 * **Real places near the arena, offered — not ranked.**
 *
 * Closed until somebody asks, because the vote above it is the point and this
 * is only a way of putting something on it. Nominating adds the place to the
 * same ballot "suggest somewhere else" does; the distance travels with it, in
 * words that say it is a straight line and an estimate.
 */
export function NearbyPicker({
  night,
  promptId,
}: {
  night: SharedNight;
  promptId: string;
}) {
  const [open, setOpen] = useState(false);
  const [nearby, setNearby] = useState<Nearby | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!open || nearby) return;
    let current = true;
    fetch(`/hockey/api/occasions/${night.state.slug}/nearby`, {
      cache: "no-store",
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((body: Nearby) => current && setNearby(body))
      .catch(() => current && setFailed(true));
    return () => {
      current = false;
    };
  }, [open, nearby, night.state.slug]);

  const onBallot = new Set(
    night.state.addedOptions
      .filter((o) => o.promptId === promptId)
      .map((o) => o.option.label),
  );

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 self-start text-[13.5px] text-white/55 hover:text-white"
      >
        <MapPin className="h-4 w-4" />
        What&apos;s near the arena?
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-white/12 bg-white/[0.03] p-4">
      <p className="text-[14px] font-medium">Near Rogers Arena</p>
      <p className="mt-0.5 text-[12.5px] text-white/45">
        Food and drink Passport knows about. Distances are straight lines, so
        the real walk is longer — nobody has told Passport about the streets
        yet.
      </p>

      {!nearby && !failed && (
        <div className="mt-3 h-16 animate-pulse rounded-xl bg-white/[0.04]" />
      )}

      {(failed || nearby?.outage) && (
        <p className="mt-3 text-[13.5px] text-white/65">
          Passport can&apos;t reach its map of Vancouver right now. Suggest a
          place by name instead — it counts just the same.
        </p>
      )}

      {nearby && !nearby.outage && nearby.places.length === 0 && (
        <p className="mt-3 text-[13.5px] text-white/65">
          Passport doesn&apos;t know anywhere to eat within a short walk of the
          arena yet. Suggest one by name — you know more than it does.
        </p>
      )}

      {nearby && nearby.places.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2">
          {nearby.places.map((place) => {
            const taken = onBallot.has(place.name);
            return (
              <li
                key={place.atlasId}
                className="flex items-center justify-between gap-3 rounded-xl border border-white/10 px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-[14.5px] text-white">
                    {place.name}
                  </p>
                  <p className="text-[12px] text-white/45">
                    {place.subtype ? `${place.subtype} · ` : ""}
                    {walkLabel(place)}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={taken}
                  aria-label={
                    taken
                      ? `${place.name} is on the ballot`
                      : `Nominate ${place.name}`
                  }
                  onClick={() =>
                    void night.send({
                      type: "nominate",
                      promptId,
                      atlasId: place.atlasId,
                    })
                  }
                  className="shrink-0 rounded-full border border-white/25 px-3 py-1.5 text-[12.5px] disabled:border-transparent disabled:text-white/40"
                >
                  {taken ? "On the ballot" : "Nominate"}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
