"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import { Minus, Plus, LocateFixed } from "lucide-react";
import type { Map as MlMap, Marker } from "maplibre-gl";
import type { LatLng } from "@/domain/christmas/lights/model";
import { cluster as group } from "@/domain/christmas/lights/cluster";

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
  /** The viewer's own pin, waiting for a reviewer: drawn dashed so it is plainly theirs. */
  readonly pending?: boolean;
}

/** Marker look: a lit display glows; the rest are quiet so the map stays readable. */
const BASE =
  "width:36px;height:36px;border-radius:999px;border:2px solid #ffd98a;text-align:center;cursor:pointer;padding:0;color:#fff";
const GLOW =
  "box-shadow:0 0 0 3px rgba(255,217,138,.22),0 0 10px 2px rgba(255,217,138,.45)";

export function LightsMap({
  markers,
  center,
  zoom = 12,
  route,
  pick,
  onSelect,
  className = "h-[58svh] min-h-[320px]",
  label,
  clustered = false,
  focus = null,
  controls = true,
  creditTop = false,
  buttons = false,
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
  /** Group markers that would overlap into ✨ clusters (browsing). */
  readonly clustered?: boolean;
  /** Bring this point into view above the bottom card. */
  readonly focus?: LatLng | null;
  /** Zoom buttons. Off where pinch does it and the corner is needed. */
  readonly controls?: boolean;
  /** Put the map's credit top-left, clear of buttons laid over the bottom. */
  readonly creditTop?: boolean;
  /** Our own + / − / recenter buttons, clear of the places row and the card. */
  readonly buttons?: boolean;
}) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<MlMap | null>(null);
  const placed = useRef<Marker[]>([]);
  const pickMarker = useRef<Marker | null>(null);
  const lib = useRef<typeof import("maplibre-gl") | null>(null);
  const ready = useRef(false);
  // Said on screen: the library and the first tiles are a second or more on
  // a phone, and a dark empty box read as broken (P1 loading brief).
  const [status, setStatus] = useState<"loading" | "ready" | "failed">(
    "loading",
  );
  const [attempt, setAttempt] = useState(0);
  const onPick = useRef(pick?.onPick);
  onPick.current = pick?.onPick;
  const focusAt = useRef(focus);
  focusAt.current = focus;
  const onSel = useRef(onSelect);
  onSel.current = onSelect;

  // The map itself, once.
  useEffect(() => {
    let dead = false;
    void import("maplibre-gl")
      .catch(() => {
        if (!dead) setStatus("failed");
        return null;
      })
      .then((ml) => {
        if (!ml) return;
        if (dead || !box.current) return;
        lib.current = ml;
        // MapLibre 6 can't find its worker inside Next's bundle; serve it ourselves.
        ml.setWorkerUrl(
          `/christmas/api/lights/map-worker?v=${ml.getVersion()}`,
        );
        const m = new ml.Map({
          container: box.current,
          style: STYLE,
          center: [center.lng, center.lat],
          zoom,
          attributionControl: creditTop ? false : { compact: true },
        });
        if (creditTop) {
          m.addControl(
            new ml.AttributionControl({ compact: true }),
            "top-left",
          );
          const corner = box.current.querySelector<HTMLElement>(
            ".maplibregl-ctrl-top-left",
          );
          // Under the row of place chips.
          if (corner) corner.style.marginTop = "52px";
          // Folded to its ⓘ, as MapLibre's compact credit is meant to be; one tap opens it.
          m.once("load", () =>
            box.current
              ?.querySelector(".maplibregl-compact-show")
              ?.classList.remove("maplibregl-compact-show"),
          );
        }
        if (controls)
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
          said();
          setStatus("ready");
          fitMarkers();
          drawRoute();
          drawPick();
          // A pin asked for by address ("See my pin") is the view, not the whole set.
          if (focusAt.current) goTo(focusAt.current, 15, 0);
        });
        const said = () =>
          box.current?.setAttribute("data-zoom", m.getZoom().toFixed(2));
        m.on("zoom", said);
        m.on("zoomend", () => redraw.current());
      });
    return () => {
      dead = true;
      map.current?.remove();
      map.current = null;
      ready.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  const markerKey = JSON.stringify(markers);
  // The map's own events call the latest drawing, with the latest markers.
  const redraw = useRef(() => {});
  redraw.current = () => {
    if (clustered) drawMarkers();
  };
  const routeKey = JSON.stringify(route ?? []);
  const pickKey = JSON.stringify(pick?.at ?? null);

  function markerEl(p: MapMarker, count?: number) {
    const el = document.createElement("button");
    el.type = "button";
    el.className = "xm-marker";
    el.dataset.testid = count ? "map-cluster" : "map-marker";
    el.dataset.id = p.id;
    el.setAttribute(
      "aria-label",
      count ? `${count} displays close together — zoom in` : p.label,
    );
    el.title = count ? `${count} displays` : p.label;
    el.textContent = count ? `✨${count}` : p.n ? String(p.n) : p.emoji;
    el.style.cssText = [
      BASE,
      count ? "width:auto;min-width:44px;padding:0 8px" : "",
      `background:${p.selected ? "#b3242f" : p.pending ? "#3a2f6b" : "#0f3b2b"}`,
      p.pending && !count ? "border-style:dashed;border-color:#fff" : "",
      p.n || count
        ? "font:800 15px/32px system-ui"
        : "font-size:18px;line-height:32px",
      p.dim && !count ? "opacity:.55;filter:grayscale(.6)" : GLOW,
    ].join(";");
    return el;
  }

  function drawMarkers() {
    const m = map.current;
    const ml = lib.current;
    if (!m || !ml || !ready.current) return;
    for (const p of placed.current) p.remove();
    const groups = clustered
      ? group(
          markers.map((p) => {
            const pt = m.project([p.at.lng, p.at.lat]);
            return { item: p, x: pt.x, y: pt.y };
          }),
          40,
        )
      : markers.map((p) => ({ items: [p], x: 0, y: 0 }));
    placed.current = groups.map((g) => {
      const one = g.items.length === 1;
      const first = g.items[0]!;
      const lead = g.items.find((p) => p.selected) ?? first;
      const el = markerEl(lead, one ? undefined : g.items.length);
      const at = one
        ? first.at
        : {
            lat: g.items.reduce((s, p) => s + p.at.lat, 0) / g.items.length,
            lng: g.items.reduce((s, p) => s + p.at.lng, 0) / g.items.length,
          };
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        if (one || m.getZoom() >= 16) {
          onSel.current?.(lead.id);
          return;
        }
        const b = new ml.LngLatBounds();
        for (const p of g.items) b.extend([p.at.lng, p.at.lat]);
        m.fitBounds(b, {
          padding: 80,
          maxZoom: Math.min(17, m.getZoom() + 3),
          duration: 400,
        });
      });
      return new ml.Marker({ element: el })
        .setLngLat([at.lng, at.lat])
        .addTo(m);
    });
  }

  function fitMarkers() {
    const m = map.current;
    const ml = lib.current;
    if (!m || !ml || !ready.current) return;
    if (markers.length > 1 && !pick) {
      const b = new ml.LngLatBounds();
      for (const p of markers) b.extend([p.at.lng, p.at.lat]);
      // On the browse map, clear of the chips above and the buttons below.
      m.fitBounds(b, {
        padding: clustered ? { top: 70, bottom: 90, left: 40, right: 40 } : 56,
        maxZoom: 14,
        duration: 0,
      });
    }
    drawMarkers();
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

  // A new set of markers is framed; a change of selection only redraws.
  const placesKey = JSON.stringify(markers.map((p) => [p.id, p.at]));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(fitMarkers, [placesKey]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(drawMarkers, [markerKey]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(drawRoute, [routeKey]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(drawPick, [pickKey]);

  /** Bring a point into view above the bottom card, which covers about the lower third. */
  function goTo(at: LatLng, atLeast: number | null, duration = 350) {
    const m = map.current;
    if (!m) return;
    m.easeTo({
      center: [at.lng, at.lat],
      ...(atLeast ? { zoom: Math.max(m.getZoom(), atLeast) } : {}),
      offset: [0, -Math.round((box.current?.clientHeight ?? 600) * 0.18)],
      duration,
    });
  }

  const focusKey = focus ? `${focus.lat},${focus.lng}` : "";
  useEffect(() => {
    if (!focus || !map.current || !ready.current) return;
    goTo(focus, null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusKey]);

  /** Back to the whole set of markers, or the map's own centre when there are fewer than two. */
  function recenter() {
    const m = map.current;
    const ml = lib.current;
    if (!m || !ml || !ready.current) return;
    if (markers.length > 1) {
      const b = new ml.LngLatBounds();
      for (const p of markers) b.extend([p.at.lng, p.at.lat]);
      m.fitBounds(b, {
        padding: clustered ? { top: 70, bottom: 90, left: 40, right: 40 } : 56,
        maxZoom: 14,
        duration: 400,
      });
    } else m.easeTo({ center: [center.lng, center.lat], zoom, duration: 400 });
  }

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
      className={`relative w-full overflow-hidden rounded-[28px] bg-[#082319] ring-1 ring-[#ffd98a]/30 ${className}`}
      role="application"
      aria-label={label}
      aria-busy={status === "loading" || undefined}
    >
      {buttons && status === "ready" && (
        <div
          className="absolute top-[88px] right-3 z-10 flex flex-col overflow-hidden rounded-2xl bg-[#082319]/90 text-white shadow-lg ring-1 ring-white/20 backdrop-blur"
          data-testid="map-buttons"
        >
          {[
            {
              id: "zoom-in",
              label: "Zoom in",
              icon: Plus,
              run: () => map.current?.zoomIn({ duration: 250 }),
            },
            {
              id: "zoom-out",
              label: "Zoom out",
              icon: Minus,
              run: () => map.current?.zoomOut({ duration: 250 }),
            },
            {
              id: "recenter",
              label: "Show all the lights",
              icon: LocateFixed,
              run: recenter,
            },
          ].map(({ id, label, icon: Icon, run }) => (
            <button
              key={id}
              type="button"
              onClick={run}
              aria-label={label}
              title={label}
              data-testid={`map-${id}`}
              className="inline-flex h-11 w-11 items-center justify-center hover:bg-white/10 [&:not(:first-child)]:border-t [&:not(:first-child)]:border-white/15"
            >
              <Icon className="h-5 w-5" aria-hidden />
            </button>
          ))}
        </div>
      )}
      {status !== "ready" && (
        <div
          className="absolute inset-0 z-10 grid place-items-center text-center text-sm font-semibold text-[#ffd98a]"
          data-testid="lights-map-status"
          data-status={status}
        >
          {status === "loading" ? (
            <span role="status" className="flex items-center gap-2">
              <span
                className="h-2 w-2 animate-pulse rounded-full bg-[#ffd98a] motion-reduce:animate-none"
                aria-hidden
              />
              Loading the map…
            </span>
          ) : (
            <span role="alert" className="px-6">
              The map couldn&apos;t load just now.{" "}
              <button
                type="button"
                className="min-h-11 underline underline-offset-4"
                onClick={() => {
                  setStatus("loading");
                  setAttempt((n) => n + 1);
                }}
              >
                Try again
              </button>
            </span>
          )}
        </div>
      )}
    </div>
  );
}
