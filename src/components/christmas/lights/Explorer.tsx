"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Route, X } from "lucide-react";
import {
  KIND_EMOJI,
  KIND_LABEL,
  TOWNS,
  TOWN_AT,
  TOWN_LABEL,
  type Kind,
  type PinView,
  type TownId,
  photoSrc,
} from "@/domain/christmas/lights/model";
import { LightsMap, type MapMarker } from "./LightsMap";
import { PinCard, SeasonBadge } from "./PinCard";
import { Reactions } from "./Reactions";
import { toggleStash, useStash } from "./stash";

export interface Festive {
  readonly id: string;
  readonly name: string;
  readonly at: { readonly lat: number; readonly lng: number };
  readonly line: string;
  readonly href: string;
  readonly emoji: string;
}

type Filter = "all" | Kind | "atlas";

/**
 * **The map, the filters and the sheet.** Tap a light and its card slides up
 * with the reactions and _Add to my tour_; the list below is the same pins,
 * for anyone who would rather scroll than pan.
 */
export function Explorer({
  pins,
  festive,
  signedIn,
  initialTown,
}: {
  readonly pins: readonly PinView[];
  readonly festive: readonly Festive[];
  readonly signedIn: boolean;
  readonly initialTown: TownId | null;
}) {
  const [town, setTown] = useState<TownId | null>(initialTown);
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<string | null>(null);
  const stash = useStash();

  const published = pins.filter((p) => p.status === "approved");
  const mine = pins.filter((p) => p.yours && p.status !== "approved");
  const shown = published.filter(
    (p) =>
      (!town || p.town === town) && (filter === "all" || filter === p.kind),
  );
  const festiveShown = filter === "all" || filter === "atlas" ? festive : [];
  const kindsPresent = [...new Set(published.map((p) => p.kind))];

  const markers: MapMarker[] = [
    ...shown.map((p) => ({
      id: p.id,
      at: p.at,
      emoji: KIND_EMOJI[p.kind],
      label: `${p.name} — ${KIND_LABEL[p.kind]}`,
      dim: p.season !== "lit",
      selected: p.id === selected,
    })),
    ...festiveShown.map((f) => ({
      id: f.id,
      at: f.at,
      emoji: f.emoji,
      label: `${f.name} — from Atlas`,
      selected: f.id === selected,
    })),
  ];
  const center = town ? TOWN_AT[town] : TOWN_AT.vernon;
  const pick = published.find((p) => p.id === selected);
  const pickFestive = festive.find((f) => f.id === selected);

  const chip = (on: boolean) =>
    `inline-flex min-h-10 shrink-0 items-center gap-1 rounded-full px-4 text-sm font-bold transition ${
      on
        ? "bg-[#ffd98a] text-[#082319]"
        : "bg-white/10 text-white hover:bg-white/20"
    }`;

  return (
    <div>
      <div
        className="flex gap-2 overflow-x-auto pb-3"
        role="group"
        aria-label="Town"
      >
        <button
          type="button"
          className={chip(!town)}
          onClick={() => setTown(null)}
          aria-pressed={!town}
        >
          Everywhere
        </button>
        {TOWNS.map((t) => (
          <button
            key={t}
            type="button"
            className={chip(town === t)}
            onClick={() => setTown(t)}
            aria-pressed={town === t}
            data-testid={`town-${t}`}
          >
            {TOWN_LABEL[t]}
          </button>
        ))}
      </div>
      <div
        className="flex gap-2 overflow-x-auto pb-4"
        role="group"
        aria-label="What kind"
      >
        <button
          type="button"
          className={chip(filter === "all")}
          onClick={() => setFilter("all")}
        >
          ✨ All the magic
        </button>
        {kindsPresent.map((k) => (
          <button
            key={k}
            type="button"
            className={chip(filter === k)}
            onClick={() => setFilter(k)}
          >
            {KIND_EMOJI[k]} {KIND_LABEL[k]}
          </button>
        ))}
        {festive.length > 0 && (
          <button
            type="button"
            className={chip(filter === "atlas")}
            onClick={() => setFilter("atlas")}
          >
            🎁 Festive, from Atlas
          </button>
        )}
      </div>

      <div className="relative">
        <LightsMap
          markers={markers}
          center={center}
          zoom={town ? 13 : 9}
          onSelect={setSelected}
          label={`Christmas lights map: ${shown.length} displays${festiveShown.length ? ` and ${festiveShown.length} festive stops` : ""}`}
        />
        {(pick || pickFestive) && (
          <div
            className="absolute inset-x-2 bottom-2 z-10 rounded-[24px] bg-white p-4 text-[#082319] shadow-2xl sm:inset-x-auto sm:right-3 sm:w-[380px]"
            data-testid="map-sheet"
          >
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="absolute top-2 right-2 rounded-full p-2 text-[#0f3b2b] hover:bg-black/5"
              aria-label="Close"
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
            {pick ? (
              <div className="flex gap-3">
                {photoSrc(pick) && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photoSrc(pick)!}
                    alt=""
                    className="h-20 w-20 shrink-0 rounded-2xl object-cover"
                  />
                )}
                <div className="min-w-0 flex-1 pr-6">
                  <p className="text-xs font-bold tracking-[0.12em] text-[#b3242f] uppercase">
                    {KIND_LABEL[pick.kind]} · {TOWN_LABEL[pick.town]}
                  </p>
                  <h3 className="ghad-display text-lg leading-tight font-extrabold">
                    {pick.name}
                  </h3>
                  <div className="mt-1">
                    <SeasonBadge pin={pick} />
                  </div>
                </div>
              </div>
            ) : pickFestive ? (
              <div className="pr-6">
                <p className="text-xs font-bold tracking-[0.12em] text-[#b3242f] uppercase">
                  From Atlas
                </p>
                <h3 className="ghad-display text-lg leading-tight font-extrabold">
                  {pickFestive.name}
                </h3>
                {pickFestive.line && (
                  <p className="text-sm text-[#3d4a43]">{pickFestive.line}</p>
                )}
              </div>
            ) : null}
            {pick && (
              <div className="mt-3">
                <Reactions
                  key={pick.id}
                  pin={pick}
                  signedIn={signedIn}
                  compact
                />
              </div>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => toggleStash((pick ?? pickFestive)!.id)}
                className="inline-flex min-h-11 items-center rounded-full bg-[#ffd98a] px-4 text-sm font-bold"
                data-testid="sheet-add-to-tour"
              >
                {stash.includes((pick ?? pickFestive)!.id)
                  ? "✓ On my tour"
                  : "+ Add to my tour"}
              </button>
              <Link
                href={pick ? `/christmas/lights/${pick.id}` : pickFestive!.href}
                className="inline-flex min-h-11 items-center gap-1 rounded-full px-4 text-sm font-bold ring-1 ring-[#0f3b2b]/20"
                data-testid="sheet-open"
              >
                See it <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          </div>
        )}
      </div>
      <p className="mt-2 text-sm text-white/75">
        Dim lights aren&apos;t confirmed for this season yet.
        {festive.length > 0
          ? " 🛍️🎅🎭 are markets, Santa and shows from Atlas."
          : ""}
      </p>

      {stash.length > 0 && (
        <Link
          href="/christmas/lights/tour"
          className="mt-4 flex min-h-14 items-center justify-between gap-3 rounded-[20px] bg-[#ffd98a] px-5 font-extrabold text-[#082319]"
          data-testid="tour-bar"
        >
          <span className="inline-flex items-center gap-2">
            <Route className="h-5 w-5" aria-hidden />
            {stash.length} {stash.length === 1 ? "stop" : "stops"} on my tour
          </span>
          <span className="inline-flex items-center gap-1">
            Build it <ArrowRight className="h-5 w-5" aria-hidden />
          </span>
        </Link>
      )}

      {mine.length > 0 && (
        <section className="mt-10" data-testid="my-pins">
          <h2 className="ghad-display text-2xl font-extrabold text-white">
            Your pins
          </h2>
          <p className="text-white/80">
            Only you and the reviewers can see these until they&apos;re
            published.
          </p>
          <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {mine.map((p) => (
              <li key={p.id}>
                <PinCard pin={p} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-10">
        <h2 className="ghad-display text-2xl font-extrabold text-white">
          {town ? `Lights in ${TOWN_LABEL[town]}` : "Every light on the map"}
        </h2>
        {shown.length === 0 ? (
          <p className="mt-2 max-w-xl text-white/85" data-testid="empty-town">
            Nobody has pinned a display{" "}
            {town ? `in ${TOWN_LABEL[town]}` : "here"} yet. Seen one? You could
            be the first — tap <strong>PIN THE MAGIC!</strong>
          </p>
        ) : (
          <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((p) => (
              <li key={p.id}>
                <PinCard
                  pin={p}
                  onFocus={() => {
                    setSelected(p.id);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
