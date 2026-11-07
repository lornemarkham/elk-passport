"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef } from "react";
import type { Map as MlMap } from "maplibre-gl";

/**
 * **The day on a quiet map**: numbered pins in the order of the plan, joined
 * by a dotted straight line. The line is a picture of the order, not a
 * route — Passport says so, and travel times stay Atlas's. Directions go to
 * the person's own map app.
 *
 * Only ever given points Atlas states (`geography.coordinates`); a stop with
 * none is simply not on the map, and the caption says how many are missing.
 * Tiles are OpenFreeMap's Positron (no key, no cookies), as the conference
 * map uses.
 */
const STYLE = "https://tiles.openfreemap.org/styles/positron";

export interface StopPin {
  readonly n: number;
  readonly name: string;
  /** `[longitude, latitude]`, as Atlas states it. */
  readonly at: readonly [number, number];
}

export function StopsMap({
  pins,
  missing,
  tone,
  className = "h-[260px] sm:h-[340px]",
}: {
  readonly pins: readonly StopPin[];
  readonly missing: number;
  readonly tone: string;
  readonly className?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<MlMap | null>(null);
  const key = JSON.stringify(pins);

  useEffect(() => {
    if (pins.length === 0) return;
    let dead = false;
    void import("maplibre-gl").then((ml) => {
      if (dead || !box.current) return;
      const m = new ml.Map({
        container: box.current,
        style: STYLE,
        center: [pins[0]!.at[0], pins[0]!.at[1]],
        zoom: 13,
        attributionControl: { compact: true },
        cooperativeGestures: true,
      });
      map.current = m;
      m.on("load", () => {
        box.current
          ?.querySelector(".maplibregl-compact-show")
          ?.classList.remove("maplibregl-compact-show");
        if (pins.length > 1) {
          m.addSource("order", {
            type: "geojson",
            data: {
              type: "Feature",
              properties: {},
              geometry: {
                type: "LineString",
                coordinates: pins.map((p) => [p.at[0], p.at[1]]),
              },
            },
          });
          m.addLayer({
            id: "order",
            type: "line",
            source: "order",
            paint: {
              "line-color": tone,
              "line-width": 3,
              "line-dasharray": [1, 2],
            },
          });
        }
        for (const p of pins) {
          const el = document.createElement("div");
          el.title = p.name;
          el.textContent = String(p.n);
          el.style.cssText = `width:28px;height:28px;border-radius:999px;background:${tone};color:#fff;font:700 14px/28px system-ui;text-align:center;box-shadow:0 0 0 3px #fff,0 2px 6px rgba(0,0,0,.3)`;
          new ml.Marker({ element: el }).setLngLat([p.at[0], p.at[1]]).addTo(m);
        }
        if (pins.length > 1) {
          const b = new ml.LngLatBounds();
          for (const p of pins) b.extend([p.at[0], p.at[1]]);
          m.fitBounds(b, { padding: 48, maxZoom: 15, duration: 0 });
        }
      });
    });
    return () => {
      dead = true;
      map.current?.remove();
      map.current = null;
    };
    // Rebuilt only when the points change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (pins.length === 0) return null;
  return (
    <figure data-testid="stops-map" className="px-2">
      <div
        ref={box}
        className={`w-full overflow-hidden rounded-3xl bg-[var(--gh-sand)] ${className}`}
        role="img"
        aria-label={`Map of the day: ${pins.map((p) => `${p.n}, ${p.name}`).join("; ")}`}
      />
      <figcaption className="mt-2 text-sm text-[var(--gh-ink-soft)]">
        Numbers follow the plan; the dotted line is the order, not a route.
        {missing > 0 &&
          ` ${missing} ${missing === 1 ? "stop has" : "stops have"} no location Atlas can place, so ${missing === 1 ? "it isn't" : "they aren't"} on the map.`}
      </figcaption>
    </figure>
  );
}
