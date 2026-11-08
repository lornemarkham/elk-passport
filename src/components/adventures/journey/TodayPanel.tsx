"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Check, Navigation, PartyPopper, SkipForward } from "lucide-react";
import type { Experience } from "@/domain/experience/types";
import type { ItemView } from "@/lib/adventures/store";
import type { DayDetail } from "@/lib/adventures/propose";
import { clockLabel, minutesLabel } from "@/lib/adventures/present";
import { shifted } from "@/lib/adventures/companion";
import { placeLabel } from "@/domain/discovery/compose";
import { cn } from "@/lib/utils";
import { Picture } from "../Picture";
import { pillClass } from "../kit";
import { Capture } from "./Capture";
import { useDevice } from "./useDevice";
import { markLived } from "@/lib/adventures/lived";

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
 * On the day the page leads with one button: *Start your day*. Once pressed
 * the adventure is a companion that answers one question — _what's now, and
 * what's next?_ — with directions, the timing Passport actually has, a few
 * quiet ways to adjust (running behind, skip, change the plan in words), and
 * three ways to keep the moment. It never ticks, counts or notifies
 * (doctrine §6, Go Offline's rules): the person decides when to look.
 *
 * Everything a person does here — started, done, skipped, behind, memories —
 * is kept on this device only; where memories live beyond the device is
 * decided narrowly by ADR 014 (shared by choice, from the recap).
 */
export function TodayPanel({
  adventureId,
  adventureTitle,
  onDay,
  stops,
  names,
  experiences,
  detail,
  changePlan,
}: {
  readonly adventureId: string;
  readonly adventureTitle: string;
  readonly onDay: string;
  readonly stops: readonly ItemView[];
  readonly names: Readonly<Record<string, string>>;
  readonly experiences: Readonly<Record<string, Experience>>;
  readonly detail: DayDetail | undefined;
  /** Hand a sentence to the change box ("we're skipping lunch"). */
  readonly changePlan?: (said: string) => void;
}) {
  const device = useDevice(adventureId, onDay);
  const { done, skipped, started, behind } = device;
  const nameOf = (item: ItemView) =>
    item.label ??
    (item.atlasRef
      ? (experiences[item.atlasRef]?.title ?? names[item.atlasRef])
      : undefined) ??
    "A stop";

  const open = stops.filter(
    (s) => !done.includes(s.id) && !skipped.includes(s.id),
  );
  const now = open[0];
  const after = open[1];
  const finished = device.ready && !now;
  // **Finished here is a memory now** — My Stuff lists it under Memories
  // without waiting for the date to pass. Reopening the day takes it back.
  useEffect(() => {
    if (!device.ready || !started) return;
    markLived(adventureId, onDay, finished);
  }, [device.ready, started, finished, adventureId, onDay]);
  const favourite = (id: string) =>
    device.memories.some((m) => m.kind === "favourite" && m.itemId === id);

  return (
    <section
      aria-labelledby="today-heading"
      data-testid="today-panel"
      data-started={started ? "yes" : "no"}
      className="overflow-hidden rounded-[28px] bg-[var(--gh-sun)] text-[var(--gh-ink)]"
    >
      <div className="p-5 sm:p-8">
        <p className="text-xs font-bold tracking-[0.14em] uppercase">
          {started ? "Your day is on" : "Today's adventure"}
        </p>
        <h2
          id="today-heading"
          className="ghad-display mt-1 text-3xl leading-tight font-extrabold tracking-[-0.03em] sm:text-5xl"
        >
          {!started
            ? "Today's the day."
            : finished
              ? "That's the day."
              : "What's next"}
        </h2>

        {!started && (
          <div className="mt-4 space-y-4">
            <p className="max-w-xl text-lg">
              {stops.length} {stops.length === 1 ? "stop" : "stops"} lined up
              {detail?.title ? ` — ${detail.title}` : ""}. Press start and
              Passport will tell you what&apos;s now and what&apos;s next, then
              get out of your way.
            </p>
            <button
              type="button"
              data-testid="start-day"
              disabled={!device.ready}
              onClick={device.start}
              className={pillClass(
                "primary",
                "min-h-16 w-full px-8 text-xl tracking-wide uppercase sm:w-auto",
              )}
            >
              Start your day
            </button>
            {stops[0] && (
              <NextStop
                label="First up"
                item={stops[0]}
                name={nameOf(stops[0])}
                experience={
                  stops[0].atlasRef ? experiences[stops[0].atlasRef] : undefined
                }
                stop={
                  stops[0].atlasRef
                    ? detail?.stops[stops[0].atlasRef]
                    : undefined
                }
                behind={0}
              />
            )}
          </div>
        )}

        {started && now && (
          <div className="mt-4 space-y-4">
            <NextStop
              label={`Now · stop ${stops.indexOf(now) + 1} of ${stops.length}`}
              item={now}
              name={nameOf(now)}
              experience={now.atlasRef ? experiences[now.atlasRef] : undefined}
              stop={now.atlasRef ? detail?.stops[now.atlasRef] : undefined}
              behind={behind}
              actions={
                <>
                  <button
                    type="button"
                    data-testid="today-done"
                    onClick={() => device.markDone(now.id, true)}
                    className={pillClass("forest")}
                  >
                    <Check className="h-4 w-4" aria-hidden />
                    Done — what&apos;s next
                  </button>
                  <button
                    type="button"
                    data-testid="today-skip"
                    onClick={() => device.markSkipped(now.id, true)}
                    className={pillClass("quiet")}
                  >
                    <SkipForward className="h-4 w-4" aria-hidden />
                    Skip this
                  </button>
                </>
              }
            />
            {after && (
              <p
                data-testid="today-after"
                className="rounded-2xl bg-white/60 px-4 py-3 text-base"
              >
                <span className="font-bold">Then </span>
                {nameOf(after)}
                {detail?.stops[after.atlasRef ?? ""]?.arrive !== undefined && (
                  <>
                    {" · about "}
                    {clockLabel(
                      shifted(detail!.stops[after.atlasRef!]!.arrive, behind)!,
                    )}
                  </>
                )}
              </p>
            )}

            <div
              className="rounded-2xl bg-white/60 p-4"
              data-testid="today-adjust"
            >
              <p className="text-sm font-bold tracking-[0.1em] uppercase">
                Plans change
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  data-testid="behind-more"
                  onClick={() => device.runBehind(15)}
                  className={pillClass("quiet")}
                >
                  Running 15 min behind
                </button>
                {behind > 0 && (
                  <button
                    type="button"
                    data-testid="behind-reset"
                    onClick={() => device.runBehind(-behind)}
                    className={pillClass("quiet")}
                  >
                    Back on time
                  </button>
                )}
                {changePlan && (
                  <button
                    type="button"
                    data-testid="today-change"
                    onClick={() => changePlan("Find somewhere closer")}
                    className={pillClass("quiet")}
                  >
                    Change the plan…
                  </button>
                )}
              </div>
              {behind > 0 && (
                <p className="mt-2 text-sm" data-testid="behind-note">
                  Times below are pushed back {minutesLabel(behind)}. This is on
                  your phone only — the plan itself hasn&apos;t changed, and
                  Passport hasn&apos;t checked whether anything closes sooner.
                </p>
              )}
            </div>

            <div className="rounded-2xl bg-white/60 p-4">
              <p className="mb-2 text-sm font-bold tracking-[0.1em] uppercase">
                Keep this moment
              </p>
              <Capture
                itemId={now.id}
                isFavourite={favourite(now.id)}
                remember={device.remember}
                saved={device.saved}
              />
            </div>
          </div>
        )}

        {started && finished && (
          <div className="mt-4 space-y-4">
            <p className="flex items-center gap-2 text-lg font-semibold">
              <PartyPopper className="h-6 w-6" aria-hidden />
              Hell of a day? See how it went — and keep it.
            </p>
            <div className="rounded-2xl bg-white/60 p-4">
              <p className="mb-2 text-sm font-bold tracking-[0.1em] uppercase">
                One last thing to keep
              </p>
              <Capture
                itemId={null}
                isFavourite={false}
                remember={device.remember}
                saved={device.saved}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/adventures/${encodeURIComponent(adventureId)}/recap`}
                data-testid="open-recap"
                className={pillClass("primary")}
              >
                See your recap
              </Link>
              <button
                type="button"
                onClick={() => {
                  stops.forEach((s) => {
                    device.markDone(s.id, false);
                    device.markSkipped(s.id, false);
                  });
                }}
                className={pillClass("quiet")}
              >
                Not finished — reopen the day
              </button>
            </div>
          </div>
        )}

        <ol className="mt-6 space-y-1.5" aria-label="Today's stops">
          {stops.map((stop, i) => {
            const isDone = done.includes(stop.id);
            const isSkipped = skipped.includes(stop.id) && !isDone;
            return (
              <li key={stop.id}>
                <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-2xl bg-white/50 px-3 text-base font-semibold">
                  <input
                    type="checkbox"
                    checked={isDone}
                    onChange={(e) => {
                      device.markDone(stop.id, e.target.checked);
                      if (e.target.checked) device.markSkipped(stop.id, false);
                    }}
                    className="h-5 w-5 accent-[var(--gh-forest)]"
                  />
                  <span
                    className={cn(
                      (isDone || isSkipped) && "line-through opacity-60",
                    )}
                  >
                    {i + 1}. {nameOf(stop)}
                  </span>
                  {isSkipped && (
                    <span className="ml-auto text-xs font-bold uppercase">
                      Skipped
                    </span>
                  )}
                </label>
              </li>
            );
          })}
        </ol>
        <p className="mt-6 text-sm font-bold tracking-[0.1em] uppercase">
          Put the phone away. Go have a day.
        </p>
        {started && (
          <button
            type="button"
            data-testid="end-day"
            onClick={device.stop}
            className="mt-2 min-h-11 text-sm font-semibold underline"
          >
            Not starting after all
          </button>
        )}
        <span className="sr-only">{adventureTitle}</span>
      </div>
    </section>
  );
}

function NextStop({
  label,
  item,
  name,
  experience,
  stop,
  behind,
  actions,
}: {
  readonly label: string;
  readonly item: ItemView;
  readonly name: string;
  readonly experience: Experience | undefined;
  readonly stop: DayDetail["stops"][string] | undefined;
  readonly behind: number;
  readonly actions?: React.ReactNode;
}) {
  const where = experience ? placeLabel(experience) : undefined;
  const arrive = shifted(stop?.arrive, behind);
  return (
    <div
      data-testid="today-next"
      className="flex flex-col gap-4 rounded-3xl bg-white p-4 sm:flex-row sm:p-5"
    >
      <Picture
        experience={experience}
        fallbackTitle={name}
        className="aspect-[16/10] w-full shrink-0 rounded-2xl sm:w-64"
      />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold tracking-[0.12em] text-[var(--gh-ink-soft)] uppercase">
          {label}
        </p>
        <p className="ghad-display text-2xl font-extrabold">{name}</p>
        {where && (
          <p className="text-base text-[var(--gh-ink-soft)]">{where}</p>
        )}
        <ul className="mt-2 space-y-1 text-base">
          {arrive !== undefined && <li>About {clockLabel(arrive)}</li>}
          {stop && (
            <li>The plan gives it about {minutesLabel(stop.minutes)}</li>
          )}
          {stop?.open && <li className="font-semibold">{stop.open}</li>}
          {stop?.hours && <li>Published hours: {stop.hours}</li>}
          {stop?.cost && <li>Published price: {stop.cost}</li>}
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
          {actions}
        </div>
      </div>
    </div>
  );
}
