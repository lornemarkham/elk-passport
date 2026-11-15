"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Clock,
  MapPin,
  Navigation,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
} from "lucide-react";
import type { ItineraryStop, Place } from "@/domain/christmas/itinerary";
import { clockText, durationText } from "@/domain/christmas/edits";
import { NEED_LABEL } from "@/domain/christmas/request";
import { cn } from "@/lib/utils";

/** A real picture of the place, or a warm tile with its name — never a stand-in. */
export function PlacePicture({
  place,
  className,
  emoji,
  bare,
}: {
  readonly place: Place | undefined;
  readonly className?: string;
  /** With no picture, a slim festive band with this, instead of a tile. */
  readonly emoji?: string;
  /** With no picture, render nothing at all. */
  readonly bare?: boolean;
}) {
  const [broken, setBroken] = useState(0);
  const picture = place?.pictures[broken];
  if (!picture && bare) return null;
  if (!picture && emoji)
    return (
      <div
        className="relative flex h-16 items-center bg-[#082319] px-4 text-3xl"
        data-testid="stop-tile"
        style={{
          backgroundImage:
            "radial-gradient(circle at 12% 40%, rgba(255,217,138,.35) 0 2px, transparent 3px), radial-gradient(circle at 38% 70%, rgba(255,217,138,.3) 0 2px, transparent 3px), radial-gradient(circle at 66% 30%, rgba(179,36,47,.5) 0 2px, transparent 3px), radial-gradient(circle at 88% 64%, rgba(255,217,138,.35) 0 2px, transparent 3px)",
        }}
        aria-hidden
      >
        {emoji}
      </div>
    );
  if (!picture)
    return (
      <div
        className={cn(
          "flex items-end bg-gradient-to-br from-[#0f3b2b] to-[#082319] p-3 text-white",
          className,
        )}
        data-testid="stop-tile"
      >
        <span className="ghad-display line-clamp-2 text-base leading-tight font-extrabold">
          {place?.title ?? ""}
        </span>
      </div>
    );
  return (
    <div className={cn("relative overflow-hidden bg-black/10", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element -- Atlas-hosted or the lights map's own photo */}
      <img
        src={picture.src}
        alt={picture.alt || place!.title}
        className="h-full w-full object-cover"
        loading="lazy"
        onError={() => setBroken((n) => n + 1)}
        data-testid="stop-photo"
      />
      {picture.label && (
        <span className="absolute right-2 bottom-2 rounded-full bg-black/55 px-2 py-0.5 text-[11px] text-white">
          {picture.label}
        </span>
      )}
    </div>
  );
}

const button =
  "inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 text-sm font-bold ring-1 ring-black/10 hover:ring-black/30";

/**
 * **One stop.** What it is, when, where, why it's here and what Atlas (or the
 * lights map) doesn't know — then the four changes: directions, replace,
 * change time, remove. An unresolved stop says why and offers the honest
 * ways on: the nearest real option, a day it can happen, or taking it out.
 */
export function StopCard({
  stop,
  editing,
  hrefFor,
  tour,
}: {
  readonly stop: ItineraryStop;
  readonly editing: boolean;
  readonly hrefFor: (change: StopChange) => string;
  readonly tour?: string;
}) {
  const [open, setOpen] = useState<null | "replace" | "nearby" | "time">(null);
  const [time, setTime] = useState(
    stop.time !== undefined
      ? `${String(Math.floor(stop.time / 60)).padStart(2, "0")}:${String(stop.time % 60).padStart(2, "0")}`
      : "",
  );

  if (stop.status === "unresolved")
    return (
      <article
        className="rounded-[24px] border-2 border-dashed border-[#b3242f]/40 bg-[#fff8ef] p-4"
        data-testid="stop-unresolved"
        data-need={stop.need}
      >
        <div className="flex items-start gap-3">
          <span className="text-2xl" aria-hidden>
            {stop.emoji}
          </span>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-xs font-bold tracking-[0.12em] text-[#8e1d26] uppercase">
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
              Couldn&apos;t confirm one
            </p>
            <h3 className="ghad-display mt-0.5 text-xl font-extrabold">
              {stop.label}
            </h3>
            <p
              className="mt-1 text-sm text-[var(--gh-ink-soft)]"
              data-testid="stop-reason"
            >
              {stop.reason}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {stop.tryDay && (
                <Link
                  href={hrefFor({ kind: "day", day: stop.tryDay.day })}
                  className={cn(button, "bg-[#0f3b2b] text-white ring-0")}
                  data-testid="stop-try-day"
                  title={stop.tryDay.why}
                >
                  Try {stop.tryDay.label}
                </Link>
              )}
              {stop.nearest && (
                <Link
                  href={hrefFor({ kind: "pick", ref: stop.nearest.ref })}
                  className={cn(button, "bg-white")}
                  data-testid="stop-take-nearest"
                >
                  Add {stop.nearest.title} ({stop.nearest.km} km)
                </Link>
              )}
              <Link
                href={hrefFor({ kind: "drop" })}
                className={cn(button, "bg-white")}
                data-testid="stop-remove"
              >
                Take it out
              </Link>
            </div>
            {stop.tryDay && (
              <p className="mt-2 text-xs text-[var(--gh-ink-soft)]">
                {stop.tryDay.why}
              </p>
            )}
          </div>
        </div>
      </article>
    );

  const place = stop.place!;
  return (
    <article
      className="overflow-hidden rounded-[24px] bg-white shadow-[0_8px_30px_rgba(8,35,25,0.08)] ring-1 ring-black/5"
      data-testid="stop"
      data-need={stop.need}
    >
      <div className="relative">
        <PlacePicture
          place={place}
          emoji={stop.emoji}
          className="aspect-[16/9] w-full"
        />
        {!stop.said && (
          <span className="absolute top-3 right-3 rounded-full bg-[#ffd98a] px-3 py-1 text-xs font-bold text-[#082319]">
            Passport&apos;s idea
          </span>
        )}
      </div>
      <div className="p-4">
        <h3 className="ghad-display text-[1.45rem] leading-tight font-extrabold">
          <Link
            href={place.href}
            className="hover:underline"
            data-testid="stop-name"
          >
            {place.title}
          </Link>
        </h3>
        <p className="mt-1 flex items-center gap-1 text-sm text-[var(--gh-ink-soft)]">
          <MapPin className="h-4 w-4 shrink-0" aria-hidden />
          {[
            place.what,
            place.where,
            place.km !== undefined ? `${place.km} km away` : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
        {place.description && (
          <p className="mt-2 text-[0.95rem] leading-snug">
            {place.description}
          </p>
        )}
        {stop.displays && (
          <ol className="mt-3 space-y-1.5" data-testid="stop-displays">
            {stop.displays.map((d, i) => (
              <li key={d.ref} className="flex items-baseline gap-2 text-sm">
                <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#b3242f] text-[11px] font-bold text-white">
                  {i + 1}
                </span>
                <Link href={d.href} className="font-semibold hover:underline">
                  {d.title}
                </Link>
                <span className="text-[var(--gh-ink-soft)]">{d.what}</span>
              </li>
            ))}
          </ol>
        )}
        <ul className="mt-3 space-y-1 text-sm">
          {stop.minutes !== undefined && (
            <li className="flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-[#0f3b2b]" aria-hidden />
              {stop.timeIs === "starts" ? "Starts at its listed time · " : ""}
              About {durationText(stop.minutes)}
            </li>
          )}
          {place.when && (
            <li className="text-[var(--gh-ink-soft)]">📅 {place.when}</li>
          )}
          {place.hours && (
            <li className="text-[var(--gh-ink-soft)]" data-testid="stop-hours">
              🕰️ {place.hours}
            </li>
          )}
          {stop.notes.map((n) => (
            <li
              key={n}
              className="font-semibold text-[#8e1d26]"
              data-testid="stop-note"
            >
              {n}
            </li>
          ))}
          <li
            className="text-xs text-[var(--gh-ink-soft)]"
            data-testid="stop-why"
          >
            {place.why}
          </li>
        </ul>
        <div className="mt-4 flex flex-wrap gap-2">
          {stop.directions && (
            <a
              href={stop.directions}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(button, "bg-[#0f3b2b] text-white ring-0")}
              data-testid="stop-directions"
            >
              <Navigation className="h-4 w-4" aria-hidden />
              Directions
            </a>
          )}
          {tour && (
            <Link
              href={tour}
              className={cn(button, "bg-white")}
              data-testid="stop-tour"
            >
              <Sparkles className="h-4 w-4" aria-hidden />
              On the lights map
            </Link>
          )}
          {(editing || stop.alternatives.length > 0) &&
            stop.alternatives.length > 0 && (
              <button
                type="button"
                onClick={() => setOpen(open === "replace" ? null : "replace")}
                aria-expanded={open === "replace"}
                className={cn(button, "bg-white")}
                data-testid="stop-replace"
              >
                <RefreshCw className="h-4 w-4" aria-hidden />
                Replace
              </button>
            )}
          {editing && (
            <>
              <button
                type="button"
                onClick={() => setOpen(open === "time" ? null : "time")}
                aria-expanded={open === "time"}
                className={cn(button, "bg-white")}
                data-testid="stop-change-time"
              >
                <Clock className="h-4 w-4" aria-hidden />
                Change time
              </button>
              <Link
                href={hrefFor({ kind: "drop" })}
                className={cn(button, "bg-white text-[#8e1d26]")}
                data-testid="stop-remove"
              >
                <Trash2 className="h-4 w-4" aria-hidden />
                Remove
              </Link>
            </>
          )}
          {stop.nearby.length > 0 && (
            <button
              type="button"
              onClick={() => setOpen(open === "nearby" ? null : "nearby")}
              aria-expanded={open === "nearby"}
              className={cn(button, "bg-white")}
              data-testid="stop-nearby"
            >
              <Plus className="h-4 w-4" aria-hidden />
              Nearby
            </button>
          )}
        </div>
        {open === "time" && (
          <form
            className="mt-3 flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const [h, m] = time.split(":").map(Number);
              if (Number.isFinite(h) && Number.isFinite(m))
                window.location.assign(
                  hrefFor({ kind: "time", minutes: h! * 60 + m! }),
                );
            }}
          >
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="min-h-11 rounded-2xl border-2 border-black/10 px-3"
              aria-label={`New time for ${stop.label}`}
              data-testid="stop-time-input"
            />
            <button
              type="submit"
              className={cn(button, "bg-[#b3242f] text-white ring-0")}
              data-testid="stop-time-save"
            >
              Move it
            </button>
          </form>
        )}
        {open === "replace" && (
          <Choices
            title={`Other ${NEED_LABEL[stop.need].toLowerCase()} options`}
            places={stop.alternatives}
            hrefOf={(p) => hrefFor({ kind: "pick", ref: p.ref })}
            testid="stop-alternative"
          />
        )}
        {open === "nearby" && (
          <Choices
            title="A short walk from here"
            places={stop.nearby}
            hrefOf={(p) => hrefFor({ kind: "add", need: p.as!, ref: p.ref })}
            label={(p) =>
              p.as ? `Add as ${NEED_LABEL[p.as].toLowerCase()}` : "Add"
            }
            testid="stop-nearby-option"
          />
        )}
      </div>
    </article>
  );
}

export type StopChange =
  | { kind: "drop" }
  | { kind: "pick"; ref: string }
  | { kind: "time"; minutes: number }
  | { kind: "day"; day: string }
  | { kind: "add"; need: NonNullable<Place["as"]>; ref?: string };

function Choices({
  title,
  places,
  hrefOf,
  label = () => "Use this",
  testid,
}: {
  readonly title: string;
  readonly places: readonly Place[];
  readonly hrefOf: (p: Place) => string;
  readonly label?: (p: Place) => string;
  readonly testid: string;
}) {
  return (
    <div className="mt-3 rounded-[18px] bg-[#f6f1e7] p-3">
      <p className="text-xs font-bold tracking-[0.12em] text-[var(--gh-ink-soft)] uppercase">
        {title}
      </p>
      <ul className="mt-2 space-y-2">
        {places.map((p) => (
          <li key={p.ref} className="flex items-center gap-3">
            <PlacePicture place={p} className="h-14 w-14 shrink-0 rounded-xl" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold">{p.title}</p>
              <p className="truncate text-xs text-[var(--gh-ink-soft)]">
                {[p.what, p.km !== undefined ? `${p.km} km` : null, p.hours]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
            <Link
              href={hrefOf(p)}
              className="inline-flex min-h-11 shrink-0 items-center rounded-full bg-white px-3 text-sm font-bold ring-1 ring-black/10"
              data-testid={testid}
            >
              {label(p)}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function TravelLine({
  minutes,
  km,
  mode,
}: {
  readonly minutes: number;
  readonly km: number;
  readonly mode: "drive" | "walk";
}) {
  return (
    <p
      className="flex items-center gap-2 py-1 pl-6 text-sm text-[var(--gh-ink-soft)]"
      data-testid="stop-travel"
    >
      <span className="h-6 w-0.5 rounded bg-[#0f3b2b]/25" aria-hidden />
      <span>
        {mode === "walk" ? "🚶" : "🚗"} about {minutes} min · {km} km
        <span className="text-xs"> · estimate</span>
      </span>
    </p>
  );
}

export const clock = clockText;
