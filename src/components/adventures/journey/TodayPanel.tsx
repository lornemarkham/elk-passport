"use client";

import { useEffect, useState } from "react";
import { Check, Navigation, PartyPopper } from "lucide-react";
import type { Experience } from "@/domain/experience/types";
import type { ItemView } from "@/lib/adventures/store";
import type { DayDetail } from "@/lib/adventures/propose";
import { clockLabel, minutesLabel } from "@/lib/adventures/present";
import { placeLabel } from "@/domain/discovery/compose";
import { cn } from "@/lib/utils";
import { Picture } from "../Picture";
import { pillClass } from "../kit";

/** Directions to a stop: its coordinates where Atlas states them, else its name and place. */
export function directionsHref(
  experience: Experience | undefined,
  name: string,
): string {
  const c = experience?.geography?.coordinates;
  const destination = c
    ? `${c[1]},${c[0]}`
    : [name, experience ? placeLabel(experience) : undefined]
        .filter(Boolean)
        .join(", ");
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
}

/**
 * **Today's adventure** — START is a mode change (doctrine §2.7).
 *
 * On the day, the page leads with one question: _what's next?_ The next stop
 * nobody has ticked off, its hours in the publisher's words, how long the
 * plan gives it, and directions. _Done_ moves on. Nothing ticks, counts or
 * notifies (doctrine §6, Go Offline's rules); the ticks are kept on this
 * device only, because where memories live is still open (D-9).
 */
export function TodayPanel({
  adventureId,
  onDay,
  stops,
  names,
  experiences,
  detail,
}: {
  readonly adventureId: string;
  readonly onDay: string;
  readonly stops: readonly ItemView[];
  readonly names: Readonly<Record<string, string>>;
  readonly experiences: Readonly<Record<string, Experience>>;
  readonly detail: DayDetail | undefined;
}) {
  const key = `gh.done.${adventureId}.${onDay}`;
  const [done, setDone] = useState<readonly string[]>([]);
  useEffect(() => {
    try {
      const stored = JSON.parse(window.localStorage.getItem(key) ?? "[]");
      // eslint-disable-next-line react-hooks/set-state-in-effect -- read once from this device
      if (Array.isArray(stored))
        setDone(stored.filter((s) => typeof s === "string"));
    } catch {
      // Nothing kept on this device; start from the first stop.
    }
  }, [key]);
  const mark = (id: string, on: boolean) => {
    const next = on
      ? [...new Set([...done, id])]
      : done.filter((d) => d !== id);
    setDone(next);
    try {
      window.localStorage.setItem(key, JSON.stringify(next));
    } catch {
      // Not kept; still shown for this visit.
    }
  };

  const next = stops.find((s) => !done.includes(s.id));
  const nameOf = (item: ItemView) =>
    item.label ??
    (item.atlasRef
      ? (experiences[item.atlasRef]?.title ?? names[item.atlasRef])
      : undefined) ??
    "A stop";

  return (
    <section
      aria-labelledby="today-heading"
      data-testid="today-panel"
      className="overflow-hidden rounded-[28px] bg-[var(--gh-sun)] text-[var(--gh-ink)]"
    >
      <div className="p-5 sm:p-8">
        <p className="text-xs font-bold tracking-[0.14em] uppercase">
          Today&apos;s adventure
        </p>
        <h2
          id="today-heading"
          className="ghad-display mt-1 text-3xl leading-tight font-extrabold tracking-[-0.03em] sm:text-5xl"
        >
          {next ? "What's next" : "That's the day."}
        </h2>

        {next ? (
          <NextStop
            item={next}
            name={nameOf(next)}
            experience={next.atlasRef ? experiences[next.atlasRef] : undefined}
            stop={next.atlasRef ? detail?.stops[next.atlasRef] : undefined}
            onDone={() => mark(next.id, true)}
          />
        ) : (
          <p className="mt-3 flex items-center gap-2 text-lg font-semibold">
            <PartyPopper className="h-6 w-6" aria-hidden />
            Hell of a day? Write down what happened before you forget.
          </p>
        )}

        <ol className="mt-6 space-y-1.5" aria-label="Today's stops">
          {stops.map((stop, i) => {
            const isDone = done.includes(stop.id);
            return (
              <li key={stop.id}>
                <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-2xl bg-white/50 px-3 text-base font-semibold">
                  <input
                    type="checkbox"
                    checked={isDone}
                    onChange={(e) => mark(stop.id, e.target.checked)}
                    className="h-5 w-5 accent-[var(--gh-forest)]"
                  />
                  <span className={cn(isDone && "line-through opacity-60")}>
                    {i + 1}. {nameOf(stop)}
                  </span>
                </label>
              </li>
            );
          })}
        </ol>
        <p className="mt-6 text-sm font-bold tracking-[0.1em] uppercase">
          Put the phone away. Go have a day.
        </p>
      </div>
    </section>
  );
}

function NextStop({
  item,
  name,
  experience,
  stop,
  onDone,
}: {
  readonly item: ItemView;
  readonly name: string;
  readonly experience: Experience | undefined;
  readonly stop: DayDetail["stops"][string] | undefined;
  readonly onDone: () => void;
}) {
  const where = experience ? placeLabel(experience) : undefined;
  return (
    <div
      data-testid="today-next"
      className="mt-4 flex flex-col gap-4 rounded-3xl bg-white p-4 sm:flex-row sm:p-5"
    >
      <Picture
        experience={experience}
        fallbackTitle={name}
        className="aspect-[16/10] w-full shrink-0 rounded-2xl sm:w-64"
      />
      <div className="min-w-0 flex-1">
        <p className="ghad-display text-2xl font-extrabold">{name}</p>
        {where && (
          <p className="text-base text-[var(--gh-ink-soft)]">{where}</p>
        )}
        <ul className="mt-2 space-y-1 text-base">
          {stop?.arrive !== undefined && (
            <li>About {clockLabel(stop.arrive)}</li>
          )}
          {stop && (
            <li>The plan gives it about {minutesLabel(stop.minutes)}</li>
          )}
          {stop?.open && <li className="font-semibold">{stop.open}</li>}
          {stop?.hours && <li>Published hours: {stop.hours}</li>}
          {stop?.notes.slice(0, 2).map((n) => (
            <li key={n}>{n}</li>
          ))}
          {item.note && <li>{item.note}</li>}
        </ul>
        <div className="mt-4 flex flex-wrap gap-2">
          <a
            href={directionsHref(experience, name)}
            target="_blank"
            rel="noreferrer"
            data-testid="today-directions"
            className={pillClass("primary")}
          >
            <Navigation className="h-4 w-4" aria-hidden />
            Directions
          </a>
          <button
            type="button"
            data-testid="today-done"
            onClick={onDone}
            className={pillClass("forest")}
          >
            <Check className="h-4 w-4" aria-hidden />
            Done — what&apos;s next
          </button>
        </div>
      </div>
    </div>
  );
}
