"use client";

import { useEffect, useState, type ComponentType } from "react";
import type {
  Itinerary,
  ItineraryStop as Stop,
} from "@/domain/christmas/itinerary";
import type { MapMarker } from "../lights/LightsMap";
import type { LatLng } from "@/domain/christmas/lights/model";

const EMOJI: Readonly<Record<string, string>> = {
  dinner: "🍽️",
  lunch: "🥪",
  lights: "✨",
  movie: "🎬",
  market: "🎪",
  drinks: "🥂",
  coffee: "☕",
};

type MapProps = {
  readonly markers: readonly MapMarker[];
  readonly center: LatLng;
  readonly zoom?: number;
  readonly route?: readonly LatLng[];
  readonly className?: string;
  readonly label: string;
  readonly controls?: boolean;
};

/**
 * **The evening on a map, beside its timeline** (owner brief M1128: "consider
 * maps alongside itinerary timelines"). Desktop only — a phone keeps the
 * timeline and each stop's Directions, and never downloads the map library:
 * it is loaded once the screen is wide enough to show it. The same night map
 * as the lights (`LightsMap`), each planned stop numbered in order, the
 * route between them drawn as the plan has it.
 */
export function PlanMap({ itinerary }: { readonly itinerary: Itinerary }) {
  const [Map, setMap] = useState<ComponentType<MapProps> | null>(null);
  useEffect(() => {
    const wide = window.matchMedia("(min-width: 1024px)");
    let cancelled = false;
    const load = () => {
      if (!wide.matches) return;
      void import("../lights/LightsMap").then((m) => {
        if (!cancelled) setMap(() => m.LightsMap as ComponentType<MapProps>);
      });
    };
    load();
    wide.addEventListener("change", load);
    return () => {
      cancelled = true;
      wide.removeEventListener("change", load);
    };
  }, []);

  const stops = itinerary.stops.filter(
    (s): s is Stop & { place: NonNullable<Stop["place"]> } =>
      s.status === "planned" && Boolean(s.place?.at),
  );
  if (stops.length === 0) return null;
  const markers: MapMarker[] = stops.map((s, i) => ({
    id: s.need,
    at: s.place.at!,
    emoji: EMOJI[s.need] ?? "📍",
    label: `${i + 1}. ${s.label}: ${s.place.title}`,
    n: i + 1,
  }));
  const route = stops.map((s) => s.place.at!);
  const center = {
    lat: route.reduce((n, p) => n + p.lat, 0) / route.length,
    lng: route.reduce((n, p) => n + p.lng, 0) / route.length,
  };

  return (
    <div
      className="hidden overflow-hidden rounded-[24px] bg-[#0b1d16] shadow-lg ring-1 ring-black/10 lg:block"
      data-testid="plan-map"
    >
      {Map ? (
        <Map
          markers={markers}
          center={center}
          zoom={12}
          {...(route.length > 1 ? { route } : {})}
          className="h-[22rem]"
          label="Your plan on a map"
          controls
        />
      ) : (
        <div className="h-[22rem]" aria-hidden />
      )}
      <ol className="space-y-1 p-4 text-sm text-white/85">
        {stops.map((s, i) => (
          <li key={s.need} className="flex gap-2">
            <span className="font-extrabold text-[#ffd98a]">{i + 1}</span>
            <span>
              <span className="font-bold text-white">{s.place.title}</span> ·{" "}
              {s.label}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
