"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Heart, MapPin, Navigation, Plus, Route, X } from "lucide-react";
import {
  KIND_EMOJI,
  TOWN_AT,
  type PinView,
  photoSrc,
} from "@/domain/christmas/lights/model";
import {
  AREAS,
  areaById,
  inAreaOf,
  placeLabel,
  type AreaId,
} from "@/domain/christmas/lights/areas";
import { isFavourite, priorMean } from "@/domain/christmas/lights/rank";
import { LightsMap, type MapMarker } from "./LightsMap";
import { SeasonBadge } from "./PinCard";
import { Stars } from "./Rate";
import { toggleSaved, toggleStash, useSaved, useStash } from "./stash";

export interface Festive {
  readonly id: string;
  readonly name: string;
  readonly at: { readonly lat: number; readonly lng: number };
  readonly line: string;
  readonly href: string;
  readonly emoji: string;
}

/** The marker a display gets: ❤️ saved, ⭐ community favourite, 🎄 confirmed. */
export function markerFor(
  p: PinView,
  saved: readonly string[],
  prior: number,
): Pick<MapMarker, "emoji" | "dim"> {
  const tonight =
    p.season === "lit" && p.running !== "soon" && p.running !== "over";
  if (saved.includes(p.id)) return { emoji: "❤️", dim: !tonight };
  if (tonight && isFavourite(p, prior)) return { emoji: "⭐" };
  return { emoji: "🎄", dim: !tonight };
}

export const directionsTo = (at: { lat: number; lng: number }) =>
  `https://www.google.com/maps/dir/?api=1&destination=${at.lat},${at.lng}`;

/**
 * **The map is the page** (Lights Map 2.0). On a phone it fills the screen:
 * a row of places along the top, _Build My Lights Tour_ along the bottom,
 * and a tap on a display slides up a compact card — photo, name,
 * neighbourhood, rating, when it's on, _Add to Tour_, _Directions_ — with
 * the map still showing above it. Only light displays are drawn; markers
 * close together become ✨ clusters until you zoom in.
 */
export function Explorer({
  pins,
  initialArea,
}: {
  readonly pins: readonly PinView[];
  readonly initialArea: AreaId | null;
}) {
  const router = useRouter();
  const [area, setAreaState] = useState<AreaId | null>(initialArea);
  // The place is in the address, so the lists below the map follow it and a link keeps it.
  const setArea = (id: AreaId | null) => {
    setAreaState(id);
    router.replace(id ? `/christmas/lights?at=${id}` : "/christmas/lights", {
      scroll: false,
    });
  };
  const [selected, setSelected] = useState<string | null>(null);
  const stash = useStash();
  const saved = useSaved();

  const prior = priorMean(pins);
  const place = area ? areaById(area) : null;
  const shown = pins.filter(
    (p) => p.status === "approved" && (!place || inAreaOf(place, p.at)),
  );
  const markers: MapMarker[] = shown.map((p) => ({
    id: p.id,
    at: p.at,
    ...markerFor(p, saved, prior),
    label: `${p.name} — ${placeLabel(p)}`,
    selected: p.id === selected,
  }));
  const pick = shown.find((p) => p.id === selected) ?? null;
  const center = place?.at ?? TOWN_AT.vernon;

  const chip = (on: boolean) =>
    `inline-flex min-h-9 shrink-0 items-center rounded-full px-3.5 text-sm font-bold shadow-lg backdrop-blur transition ${
      on
        ? "bg-[#ffd98a] text-[#082319]"
        : "bg-[#082319]/80 text-white ring-1 ring-white/15"
    }`;

  return (
    <div className="relative" data-testid="explorer">
      <LightsMap
        markers={markers}
        center={center}
        zoom={place ? 13 : 10}
        onSelect={setSelected}
        clustered
        controls={false}
        focus={pick?.at ?? null}
        className="h-[68svh] min-h-[400px] rounded-none sm:h-[78svh] sm:rounded-[28px]"
        label={`Christmas lights map: ${shown.length} light displays${place ? ` in ${place.label}` : ""}`}
      />

      <div
        className="absolute inset-x-0 top-0 z-10 flex [scrollbar-width:none] gap-2 overflow-x-auto px-3 pt-3 pb-2"
        role="group"
        aria-label="Where"
      >
        <button
          type="button"
          className={chip(!area)}
          onClick={() => {
            setArea(null);
            setSelected(null);
          }}
          aria-pressed={!area}
        >
          Everywhere
        </button>
        {AREAS.filter((a) => a.onMap).map((a) => (
          <button
            key={a.id}
            type="button"
            className={chip(area === a.id)}
            onClick={() => {
              setArea(a.id);
              setSelected(null);
            }}
            aria-pressed={area === a.id}
            data-testid={`town-${a.id}`}
          >
            {a.label}
          </button>
        ))}
      </div>

      {pick ? (
        <div
          className="absolute inset-x-2 bottom-2 z-20 max-h-[44%] overflow-y-auto rounded-[22px] bg-white p-3 text-[#082319] shadow-2xl sm:inset-x-auto sm:right-3 sm:w-[380px]"
          data-testid="map-sheet"
        >
          <button
            type="button"
            onClick={() => setSelected(null)}
            className="absolute top-1.5 right-1.5 rounded-full p-2 text-[#0f3b2b] hover:bg-black/5"
            aria-label="Close"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
          <Link
            href={`/christmas/lights/${pick.id}`}
            className="flex gap-3 pr-8"
            data-testid="sheet-open"
          >
            {photoSrc(pick) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photoSrc(pick)!}
                alt=""
                className="h-[72px] w-[72px] shrink-0 rounded-2xl object-cover"
              />
            ) : (
              <span
                className="xm-glow flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-2xl text-3xl"
                aria-hidden
              >
                {KIND_EMOJI[pick.kind]}
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="ghad-display block text-lg leading-tight font-extrabold">
                {pick.name}
              </span>
              <span
                className="block text-sm text-[#3d4a43]"
                data-testid="sheet-place"
              >
                {placeLabel(pick)}
              </span>
              <Stars rating={pick.rating} />
            </span>
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            <SeasonBadge pin={pick} />
            {pick.hours && (
              <span className="text-[#3d4a43]">🕯️ {pick.hours}</span>
            )}
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => toggleStash(pick.id)}
              className={`inline-flex min-h-11 flex-1 items-center justify-center gap-1 rounded-full px-3 text-sm font-extrabold ${stash.includes(pick.id) ? "bg-[#0f3b2b] text-white" : "bg-[#ffd98a]"}`}
              data-testid="sheet-add-to-tour"
              aria-pressed={stash.includes(pick.id)}
            >
              {stash.includes(pick.id) ? (
                "✓ On my tour"
              ) : (
                <>
                  <Plus className="h-4 w-4" aria-hidden /> Add to Tour
                </>
              )}
            </button>
            <a
              href={directionsTo(pick.at)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 flex-1 items-center justify-center gap-1 rounded-full px-3 text-sm font-bold ring-1 ring-[#0f3b2b]/20"
              data-testid="sheet-directions"
            >
              <Navigation className="h-4 w-4" aria-hidden /> Directions
            </a>
            <button
              type="button"
              onClick={() => toggleSaved(pick.id)}
              aria-pressed={saved.includes(pick.id)}
              aria-label={
                saved.includes(pick.id)
                  ? "Saved — tap to unsave"
                  : "Save this display"
              }
              className="inline-flex min-h-11 w-11 shrink-0 items-center justify-center rounded-full ring-1 ring-[#0f3b2b]/20"
              data-testid="sheet-save"
            >
              <Heart
                className={`h-5 w-5 ${saved.includes(pick.id) ? "fill-[#b3242f] text-[#b3242f]" : ""}`}
                aria-hidden
              />
            </button>
          </div>
        </div>
      ) : (
        <div className="absolute inset-x-3 bottom-8 z-20 flex items-end gap-2">
          <Link
            href={`/christmas/lights/tour${area ? `?area=${area}` : ""}`}
            className="inline-flex min-h-14 flex-1 items-center justify-center gap-2 rounded-full bg-[#ffd98a] px-5 text-lg font-extrabold text-[#082319] shadow-2xl"
            data-testid="cta-tour"
          >
            <Route className="h-5 w-5" aria-hidden />
            {stash.length > 0
              ? `My Lights Tour · ${stash.length}`
              : "Build My Lights Tour"}
          </Link>
          <Link
            href="/christmas/lights/pin"
            className="inline-flex min-h-14 shrink-0 items-center gap-1 rounded-full bg-[#b3242f] px-4 font-extrabold text-white shadow-2xl"
            data-testid="pin-the-magic"
            aria-label="Add lights to the map"
          >
            <MapPin className="h-5 w-5" aria-hidden /> Add
          </Link>
        </div>
      )}

      <p
        className="mx-auto mt-2 max-w-6xl px-4 text-sm text-white/75 sm:px-0"
        data-testid="legend"
      >
        🎄 Confirmed · ⭐ Community favourite · ❤️ Saved · ✨ Several nearby —
        dim ones aren&apos;t on tonight.{" "}
        {shown.length === 0 && (
          <span data-testid="empty-town">
            No published displays {place ? `in ${place.label}` : "here"} yet —
            seen one? Tap <strong>Add</strong>.
          </span>
        )}
      </p>
    </div>
  );
}
