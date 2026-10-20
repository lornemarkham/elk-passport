"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import type { Map as MlMap, Marker } from "maplibre-gl";
import type { ArrivalRow } from "@/domain/conference-arrivals/board";
import { greatCirclePath, ringAround } from "@/domain/conference-arrivals/geo";
import type { Airport } from "@/domain/conference-arrivals/matching";

/**
 * **The map: MapLibre GL on OpenFreeMap tiles.** No key, no billing, no
 * cookies (https://openfreemap.org). Attribution for the tiles is added by
 * MapLibre; the aircraft attribution (ADSB.lol, ODbL) is added here.
 *
 * What it draws, and the rule for each:
 *
 * - **A plane** only for an identified aircraft, at a position it broadcast.
 *   Between two polls the marker glides from the previous real position to
 *   the new one, and stops there. It never runs ahead of the newest report.
 * - **A grey plane** for a lost signal, frozen at the last real position.
 * - **A dashed line** for a planned route, from the departure airport. That
 *   is a route, not a position, and nothing moves along it.
 * - **A solid line** behind a plane: the positions it actually reported.
 * - **Faint rings** 50, 150 and 400 km from the airport: distance, for
 *   reading the map like a scope. Geometry only.
 *
 * OpenFreeMap's dark style, re-tinted after load toward a night chart: navy
 * water, runways picked out in amber.
 */
const STYLE = "https://tiles.openfreemap.org/styles/dark";
const RINGS_KM = [50, 150, 400];

/** Repaint a few of the style's layers, if it has them. */
function chart(m: MlMap) {
  const paint = (id: string, prop: string, value: unknown) => {
    if (m.getLayer(id)) m.setPaintProperty(id, prop, value);
  };
  paint("background", "background-color", "#0a0f17");
  paint("water", "fill-color", "#0c1a2c");
  paint("aeroway-runway", "line-color", "#a16207");
  paint("aeroway-taxiway", "line-color", "#3f3a2a");
  paint("aeroway-area", "fill-color", "#151a22");
}

interface Glide {
  marker: Marker;
  el: HTMLDivElement;
  icon: HTMLSpanElement;
  tag: HTMLSpanElement;
  from: [number, number];
  to: [number, number];
  start: number;
  duration: number;
  key: string;
  colour: string;
}

/** Keep longitudes within 180° of the airport, so lines don't wrap the globe. */
const near = (lon: number, centre: number) => {
  let l = lon;
  while (l - centre > 180) l -= 360;
  while (l - centre < -180) l += 360;
  return l;
};

function planeSvg(colour: string) {
  return `<svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true"><path fill="${colour}" stroke="#0a0f17" stroke-width="1.2" stroke-linejoin="round" d="M12 1.5c.9 0 1.5 1.2 1.5 2.6v5.2l8 4.7v2.2l-8-2.4v4.7l2.3 1.8V22L12 21l-3.8 1v-1.7l2.3-1.8v-4.7l-8 2.4V14l8-4.7V4.1c0-1.4.6-2.6 1.5-2.6z"/></svg>`;
}

export function ArrivalsMap({
  rows,
  arrival,
  place,
  accent,
  selected,
  onSelect,
}: {
  rows: readonly ArrivalRow[];
  arrival: Airport;
  /** "Vancouver": said beside the airport code. */
  place: string;
  accent: string;
  selected: string | null;
  onSelect: (memberId: string | null) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<MlMap | null>(null);
  const lib = useRef<typeof import("maplibre-gl") | null>(null);
  const glides = useRef(new Map<string, Glide>());
  const [ready, setReady] = useState(false);
  const select = useRef(onSelect);
  useEffect(() => {
    select.current = onSelect;
  });

  // The map itself, once.
  useEffect(() => {
    let gone = false;
    let frame = 0;
    const live = glides.current;
    void (async () => {
      const ml = await import("maplibre-gl");
      if (gone || !box.current) return;
      lib.current = ml;
      const m = new ml.Map({
        container: box.current,
        style: STYLE,
        center: [arrival.lon, arrival.lat],
        zoom: 3.4,
        minZoom: 1.5,
        dragRotate: false,
        pitchWithRotate: false,
        attributionControl: {
          compact: true,
          customAttribution:
            'Aircraft: <a href="https://adsb.lol" target="_blank" rel="noreferrer">ADSB.lol</a> (ODbL)',
        },
      });
      m.touchZoomRotate.disableRotation();
      m.addControl(
        new ml.NavigationControl({ showCompass: false }),
        "top-right",
      );
      m.on("click", () => select.current(null));
      m.on("load", () => {
        chart(m);
        // Compact attribution opens itself on load and covers a phone's map.
        // Credit stays one tap away, and under the board in words.
        m.getContainer()
          .querySelector(".maplibregl-compact-show")
          ?.classList.remove("maplibregl-compact-show");
        m.addSource("rings", {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: RINGS_KM.map((km) => ({
              type: "Feature" as const,
              properties: { km },
              geometry: {
                type: "LineString" as const,
                coordinates: ringAround(arrival, km),
              },
            })),
          },
        });
        m.addLayer({
          id: "rings",
          type: "line",
          source: "rings",
          paint: {
            "line-color": "#7dd3fc",
            "line-opacity": 0.14,
            "line-width": 1,
            "line-dasharray": [1, 3],
          },
        });
        m.addSource("planned", { type: "geojson", data: empty() });
        m.addSource("flown", { type: "geojson", data: empty() });
        m.addLayer({
          id: "planned",
          type: "line",
          source: "planned",
          paint: {
            "line-color": "#cbd5e1",
            "line-opacity": 0.4,
            "line-width": 1.5,
            "line-dasharray": [2, 2],
          },
        });
        m.addLayer({
          id: "flown",
          type: "line",
          source: "flown",
          paint: {
            "line-color": accent,
            "line-width": 3,
            "line-opacity": 0.9,
          },
        });
        // The destination, unmistakable: one lit badge, code and city.
        const home = document.createElement("div");
        home.setAttribute("data-testid", "arrivals-airport");
        home.style.cssText = `pointer-events:none;white-space:nowrap;font:900 12px/1 system-ui;letter-spacing:.1em;text-transform:uppercase;color:#0a0f17;background:#fbbf24;padding:6px 9px;border-radius:999px;box-shadow:0 0 0 4px rgba(251,191,36,.2),0 0 22px rgba(251,191,36,.5)`;
        home.textContent = `${arrival.iata ?? arrival.icao} · ${place}`;
        new ml.Marker({ element: home })
          .setLngLat([arrival.lon, arrival.lat])
          .addTo(m);
        setReady(true);
      });
      map.current = m;

      // Glide each plane between its last two real positions.
      const tick = () => {
        const now = performance.now();
        for (const g of live.values()) {
          const t = Math.min(1, (now - g.start) / g.duration);
          const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
          g.marker.setLngLat([
            g.from[0] + (g.to[0] - g.from[0]) * e,
            g.from[1] + (g.to[1] - g.from[1]) * e,
          ]);
        }
        frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    })();
    return () => {
      gone = true;
      cancelAnimationFrame(frame);
      map.current?.remove();
      map.current = null;
      live.clear();
    };
    // The airport and colour don't change while the page is open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Lines and planes, every time the board changes.
  useEffect(() => {
    const m = map.current;
    const ml = lib.current;
    if (!ready || !m || !ml) return;
    const centre = arrival.lon;

    const planned = rows
      .filter((r) => r.from && r.phase !== "landed" && r.phase !== "missed")
      .map((r) => ({
        type: "Feature" as const,
        properties: { id: r.memberId },
        geometry: {
          type: "LineString" as const,
          coordinates: greatCirclePath(arrival, r.from!)
            .reverse()
            .map(([lon, lat]) => [near(lon, centre), lat]),
        },
      }));
    const flown = rows
      .filter((r) => r.trail.length > 1 && r.phase !== "landed")
      .map((r) => ({
        type: "Feature" as const,
        properties: { id: r.memberId },
        geometry: {
          type: "LineString" as const,
          coordinates: r.trail.map(([lon, lat]) => [near(lon, centre), lat]),
        },
      }));
    (m.getSource("planned") as import("maplibre-gl").GeoJSONSource)?.setData({
      type: "FeatureCollection",
      features: planned,
    });
    (m.getSource("flown") as import("maplibre-gl").GeoJSONSource)?.setData({
      type: "FeatureCollection",
      features: flown,
    });

    const showing = new Set<string>();
    for (const r of rows) {
      if (!r.position || (r.phase !== "airborne" && r.phase !== "lost"))
        continue;
      showing.add(r.memberId);
      const to: [number, number] = [
        near(r.position.lon, centre),
        r.position.lat,
      ];
      const stale = r.phase === "lost";
      let g = glides.current.get(r.memberId);
      if (!g) {
        // Built once and updated in place: replacing it on every poll would
        // pull the plane out from under a finger mid-tap.
        const el = document.createElement("div");
        el.className = "arrivals-plane";
        el.style.cursor = "pointer";
        const icon = document.createElement("span");
        icon.style.cssText =
          "display:block;filter:drop-shadow(0 1px 2px rgba(0,0,0,.35))";
        const tag = document.createElement("span");
        tag.style.cssText =
          "position:absolute;left:50%;top:32px;transform:translateX(-50%);white-space:nowrap;font:800 12px/1.2 system-ui;padding:2px 6px;border-radius:999px;box-shadow:0 1px 3px rgba(0,0,0,.2);pointer-events:none";
        el.append(icon, tag);
        el.addEventListener("click", (e) => {
          e.stopPropagation();
          select.current(r.memberId);
        });
        const marker = new ml.Marker({ element: el, anchor: "center" })
          .setLngLat(to)
          .addTo(m);
        g = {
          marker,
          el,
          icon,
          tag,
          from: to,
          to,
          start: 0,
          duration: 1,
          key: "",
          colour: "",
        };
        glides.current.set(r.memberId, g);
      } else if (g.key !== r.position.at) {
        // A new real position: glide from wherever the marker is now.
        const at = g.marker.getLngLat();
        const seconds =
          (Date.parse(r.position.at) - Date.parse(g.key || r.position.at)) /
          1000;
        g.from = [at.lng, at.lat];
        g.to = to;
        g.start = performance.now();
        g.duration = Math.min(10_000, Math.max(1_500, seconds * 1000));
      }
      g.key = r.position.at;
      const colour = stale ? "#6b7280" : r.isYou ? "#ffffff" : accent;
      const label = `${r.isYou ? "You" : (r.name ?? "")} · ${r.flight}`;
      const chosen = selected === r.memberId;
      if (g.colour !== colour) {
        g.icon.innerHTML = planeSvg(colour);
        g.colour = colour;
      }
      g.icon.style.transform = `rotate(${r.position.trackDeg ?? 0}deg)`;
      g.icon.style.opacity = stale ? "0.7" : "1";
      g.tag.textContent = `${label}${stale ? " · last seen" : ""}`;
      g.tag.style.background = chosen ? "#fff" : "rgba(10,15,23,.88)";
      g.tag.style.color = chosen ? "#0a0f17" : stale ? "#cbd5e1" : "#fff";
      g.el.setAttribute(
        "aria-label",
        `${label}${stale ? ", last seen position" : ", live position"}`,
      );
      g.el.style.zIndex = chosen ? "2" : "1";
    }
    for (const [id, g] of glides.current)
      if (!showing.has(id)) {
        g.marker.remove();
        glides.current.delete(id);
      }
  }, [rows, ready, arrival, accent, selected]);

  // Fly to the selected plane.
  useEffect(() => {
    const r = rows.find((x) => x.memberId === selected);
    if (r?.position && map.current)
      map.current.easeTo({
        center: [near(r.position.lon, arrival.lon), r.position.lat],
        zoom: Math.max(map.current.getZoom(), 5),
        duration: 900,
      });
    // Only when the selection changes, not on every poll.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  /**
   * `everyone` includes the departure airports of flights nobody has
   * identified yet (the wide view). Without it, only the airport and aircraft
   * with a real position, so the first look is of what is really flying.
   */
  function fit(everyone: boolean, duration = 900) {
    const m = map.current;
    if (!m || !lib.current) return;
    const points: [number, number][] = [[arrival.lon, arrival.lat]];
    for (const r of rows) {
      if (r.position)
        points.push([near(r.position.lon, arrival.lon), r.position.lat]);
      else if (everyone && r.from && r.phase !== "landed")
        points.push([near(r.from.lon, arrival.lon), r.from.lat]);
    }
    // Frame what is on screen: on a tall map, part of it may still be below
    // the window. The sides leave room for the airport's badge.
    const below = box.current
      ? Math.max(
          0,
          box.current.getBoundingClientRect().bottom - window.innerHeight,
        )
      : 0;
    const padding = { top: 60, bottom: 50 + below, left: 90, right: 90 };
    if (points.length === 1) {
      // Nothing with a real position: a regional view of the airport.
      m.easeTo({ center: points[0], zoom: 5, padding, duration });
      return;
    }
    const bounds = new lib.current.LngLatBounds(points[0], points[0]);
    for (const p of points) bounds.extend(p);
    m.fitBounds(bounds, { padding, maxZoom: everyone ? 7 : 9, duration });
  }
  const fitEveryone = () => fit(true);

  // Once, when the map is ready: frame the airport and the real aircraft.
  const framed = useRef(false);
  useEffect(() => {
    if (!ready || framed.current) return;
    framed.current = true;
    fit(false, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  return (
    <div className="relative lg:h-full">
      <div
        ref={box}
        className="h-[56vh] min-h-[340px] w-full bg-[#0a0f17] lg:h-full"
        data-testid="arrivals-map"
      />
      <button
        type="button"
        onClick={fitEveryone}
        className="absolute top-3 left-3 rounded-full bg-[#0a0f17]/85 px-3 py-2 text-[13px] font-bold text-white shadow ring-1 ring-white/15 backdrop-blur"
      >
        Show everyone
      </button>
    </div>
  );
}

const empty = () => ({ type: "FeatureCollection" as const, features: [] });
