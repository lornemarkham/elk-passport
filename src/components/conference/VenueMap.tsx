"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef } from "react";
import type { Map as MlMap } from "maplibre-gl";

/**
 * **The venue on a quiet map.** OpenFreeMap's Positron style (no key, no
 * cookies), one pin for the venue and small ones for where the day's plans
 * meet. A picture of the neighbourhood, not a navigation tool: directions go
 * to the person's own map app.
 *
 * Only ever given points Passport already knows (a curated place, an Atlas
 * place); never a point guessed from an address.
 */
const STYLE = "https://tiles.openfreemap.org/styles/positron";

export interface MapPin {
  readonly name: string;
  readonly at: readonly [number, number];
}

export function VenueMap({
  venue,
  pins = [],
  className = "h-[220px]",
}: {
  venue: MapPin;
  pins?: readonly MapPin[];
  className?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<MlMap | null>(null);
  const key = JSON.stringify([venue, pins]);

  useEffect(() => {
    let dead = false;
    void import("maplibre-gl").then((ml) => {
      if (dead || !box.current) return;
      const m = new ml.Map({
        container: box.current,
        style: STYLE,
        center: [venue.at[1], venue.at[0]],
        zoom: 14.6,
        attributionControl: { compact: true },
        cooperativeGestures: true,
      });
      map.current = m;
      const pin = (p: MapPin, main: boolean) => {
        const el = document.createElement("div");
        el.title = p.name;
        el.style.cssText = main
          ? "width:16px;height:16px;border-radius:999px;background:#17181b;box-shadow:0 0 0 5px rgba(23,24,27,.14),0 0 0 2px #fff inset"
          : "width:10px;height:10px;border-radius:999px;background:#a5814a;box-shadow:0 0 0 3px #fff";
        new ml.Marker({ element: el }).setLngLat([p.at[1], p.at[0]]).addTo(m);
      };
      m.on("load", () => {
        // Compact attribution starts open on wide screens; close it to the ⓘ.
        box.current
          ?.querySelector(".maplibregl-compact-show")
          ?.classList.remove("maplibregl-compact-show");
        pins.forEach((p) => pin(p, false));
        pin(venue, true);
        if (pins.length) {
          const b = new ml.LngLatBounds();
          for (const p of [venue, ...pins]) b.extend([p.at[1], p.at[0]]);
          m.fitBounds(b, { padding: 48, maxZoom: 15.5, duration: 0 });
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

  return (
    <div
      ref={box}
      className={`bg-cf-sand w-full overflow-hidden ${className}`}
      role="img"
      aria-label={`Map of ${venue.name} and the area around it`}
    />
  );
}
