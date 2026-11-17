"use client";

import { useEffect, useRef, useState } from "react";
import { Heart, Navigation, Star } from "lucide-react";
import {
  KIND_EMOJI,
  photoSrc,
  type LatLng,
  type PinView,
} from "@/domain/christmas/lights/model";
import { placeLabel } from "@/domain/christmas/lights/areas";
import {
  clockText,
  type Mode,
  type TimedStop,
} from "@/domain/christmas/lights/tour";
import { Rate } from "./Rate";
import { toggleSaved, useSaved } from "./stash";

/** One stop in the family's own map app: from wherever the phone is, to this display. */
export function navigateUrl(to: LatLng, mode: Mode): string {
  const u = new URL("https://www.google.com/maps/dir/");
  u.searchParams.set("api", "1");
  u.searchParams.set("destination", `${to.lat},${to.lng}`);
  u.searchParams.set("travelmode", mode === "walk" ? "walking" : "driving");
  return u.toString();
}

/**
 * **On tour** (Lights Map 2.0). Once the tour starts the page is one stop
 * at a time — _STOP 3 OF 8_, the display, how far it is — and three big
 * buttons: Navigate (the phone's own map app does the driving), Rate
 * Display, Next Stop. Skip, change the route, end, and ❤️ save sit
 * underneath. Nothing here needs reading while the car is moving.
 */
export function TourGo({
  stops,
  pins,
  mode,
  signedIn,
  onChange,
  onSkip,
  onEnd,
}: {
  readonly stops: readonly TimedStop[];
  readonly pins: ReadonlyMap<string, PinView>;
  readonly from: LatLng;
  readonly mode: Mode;
  readonly signedIn: boolean;
  readonly onChange: () => void;
  readonly onSkip: (id: string) => void;
  readonly onEnd: () => void;
}) {
  const [i, setI] = useState(0);
  const [rating, setRating] = useState(false);
  const [done, setDone] = useState(false);
  const [seen, setSeen] = useState<string[]>([]);
  const saved = useSaved();
  const top = useRef<HTMLElement>(null);
  // Each stop starts at the top of the screen: the count, the name, Navigate.
  useEffect(() => {
    top.current?.scrollIntoView({ block: "start" });
  }, [i, done]);
  const at = i;
  // Skipping the last stop ends the tour.
  const here = stops[at];

  if (done || !here)
    return (
      <section
        ref={top}
        className="space-y-4 rounded-[28px] bg-white p-6 text-center text-[#082319]"
        data-testid="tour-done"
        role="status"
      >
        <p className="text-5xl" aria-hidden>
          🎄✨
        </p>
        <h2 className="ghad-display text-3xl font-extrabold">
          That&apos;s the tour!
        </h2>
        <p>
          You saw {seen.length} {seen.length === 1 ? "display" : "displays"}.
          Rate the ones you loved — it&apos;s how the next family finds them.
        </p>
        <button
          type="button"
          onClick={onEnd}
          className="min-h-12 rounded-full bg-[#b3242f] px-6 font-extrabold text-white"
          data-testid="tour-back"
        >
          Back to the tour
        </button>
      </section>
    );

  const pin = pins.get(here.stop.id);
  const src = pin ? photoSrc(pin) : null;
  const isSaved = saved.includes(here.stop.id);
  const next = () => {
    setSeen((s) => (s.includes(here.stop.id) ? s : [...s, here.stop.id]));
    setRating(false);
    if (at + 1 >= stops.length) setDone(true);
    else setI(at + 1);
  };

  return (
    <section
      ref={top}
      className="scroll-mt-2 overflow-hidden rounded-[28px] bg-white text-[#082319] shadow-2xl"
      data-testid="tour-go"
    >
      <div className="relative bg-[#082319]">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={`${here.stop.name}, photographed by a local`}
            className="h-52 w-full object-cover"
          />
        ) : (
          <div
            className="xm-glow flex h-40 items-center justify-center text-7xl"
            aria-hidden
          >
            {here.stop.kind === "atlas" ? "🎁" : KIND_EMOJI[here.stop.kind]}
          </div>
        )}
        <p
          className="absolute top-3 left-3 rounded-full bg-[#b3242f] px-3 py-1 text-sm font-extrabold tracking-[0.12em] text-white uppercase"
          data-testid="go-count"
        >
          Stop {at + 1} of {stops.length}
        </p>
      </div>
      <div className="space-y-4 p-5">
        <div>
          <h2
            className="ghad-display text-3xl leading-tight font-extrabold"
            data-testid="go-name"
          >
            {here.stop.name}
          </h2>
          <p className="text-lg text-[#3d4a43]" data-testid="go-travel">
            {pin ? `${placeLabel(pin)} · ` : ""}
            {clockText(here.leg.minutes)} {mode === "walk" ? "walk" : "drive"} ·{" "}
            {here.leg.km} km · see it ~{here.stay} min
          </p>
        </div>

        <a
          href={navigateUrl(here.stop.at, mode)}
          target="_blank"
          rel="noreferrer"
          className="flex min-h-16 w-full items-center justify-center gap-2 rounded-full bg-[#ffd98a] text-xl font-extrabold"
          data-testid="go-navigate"
        >
          <Navigation className="h-6 w-6" aria-hidden /> Navigate
        </a>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setRating((r) => !r)}
            aria-expanded={rating}
            className="flex min-h-14 items-center justify-center gap-2 rounded-full font-extrabold ring-2 ring-[#0f3b2b]/20"
            data-testid="go-rate"
            disabled={!pin}
          >
            <Star className="h-5 w-5" aria-hidden /> Rate Display
          </button>
          <button
            type="button"
            onClick={next}
            className="flex min-h-14 items-center justify-center rounded-full bg-[#b3242f] text-lg font-extrabold text-white"
            data-testid="go-next"
          >
            {at + 1 >= stops.length ? "Finish" : "Next Stop →"}
          </button>
        </div>
        {rating && pin && (
          <div className="rounded-2xl bg-[#fbf6ec] p-3">
            <Rate pin={pin} signedIn={signedIn} next="/christmas/lights/tour" />
          </div>
        )}

        <div className="flex flex-wrap justify-center gap-2 border-t border-[#0f3b2b]/10 pt-3 text-sm">
          <button
            type="button"
            onClick={() => {
              onSkip(here.stop.id);
              setRating(false);
            }}
            className="min-h-11 rounded-full px-4 font-bold ring-1 ring-[#0f3b2b]/20"
            data-testid="go-skip"
          >
            Skip stop
          </button>
          <button
            type="button"
            onClick={() => toggleSaved(here.stop.id)}
            aria-pressed={isSaved}
            className="inline-flex min-h-11 items-center gap-1 rounded-full px-4 font-bold ring-1 ring-[#0f3b2b]/20"
            data-testid="go-save"
          >
            <Heart
              className={`h-4 w-4 ${isSaved ? "fill-[#b3242f] text-[#b3242f]" : ""}`}
              aria-hidden
            />
            {isSaved ? "Saved" : "Save favourite"}
          </button>
          <button
            type="button"
            onClick={onChange}
            className="min-h-11 rounded-full px-4 font-bold ring-1 ring-[#0f3b2b]/20"
            data-testid="go-change"
          >
            Change route
          </button>
          <button
            type="button"
            onClick={() => setDone(true)}
            className="min-h-11 rounded-full px-4 font-bold text-[#b3242f] ring-1 ring-[#b3242f]/30"
            data-testid="go-end"
          >
            End tour
          </button>
        </div>
      </div>
    </section>
  );
}
