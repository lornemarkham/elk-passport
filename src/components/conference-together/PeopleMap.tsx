"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef } from "react";
import type { Map as MlMap, Marker } from "maplibre-gl";

/**
 * **Where your people are, on a city map.** MapLibre on OpenFreeMap — the
 * same no-key, no-cookie stack the Arrivals map uses — in its light street
 * style, because this map is for walking, not for watching aircraft.
 *
 * Draws only what it's handed: coworkers who are sharing right now, you (if
 * you are), and where upcoming plans meet. Nothing is interpolated or
 * guessed between updates.
 */
const STYLE = "https://tiles.openfreemap.org/styles/positron";

export interface MapPerson {
  readonly memberId: string;
  readonly name: string;
  readonly you: boolean;
  readonly at: readonly [number, number];
}
export interface MapPin {
  readonly id: string;
  readonly name: string;
  readonly at: readonly [number, number];
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

export function PeopleMap({
  centre,
  people,
  pins,
  accent,
}: {
  centre: readonly [number, number];
  people: readonly MapPerson[];
  pins: readonly MapPin[];
  accent: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<MlMap | null>(null);
  const markers = useRef<Marker[]>([]);
  const framed = useRef(false);
  const lib = useRef<typeof import("maplibre-gl") | null>(null);

  const drawRef = useRef<() => void>(() => {});
  // The latest people and pins, drawn now if the map is ready, or on load.
  useEffect(() => {
    drawRef.current = () => {
      const m = map.current;
      const ml = lib.current;
      if (!m || !ml) return;
      for (const mk of markers.current) mk.remove();
      markers.current = [];
      for (const pin of pins) {
        const el = document.createElement("div");
        el.className =
          "rounded-full bg-white px-2 py-1 text-[12px] font-bold shadow ring-1 ring-black/20";
        el.textContent = `📍 ${pin.name}`;
        markers.current.push(
          new ml.Marker({ element: el, anchor: "bottom" })
            .setLngLat([pin.at[1], pin.at[0]])
            .addTo(m),
        );
      }
      for (const p of people) {
        const el = document.createElement("div");
        el.setAttribute("data-person", p.name);
        el.className = "flex flex-col items-center";
        const dot = document.createElement("span");
        dot.className =
          "flex h-9 w-9 items-center justify-center rounded-full border-[3px] border-white text-[13px] font-semibold text-white shadow-lg";
        dot.style.background = p.you ? "#1d4ed8" : accent;
        dot.textContent = p.you ? "You" : initials(p.name);
        const tag = document.createElement("span");
        tag.className =
          "mt-0.5 rounded bg-white/90 px-1 text-[11px] font-semibold shadow";
        tag.textContent = p.you ? "You" : p.name;
        el.append(dot, tag);
        markers.current.push(
          new ml.Marker({ element: el, anchor: "top" })
            .setLngLat([p.at[1], p.at[0]])
            .addTo(m),
        );
      }
      // Frame everyone once; after that, leave the person's own panning alone.
      if (!framed.current && people.length) {
        const b = new ml.LngLatBounds();
        for (const p of people) b.extend([p.at[1], p.at[0]]);
        b.extend([centre[1], centre[0]]);
        m.fitBounds(b, { padding: 60, maxZoom: 16, duration: 0 });
        framed.current = true;
      }
    };
    if (map.current?.loaded()) drawRef.current();
  });

  useEffect(() => {
    let dead = false;
    void import("maplibre-gl").then((ml) => {
      if (dead || !box.current) return;
      lib.current = ml;
      map.current = new ml.Map({
        container: box.current,
        style: STYLE,
        center: [centre[1], centre[0]],
        zoom: 14,
        attributionControl: { compact: true },
      });
      map.current.on("load", () => drawRef.current());
    });
    return () => {
      dead = true;
      map.current?.remove();
      map.current = null;
    };
    // The map is made once; people and pins are redrawn above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={box}
      className="bg-cf-sand h-[46vh] min-h-[280px] w-full overflow-hidden rounded-3xl"
      role="img"
      aria-label={`Map: ${people.length} ${people.length === 1 ? "person" : "people"} sharing where they are`}
    />
  );
}
