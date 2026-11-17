"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Heart,
  Navigation,
  SkipForward,
  Star,
  Timer,
  X,
} from "lucide-react";
import type { Itinerary, ItineraryStop } from "@/domain/christmas/itinerary";
import { clockText } from "@/domain/christmas/edits";
import { cn } from "@/lib/utils";
import { PlacePicture } from "./StopCard";

interface LiveState {
  /** Index into the planned stops of the one you're at or heading to. */
  readonly at: number;
  /** Minutes behind the plan — every later time moves by this. */
  readonly late: number;
  readonly skipped: readonly string[];
  readonly done: boolean;
  readonly loved: readonly string[];
  readonly stars: Readonly<Record<string, number>>;
}

const START: LiveState = {
  at: 0,
  late: 0,
  skipped: [],
  done: false,
  loved: [],
  stars: {},
};

function load(key: string): LiveState {
  try {
    const raw = window.localStorage.getItem(key);
    return raw
      ? { ...START, ...(JSON.parse(raw) as Partial<LiveState>) }
      : START;
  } catch {
    return START;
  }
}

/**
 * **Start Day: what's next.** START is a mode change (doctrine §2.7) — one
 * card for where you're going, a Directions button, the stop after it and
 * the drive between, and the three changes real evenings need: running late,
 * skip this, we're here. After the last stop it turns to **memories**: which
 * stops you loved and how they rated — kept on this phone; the group's
 * photos and memories live on the adventure (Share saves it there).
 */
export function LiveDay({
  itinerary,
  storageKey,
  onClose,
  signedIn,
  onKeep,
}: {
  readonly itinerary: Itinerary;
  readonly storageKey: string;
  readonly onClose: () => void;
  readonly signedIn: boolean;
  readonly onKeep: () => void;
}) {
  const [state, setState] = useState<LiveState>(START);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    // Reading this phone's own record of the day once, after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is only readable in the browser
    setState(load(storageKey));
    setReady(true);
  }, [storageKey]);
  useEffect(() => {
    if (ready) window.localStorage.setItem(storageKey, JSON.stringify(state));
  }, [ready, state, storageKey]);

  const stops = itinerary.stops.filter(
    (s) => s.status === "planned" && !state.skipped.includes(s.need),
  );
  const current = stops[Math.min(state.at, stops.length - 1)];
  const next = stops[state.at + 1];
  const update = (patch: Partial<LiveState>) =>
    setState((s) => ({ ...s, ...patch }));
  const at = (s: ItineraryStop | undefined) =>
    s?.time !== undefined ? clockText(s.time + state.late) : "";

  if (state.done || !current)
    return (
      <After
        itinerary={itinerary}
        state={state}
        update={update}
        onClose={onClose}
        signedIn={signedIn}
        onKeep={onKeep}
        restart={() => setState(START)}
      />
    );

  return (
    <section className="mt-2" data-testid="live-day">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold tracking-[0.18em] text-[#b3242f] uppercase">
          Live · stop {state.at + 1} of {stops.length}
        </p>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex min-h-11 items-center gap-1 rounded-full px-3 text-sm font-bold ring-1 ring-black/10"
          data-testid="live-close"
        >
          <X className="h-4 w-4" aria-hidden /> The plan
        </button>
      </div>
      <h2 className="ghad-display mt-2 text-4xl leading-none font-extrabold">
        What&apos;s next
      </h2>
      {state.late > 0 && (
        <p
          className="mt-2 text-sm font-semibold text-[#8e1d26]"
          data-testid="live-late"
        >
          Running {state.late} min behind — every time below has moved.
        </p>
      )}
      <article
        className="mt-4 overflow-hidden rounded-[28px] bg-[#082319] text-white shadow-xl"
        data-testid="live-current"
      >
        <PlacePicture
          place={current.place}
          bare
          className="aspect-[16/9] w-full"
        />
        <div className="p-5">
          <p className="text-sm font-bold text-[#ffd98a]">
            {current.emoji} {current.label} · {at(current)}
          </p>
          <h3 className="ghad-display mt-1 text-3xl leading-tight font-extrabold">
            {current.place?.title}
          </h3>
          <p className="mt-1 text-sm text-white/75">
            {[current.place?.where, current.place?.hours]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {current.displays && (
            <p className="mt-2 text-sm text-white/85">
              {current.displays.length} displays:{" "}
              {current.displays.map((d) => d.title).join(" → ")}
            </p>
          )}
          {current.notes.map((n) => (
            <p key={n} className="mt-2 text-sm font-semibold text-[#ffd98a]">
              {n}
            </p>
          ))}
          {current.directions && (
            <a
              href={current.directions}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-[#ffd98a] text-lg font-extrabold text-[#082319]"
              data-testid="live-directions"
            >
              <Navigation className="h-5 w-5" aria-hidden /> Directions
            </a>
          )}
        </div>
      </article>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() => update({ late: state.late + 15 })}
          className="inline-flex min-h-12 flex-col items-center justify-center rounded-2xl bg-white text-xs font-bold ring-1 ring-black/10"
          data-testid="live-running-late"
        >
          <Timer className="h-4 w-4" aria-hidden /> Running late
        </button>
        <button
          type="button"
          onClick={() => update({ skipped: [...state.skipped, current.need] })}
          className="inline-flex min-h-12 flex-col items-center justify-center rounded-2xl bg-white text-xs font-bold ring-1 ring-black/10"
          data-testid="live-skip"
        >
          <SkipForward className="h-4 w-4" aria-hidden /> Skip this
        </button>
        <button
          type="button"
          onClick={() =>
            next ? update({ at: state.at + 1 }) : update({ done: true })
          }
          className="inline-flex min-h-12 flex-col items-center justify-center rounded-2xl bg-[#b3242f] text-xs font-bold text-white"
          data-testid="live-next"
        >
          <ArrowRight className="h-4 w-4" aria-hidden />{" "}
          {next ? "Done — next" : "That's the day"}
        </button>
      </div>

      {next ? (
        <article
          className="mt-4 flex items-center gap-3 rounded-[22px] bg-white p-3 ring-1 ring-black/5"
          data-testid="live-next-stop"
        >
          <PlacePicture
            place={next.place}
            className="h-16 w-16 shrink-0 rounded-2xl"
          />
          <div className="min-w-0">
            <p className="text-xs font-bold tracking-[0.12em] text-[var(--gh-ink-soft)] uppercase">
              Then · {at(next)}
            </p>
            <p className="truncate font-extrabold">
              {next.emoji} {next.place?.title}
            </p>
            {next.travel && (
              <p
                className="text-sm text-[var(--gh-ink-soft)]"
                data-testid="live-travel"
              >
                About {next.travel.minutes} min{" "}
                {itinerary.mode === "walk" ? "on foot" : "by car"} ·{" "}
                {next.travel.km} km (estimate)
              </p>
            )}
          </div>
        </article>
      ) : (
        <p className="mt-4 text-sm text-[var(--gh-ink-soft)]">
          This is the last stop. Enjoy it.
        </p>
      )}
      {current.nearby.length > 0 && (
        <div
          className="mt-4 rounded-[22px] bg-[#f6f1e7] p-3"
          data-testid="live-nearby"
        >
          <p className="text-xs font-bold tracking-[0.12em] text-[var(--gh-ink-soft)] uppercase">
            Close by, if plans change
          </p>
          <ul className="mt-2 space-y-1 text-sm">
            {current.nearby.map((p) => (
              <li key={p.ref}>
                <Link
                  href={p.href}
                  className="font-semibold underline-offset-4 hover:underline"
                >
                  {p.title}
                </Link>{" "}
                <span className="text-[var(--gh-ink-soft)]">· {p.what}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function After({
  itinerary,
  state,
  update,
  onClose,
  signedIn,
  onKeep,
  restart,
}: {
  readonly itinerary: Itinerary;
  readonly state: LiveState;
  readonly update: (patch: Partial<LiveState>) => void;
  readonly onClose: () => void;
  readonly signedIn: boolean;
  readonly onKeep: () => void;
  readonly restart: () => void;
}) {
  const lived = itinerary.stops.filter(
    (s) => s.status === "planned" && !state.skipped.includes(s.need),
  );
  const maps = lived.flatMap((s) =>
    (s.displays ?? (s.place ? [s.place] : [])).filter(
      (p) => p.source === "map",
    ),
  );
  return (
    <section className="mt-2" data-testid="after-day">
      <p className="text-xs font-bold tracking-[0.18em] text-[#b3242f] uppercase">
        After
      </p>
      <h2 className="ghad-display mt-2 text-4xl leading-none font-extrabold">
        How was it?
      </h2>
      <p className="mt-2 text-sm text-[var(--gh-ink-soft)]">
        Tap the ones you loved and rate them. It stays on this phone.
      </p>
      <ul className="mt-4 space-y-2">
        {lived.map((s) => {
          const key = s.place?.ref ?? s.need;
          const loved = state.loved.includes(key);
          return (
            <li
              key={key}
              className="flex items-center gap-3 rounded-[20px] bg-white p-3 ring-1 ring-black/5"
              data-testid="after-stop"
            >
              <PlacePicture
                place={s.place}
                className="h-14 w-14 shrink-0 rounded-xl"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate font-extrabold">{s.place?.title}</p>
                <div
                  className="mt-1 flex gap-0.5"
                  role="radiogroup"
                  aria-label={`Rate ${s.place?.title}`}
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      role="radio"
                      aria-checked={state.stars[key] === n}
                      aria-label={`${n} star${n === 1 ? "" : "s"}`}
                      onClick={() =>
                        update({ stars: { ...state.stars, [key]: n } })
                      }
                      className="p-1"
                      data-testid="after-star"
                    >
                      <Star
                        className={cn(
                          "h-5 w-5",
                          (state.stars[key] ?? 0) >= n
                            ? "fill-[#ffd98a] text-[#c7901a]"
                            : "text-black/25",
                        )}
                        aria-hidden
                      />
                    </button>
                  ))}
                </div>
              </div>
              <button
                type="button"
                aria-pressed={loved}
                aria-label={loved ? "Loved it" : "Love it"}
                onClick={() =>
                  update({
                    loved: loved
                      ? state.loved.filter((x) => x !== key)
                      : [...state.loved, key],
                  })
                }
                className="inline-flex h-11 w-11 items-center justify-center rounded-full ring-1 ring-black/10"
                data-testid="after-love"
              >
                <Heart
                  className={cn(
                    "h-5 w-5",
                    loved ? "fill-[#b3242f] text-[#b3242f]" : "",
                  )}
                  aria-hidden
                />
              </button>
            </li>
          );
        })}
      </ul>
      {maps.length > 0 && (
        <div
          className="mt-4 rounded-[22px] bg-[#082319] p-4 text-white"
          data-testid="after-displays"
        >
          <p className="font-extrabold">Rate the displays for other families</p>
          <p className="text-sm text-white/75">
            On the community lights map — magical, festive, worth the drive.
          </p>
          <ul className="mt-2 space-y-1">
            {maps.map((p) => (
              <li key={p.ref}>
                <Link
                  href={p.href}
                  className="font-semibold text-[#ffd98a] underline-offset-4 hover:underline"
                >
                  {p.title} →
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="mt-4 rounded-[22px] bg-white p-4 ring-1 ring-black/5">
        <p className="font-extrabold">Photos and memories</p>
        <p className="mt-1 text-sm text-[var(--gh-ink-soft)]">
          {signedIn
            ? "Save the day as an adventure: everyone who came can add photos, favourite moments and finish a challenge — and you get the recap."
            : "Sign in and save the day as an adventure to keep photos and memories with everyone who came."}
        </p>
        {signedIn ? (
          <button
            type="button"
            onClick={onKeep}
            className="mt-3 inline-flex min-h-12 items-center rounded-full bg-[#b3242f] px-5 font-extrabold text-white"
            data-testid="after-keep"
          >
            Keep the memories
          </button>
        ) : (
          <a
            href={`/auth?next=${encodeURIComponent(typeof window === "undefined" ? "/christmas" : window.location.pathname + window.location.search)}`}
            className="mt-3 inline-flex min-h-12 items-center rounded-full bg-[#b3242f] px-5 font-extrabold text-white"
            data-testid="after-keep"
          >
            Sign in to keep the memories
          </a>
        )}
      </div>
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex min-h-11 items-center rounded-full px-4 text-sm font-bold ring-1 ring-black/10"
        >
          Back to the plan
        </button>
        <button
          type="button"
          onClick={restart}
          className="inline-flex min-h-11 items-center rounded-full px-4 text-sm font-bold ring-1 ring-black/10"
        >
          Start again
        </button>
      </div>
    </section>
  );
}
