"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef } from "react";
import type { Map as MlMap, Marker } from "maplibre-gl";
import type { LatLng } from "@/domain/christmas/lights/model";

/**
 * **The Christmas lights map** — a night map with glowing markers. Tiles are
 * OpenFreeMap's (no key, no cookies), the dark style, so the lights are the
 * brightest thing on it. Used three ways: browsing pins (`onSelect`),
 * placing a new one (`pick`), and showing a tour's order (`route`).
 */
const STYLE = "https://tiles.openfreemap.org/styles/dark";

export interface MapMarker {
  readonly id: string;
  readonly at: LatLng;
  readonly emoji: string;
  readonly label: string;
  /** Not lit this season, or not yet confirmed: drawn quieter. */
  readonly dim?: boolean;
  readonly n?: number;
  readonly selected?: boolean;
}

export function LightsMap({
  markers,
  center,
  zoom = 12,
  route,
  pick,
  onSelect,
  className = "h-[58svh] min-h-[320px]",
  label,
}: {
  readonly markers: readonly MapMarker[];
  readonly center: LatLng;
  readonly zoom?: number;
  readonly route?: readonly LatLng[];
  readonly pick?: {
    readonly at: LatLng | null;
    readonly onPick: (at: LatLng) => void;
  };
  readonly onSelect?: (id: string) => void;
  readonly className?: string;
  readonly label: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<MlMap | null>(null);
  const placed = useRef<Marker[]>([]);
  const pickMarker = useRef<Marker | null>(null);
  const lib = useRef<typeof import("maplibre-gl") | null>(null);
  const ready = useRef(false);
  const onPick = useRef(pick?.onPick);
  onPick.current = pick?.onPick;
  const onSel = useRef(onSelect);
  onSel.current = onSelect;

  // The map itself, once.
  useEffect(() => {
    let dead = false;
    void import("maplibre-gl").then((ml) => {
      if (dead || !box.current) return;
      lib.current = ml;
      // MapLibre 6 can't find its worker inside Next's bundle; serve it ourselves.
      ml.setWorkerUrl(`/christmas/api/lights/map-worker?v=${ml.getVersion()}`);
      const m = new ml.Map({
        container: box.current,
        style: STYLE,
        center: [center.lng, center.lat],
        zoom,
        attributionControl: { compact: true },
      });
      m.addControl(
        new ml.NavigationControl({ showCompass: false }),
        "top-right",
      );
      map.current = m;
      m.on("click", (e) =>
        onPick.current?.({ lat: e.lngLat.lat, lng: e.lngLat.lng }),
      );
      m.on("load", () => {
        ready.current = true;
        box.current?.setAttribute("data-ready", "1");
        drawMarkers();
        drawRoute();
        drawPick();
      });
    });
    return () => {
      dead = true;
      map.current?.remove();
      map.current = null;
      ready.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const markerKey = JSON.stringify(markers);
  const routeKey = JSON.stringify(route ?? []);
  const pickKey = JSON.stringify(pick?.at ?? null);

  function drawMarkers() {
    const m = map.current;
    const ml = lib.current;
    if (!m || !ml || !ready.current) return;
    for (const p of placed.current) p.remove();
    placed.current = markers.map((p) => {
      const el = document.createElement("button");
      el.type = "button";
      el.className = "xm-marker";
      el.dataset.testid = "map-marker";
      el.dataset.id = p.id;
      el.setAttribute("aria-label", p.label);
      el.title = p.label;
      el.textContent = p.n ? String(p.n) : p.emoji;
      el.style.cssText = [
        "width:38px;height:38px;border-radius:999px;border:2px solid #ffd98a",
        `background:${p.selected ? "#b3242f" : "#0f3b2b"};color:#fff`,
        p.n
          ? "font:800 16px/34px system-ui"
          : "font-size:19px;line-height:34px",
        "text-align:center;cursor:pointer;padding:0",
        p.dim
          ? "opacity:.6;filter:grayscale(.6)"
          : "box-shadow:0 0 0 4px rgba(255,217,138,.25),0 0 18px 6px rgba(255,217,138,.55)",
      ].join(";");
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        onSel.current?.(p.id);
      });
      return new ml.Marker({ element: el })
        .setLngLat([p.at.lng, p.at.lat])
        .addTo(m);
    });
    if (markers.length > 1 && !pick) {
      const b = new ml.LngLatBounds();
      for (const p of markers) b.extend([p.at.lng, p.at.lat]);
      m.fitBounds(b, { padding: 56, maxZoom: 14, duration: 0 });
    }
  }

  function drawRoute() {
    const m = map.current;
    if (!m || !ready.current) return;
    const data = {
      type: "Feature" as const,
      properties: {},
      geometry: {
        type: "LineString" as const,
        coordinates: (route ?? []).map((p) => [p.lng, p.lat]),
      },
    };
    const src = m.getSource("tour") as
      { setData?: (d: unknown) => void } | undefined;
    if (src?.setData) {
      src.setData(data);
      return;
    }
    if (!route || route.length < 2) return;
    m.addSource("tour", { type: "geojson", data });
    m.addLayer({
      id: "tour-glow",
      type: "line",
      source: "tour",
      paint: {
        "line-color": "#ffd98a",
        "line-width": 9,
        "line-opacity": 0.25,
        "line-blur": 4,
      },
    });
    m.addLayer({
      id: "tour",
      type: "line",
      source: "tour",
      paint: {
        "line-color": "#ffd98a",
        "line-width": 3,
        "line-dasharray": [1.5, 1.5],
      },
    });
  }

  function drawPick() {
    const m = map.current;
    const ml = lib.current;
    if (!m || !ml || !ready.current) return;
    pickMarker.current?.remove();
    pickMarker.current = null;
    if (!pick?.at) return;
    const el = document.createElement("div");
    el.dataset.testid = "pick-marker";
    el.textContent = "📍";
    el.style.cssText =
      "font-size:40px;line-height:1;filter:drop-shadow(0 0 10px #ffd98a)";
    const mk = new ml.Marker({ element: el, draggable: true, anchor: "bottom" })
      .setLngLat([pick.at.lng, pick.at.lat])
      .addTo(m);
    mk.on("dragend", () => {
      const p = mk.getLngLat();
      onPick.current?.({ lat: p.lat, lng: p.lng });
    });
    pickMarker.current = mk;
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(drawMarkers, [markerKey]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(drawRoute, [routeKey]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(drawPick, [pickKey]);

  const centerKey = `${center.lat},${center.lng}`;
  useEffect(() => {
    if (pick && map.current && ready.current)
      map.current.easeTo({
        center: [center.lng, center.lat],
        zoom: Math.max(map.current.getZoom(), 15),
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centerKey]);

  return (
    <div
      ref={box}
      data-testid="lights-map"
      className={`w-full overflow-hidden rounded-[28px] bg-[#082319] ring-1 ring-[#ffd98a]/30 ${className}`}
      role="application"
      aria-label={label}
    />
  );
}
