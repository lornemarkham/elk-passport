"use client";

import Image from "next/image";
import { ChevronDown, Navigation, Sunset } from "lucide-react";
import { Picture } from "@/components/adventures/Picture";
import type { Experience } from "@/domain/experience/types";
import type { NightDay } from "@/domain/date-night/adventures";
import {
  composeDay,
  DEFAULT_ANSWERS,
  readAnswers,
  spokenClock,
  swapsOf,
} from "@/domain/date-night/adventures/compose";
import {
  directionsTo,
  PHOTOS,
  type Beat,
  type Evening,
} from "@/domain/date-night/adventures/evenings";
import type { DayDetail } from "@/lib/adventures/propose";
import type { ItemView } from "@/lib/adventures/store";
import { cardPictures } from "@/lib/media/cardPicture";
import { cn } from "@/lib/utils";

/** "5:00" with the pm said once, small, like a trail sign. */
function Clock({ minutes }: { minutes: number }) {
  const said = spokenClock(Math.round(minutes / 5) * 5);
  const [, time, half] = said.match(/^(\d+(?::\d\d)?)(am|pm)$/) ?? [];
  return (
    <span className="tabular-nums">
      {time?.includes(":") ? time : `${time}:00`}
      <span className="ml-0.5 text-[11px] font-bold uppercase opacity-70">
        {half}
      </span>
    </span>
  );
}

const realPhoto = (e: Experience | undefined): boolean =>
  Boolean(e && cardPictures(e)[0] && !cardPictures(e)[0]!.label);

/**
 * The beats of the day Passport (or the owner, in the details) composed: the
 * shared day's own places in order, between leaving and getting home.
 */
function composedBeats(
  day: NightDay,
  dayItems: readonly ItemView[],
  ask: string | null,
  detail: DayDetail | undefined,
  experiences: Readonly<Record<string, Experience>>,
): Beat[] {
  const stops = dayItems.flatMap((i) => (i.atlasRef ? [i.atlasRef] : []));
  const composed = composeDay(
    day,
    readAnswers(ask) ?? DEFAULT_ANSWERS,
    swapsOf(day, stops),
  );
  const options = new Map(day.options.map((o) => [o.atlasRef, o]));
  const beats: Beat[] = [
    {
      at: composed.startAt,
      title: "Off we go",
      line: "Warm layers, a thermos, no particular hurry.",
    },
  ];
  let last = composed.startAt;
  stops.forEach((ref, index) => {
    const option = options.get(ref);
    const at =
      detail?.stops[ref]?.arrive ??
      composed.stops.find((s) => s.option.atlasRef === ref)?.arrive ??
      last + 30;
    last = Math.max(
      at,
      detail?.stops[ref]?.leave ??
        composed.stops.find((s) => s.option.atlasRef === ref)?.leave ??
        at,
    );
    beats.push({
      at,
      title:
        dayItems.find((i) => i.atlasRef === ref)?.label ??
        experiences[ref]?.title ??
        option?.title ??
        "A place Atlas knows",
      line: option?.line ?? detail?.stops[ref]?.because ?? "",
      atlasRef: ref,
      ...(index === 0 ? { main: true as const } : {}),
    });
  });
  beats.push({
    at: last + 20,
    title: day.finale.title,
    line: day.finale.line,
  });
  return beats.sort((a, b) => a.at - b.at);
}

/**
 * **The evening, as a short timeline** — leave, food, the drive, the main
 * thing, something warm, home. Not a planner: the times, legs and changes
 * live in the shared journey, one tap down.
 */
export function EveningPlan({
  evening,
  day,
  sunset,
  dayItems,
  ask,
  detail,
  experiences,
}: {
  readonly evening: Evening | undefined;
  readonly day: NightDay;
  readonly sunset: number;
  readonly dayItems: readonly ItemView[];
  readonly ask: string | null;
  readonly detail: DayDetail | undefined;
  readonly experiences: Readonly<Record<string, Experience>>;
}) {
  const beats =
    evening && evening.id !== "surprise"
      ? evening.beats(sunset)
      : composedBeats(day, dayItems, ask, detail, experiences);
  const title =
    evening?.id === "surprise"
      ? "Passport's surprise"
      : (evening?.title ?? "Our own plan");
  const photo = evening?.photo ?? PHOTOS.campfire;

  return (
    <div data-testid="evening-plan">
      <p className="text-xs font-extrabold tracking-[0.22em] text-[var(--n-ember)] uppercase">
        The plan
      </p>
      <h2 className="ghad-display mt-1 text-[40px] leading-[0.92] font-extrabold tracking-tight uppercase sm:text-5xl">
        {title}
      </h2>
      <p className="mt-3 inline-flex items-center gap-2 text-[15px] text-[var(--n-ink)]/70">
        <Sunset className="h-4 w-4 text-[var(--n-ember)]" aria-hidden />
        Sunset {spokenClock(sunset).replace(/(am|pm)$/, " $1")}. Back whenever.
      </p>

      <ol className="relative mt-7" aria-label="The evening, start to finish">
        <span
          aria-hidden
          className="absolute top-3 bottom-3 left-[73px] w-px bg-[var(--n-forest)]/20"
        />
        {beats.map((beat) => {
          const e = beat.atlasRef ? experiences[beat.atlasRef] : undefined;
          const lat = e?.location?.latitude;
          const lng = e?.location?.longitude;
          const href = beat.directions
            ? directionsTo(beat.directions)
            : lat !== undefined && lng !== undefined
              ? directionsTo(`${lat},${lng}`)
              : beat.atlasRef
                ? directionsTo(`${beat.title}, ${day.area}, BC`)
                : null;
          return (
            <li
              key={`${beat.at}-${beat.title}`}
              data-testid="beat"
              className="relative grid grid-cols-[60px_28px_1fr] gap-x-0 pb-7 last:pb-0"
            >
              <p className="pt-0.5 text-right text-[17px] font-bold text-[var(--n-ink)]">
                <Clock minutes={beat.at} />
              </p>
              <span
                aria-hidden
                className={cn(
                  "relative z-10 mt-1.5 ml-[7px] h-3.5 w-3.5 rounded-full ring-4 ring-[var(--n-cream)]",
                  beat.main ? "bg-[var(--n-ember)]" : "bg-[var(--n-forest)]",
                )}
              />
              <div className="min-w-0">
                <h3
                  className={cn(
                    "leading-tight font-extrabold text-[var(--n-ink)]",
                    beat.main ? "ghad-display text-2xl" : "text-[17px]",
                  )}
                >
                  {beat.title}
                </h3>
                {beat.line && (
                  <p className="mt-1 text-[15px] leading-snug text-[var(--n-ink)]/75">
                    {beat.line}
                  </p>
                )}
                {beat.main && (
                  <div className="relative mt-3 aspect-[16/10] overflow-hidden rounded-2xl">
                    {realPhoto(e) ? (
                      <Picture
                        experience={e}
                        fallbackTitle={beat.title}
                        className="h-full w-full"
                      />
                    ) : (
                      <Image
                        src={photo.src}
                        alt={photo.alt}
                        fill
                        sizes="(min-width: 640px) 560px, 80vw"
                        className="object-cover"
                      />
                    )}
                  </div>
                )}
                {href && (
                  <a
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex min-h-10 items-center gap-1.5 text-sm font-bold text-[var(--n-forest)] underline-offset-4 hover:underline"
                  >
                    <Navigation className="h-4 w-4" aria-hidden /> Directions
                  </a>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {evening?.otherwise && (
        <p className="mt-7 rounded-2xl bg-[var(--n-amber)]/20 p-4 text-[15px] leading-snug text-[var(--n-ink)]">
          {evening.otherwise(sunset)}
        </p>
      )}

      {evening && evening.checks.length > 0 && (
        <details className="group mt-4 rounded-2xl bg-white/70 ring-1 ring-black/5">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between px-4 text-[15px] font-bold">
            Before you go
            <ChevronDown
              className="h-4 w-4 transition group-open:rotate-180"
              aria-hidden
            />
          </summary>
          <ul className="space-y-3 px-4 pb-4">
            {evening.checks.map((c) => (
              <li key={c.label} className="text-[14px] leading-snug">
                <span className="font-bold">{c.label}.</span> {c.line}{" "}
                {c.href && (
                  <a
                    href={c.href}
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold text-[var(--n-forest)] underline"
                  >
                    Check
                  </a>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
