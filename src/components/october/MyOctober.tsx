"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { destinationFor } from "@/domain/experience/destination";
import { formatEventWhen, localDay } from "@/domain/experience/eventTime";
import type { Experience } from "@/domain/experience/types";
import { didThis, forget } from "@/lib/october/october-repo";
import type { OctoberThing } from "@/lib/october/types";
import { filmById } from "@/lib/movies/catalogue";
import { FilmReaction } from "@/components/october/movies/FilmReaction";
import { PlanDay } from "./PlanDay";
import { saveReaction } from "@/lib/movies/movies-repo";
import type { MovieReaction } from "@/lib/movies/types";
import {
  anticipate,
  bySoonestAnticipated,
  type Anticipation,
} from "@/domain/october/anticipation";

/**
 * **An October waiting to be lived, and then the one that was.**
 *
 * Not a saved-items manager and not a dashboard. There are no counts in the
 * headings, no percentage, no checkbox. Two lists: what is Ahead and what has
 * been Lived, and one honest act between them — "Did this" — which is the only
 * way anything moves. Nothing here is ever inferred.
 *
 * A lived Thing is shown as the beginning of a memory: its name, the day, and
 * room for nothing else yet. Reactions and photos are the next layer and are
 * deliberately not here.
 */
interface MyOctoberProps {
  things: OctoberThing[];
  experiences: Experience[];
  /** What they have already said about films. */
  reactions?: MovieReaction[];
  /**
   * **The instant every "how close is it" is measured from.**
   *
   * Supplied by the page, defaulted here, and never read from the clock
   * inside the rows — a list whose order depended on when each row happened
   * to render could not be reasoned about or tested.
   */
  now?: Date;
}

/**
 * **Ahead, in the order a person would ask for it**: soonest first, then what
 * October holds no date for, then what the calendar has gone past.
 *
 * The old order read `startsAt` alone — a snapshot set for Events and nothing
 * else — so Field of Screams, on tonight, sorted below a concert three weeks
 * out because its nights live in `availability.days` rather than a timestamp.
 * `anticipation.ts` answers both shapes with one rule.
 */

/** Lived: by the day it happened — the event's day, else the day they said so. */
const livedOn = (t: OctoberThing): string =>
  t.startsAt ?? t.livedAt ?? t.wantedAt;
const livedOrder = (a: OctoberThing, b: OctoberThing) =>
  livedOn(b).localeCompare(livedOn(a));

function dayOf(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function MyOctober({
  things: initial,
  experiences,
  reactions: initialReactions = [],
  now = new Date(),
}: MyOctoberProps) {
  const [things, setThings] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [reactions, setReactions] = useState(initialReactions);

  const reactionFor = (entityId: string) =>
    reactions.find((r) => r.filmId === entityId);

  async function handleReaction(
    thing: OctoberThing,
    r: { verdict: "loved" | "good" | "meh"; felt: string; gotMe?: string },
  ) {
    try {
      const saved = await saveReaction(thing.entityId, {
        verdict: r.verdict,
        felt: r.felt as never,
        gotMe: r.gotMe,
      });
      setReactions((prev) => [
        ...prev.filter((x) => x.filmId !== saved.filmId),
        saved,
      ]);
    } catch {
      toast.error("Couldn't save that. Please try again.");
    }
  }

  const byId = useMemo(
    () => new Map(experiences.map((e) => [e.id, e] as const)),
    [experiences],
  );

  /** How close each thing is, from its own evidence, measured once. */
  const closeness = useMemo(() => {
    const out = new Map<string, Anticipation>();
    for (const thing of things) {
      out.set(thing.entityId, anticipate(thing, byId.get(thing.entityId), now));
    }
    return out;
  }, [things, byId, now]);

  const ahead = useMemo(
    () =>
      things
        .filter((t) => t.state === "ahead")
        .sort(
          bySoonestAnticipated((t) => ({
            anticipation: closeness.get(t.entityId)!,
            startsAt: t.startsAt,
            name: t.name,
            wantedAt: t.wantedAt,
          })),
        ),
    [things, closeness],
  );
  const lived = useMemo(
    () => things.filter((t) => t.state === "lived").sort(livedOrder),
    [things],
  );

  async function handleDid(thing: OctoberThing) {
    setBusy(thing.entityId);
    try {
      const updated = await didThis(thing.entityId);
      setThings((prev) =>
        prev.map((t) => (t.entityId === updated.entityId ? updated : t)),
      );
    } catch {
      toast.error("Couldn't record that. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  async function handleForget(thing: OctoberThing) {
    setBusy(thing.entityId);
    try {
      await forget(thing.entityId);
      setThings((prev) => prev.filter((t) => t.entityId !== thing.entityId));
    } catch {
      toast.error("Couldn't remove that. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  const empty = things.length === 0;

  return (
    <main>
      <div className="mx-auto max-w-3xl px-6 pt-10 pb-24">
        <header>
          <p className="text-sm font-medium text-[#d09a4e]">October 2026</p>
          <h1 className="font-heading mt-1 text-4xl font-semibold tracking-tight text-[#f3efe4] sm:text-5xl">
            My October
          </h1>
        </header>

        {empty ? (
          <section className="mt-12 max-w-md" data-testid="october-empty">
            <p className="font-heading text-2xl text-[#f3efe4]">
              Nothing yet. That&apos;s the good part.
            </p>
            <p className="mt-3 text-[#e9e6da]/60">
              Everything you decide to do this month will wait here, and
              everything you actually do will stay. Start with something you
              already want.
            </p>
            <Link
              href="/october/discover"
              className="mt-6 inline-flex min-h-11 items-center rounded-full bg-[#e9e6da] px-5 text-sm font-medium text-[#0c0a0c]"
            >
              Find something
            </Link>
          </section>
        ) : (
          <>
            {/* ---------------------------------------------------- AHEAD */}
            <section
              className="mt-12"
              aria-labelledby="ahead"
              data-testid="october-ahead"
            >
              <h2 id="ahead" className="font-heading text-2xl text-[#f3efe4]">
                Ahead
              </h2>
              {ahead.length === 0 ? (
                <p className="mt-3 text-sm text-[#e9e6da]/50">
                  Nothing planned right now.{" "}
                  <Link
                    href="/october/discover"
                    className="underline underline-offset-4"
                  >
                    Find something
                  </Link>
                  .
                </p>
              ) : (
                <ul className="mt-4 flex flex-col gap-3">
                  {ahead.map((thing) => (
                    <ThingRow
                      key={thing.entityId}
                      thing={thing}
                      anticipation={closeness.get(thing.entityId)!}
                      experience={byId.get(thing.entityId)}
                      busy={busy === thing.entityId}
                      onDid={() => handleDid(thing)}
                      onForget={() => handleForget(thing)}
                    />
                  ))}
                </ul>
              )}
            </section>

            {/* ---------------------------------------------------- LIVED */}
            <section
              className="mt-14"
              aria-labelledby="lived"
              data-testid="october-lived"
            >
              <h2 id="lived" className="font-heading text-2xl text-[#f3efe4]">
                Lived
              </h2>
              {lived.length === 0 ? (
                <p className="mt-3 text-sm text-[#e9e6da]/50">
                  Not yet. When you do one of those, say so, and it stays here.
                </p>
              ) : (
                /* **Grouped by what you actually did.** A month is not one
                   list — going somewhere, watching something and making
                   something are different kinds of memory, and reading them
                   back as "Went / Watched / Made" is the difference between a
                   record and a log. Empty groups are never drawn. */
                <div className="mt-4 flex flex-col gap-10">
                  {LIVED_GROUPS.map((group) => {
                    const inGroup = lived.filter(
                      (thing) => groupOf(thing) === group.id,
                    );
                    if (inGroup.length === 0) return null;
                    return (
                      <div
                        key={group.id}
                        data-testid="lived-group"
                        data-group={group.id}
                      >
                        <h3 className="text-[11px] font-medium tracking-[0.2em] text-[#d09a4e] uppercase">
                          {group.label}
                        </h3>
                        <ol className="mt-3 flex flex-col gap-4 border-l border-[#d09a4e]/25 pl-5">
                          {inGroup.map((thing) => (
                            <LivedRow
                              key={thing.entityId}
                              thing={thing}
                              experience={byId.get(thing.entityId)}
                              busy={busy === thing.entityId}
                              onForget={() => handleForget(thing)}
                              reaction={reactionFor(thing.entityId)}
                              onReact={(r) => void handleReaction(thing, r)}
                            />
                          ))}
                        </ol>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}

/**
 * **The verbs a lived October is read back in.**
 *
 * Deliberately three, and deliberately not an ontology. "Ate" is not here
 * because Eat does not exist yet, and drawing an empty heading for it would
 * be the product promising something it cannot do. When Eat ships, a row is
 * added here and nothing else changes.
 */
const LIVED_GROUPS = [
  { id: "went", label: "Went" },
  { id: "watched", label: "Watched" },
  { id: "made", label: "Made" },
] as const;

/**
 * Which verb a thing is remembered under.
 *
 * A film is watched, a Doing is made, and everything Atlas holds — a place,
 * an organisation, an activity, an event, an experience — is somewhere you
 * went. That last grouping is a simplification and an honest one: every Atlas
 * kind in this table is a thing that happens at a place, so "went" is true of
 * all of them without having to decide anything finer.
 */
function groupOf(thing: OctoberThing): (typeof LIVED_GROUPS)[number]["id"] {
  if (thing.entityKind === "Movie") return "watched";
  if (thing.entityKind === "Doing") return "made";
  return "went";
}

/**
 * **Where a row in My October goes when you press it.**
 *
 * An Atlas subject goes to its own page, which `destinationFor` has always
 * answered. A film is not an Atlas subject and had no answer at all, so a
 * saved movie sat here as a dead string — the one row in October you could
 * not open. It goes to its page in the catalogue.
 */
function destinationOf(
  thing: OctoberThing,
  experience?: Experience,
): string | undefined {
  if (thing.entityKind === "Movie") {
    // Only where the catalogue still holds it. A film id that has since been
    // removed gets no link rather than a 404.
    return filmById(thing.entityId)
      ? `/october/movies/${thing.entityId}`
      : undefined;
  }
  return experience ? destinationFor(experience) : undefined;
}

function ThingRow({
  thing,
  anticipation,
  experience,
  busy,
  onDid,
  onForget,
}: {
  thing: OctoberThing;
  anticipation: Anticipation;
  experience?: Experience;
  busy: boolean;
  onDid: () => void;
  onForget: () => void;
}) {
  const destination = destinationOf(thing, experience);
  const when =
    thing.entityKind === "Event" && thing.startsAt
      ? formatEventWhen(
          thing.startsAt,
          experience?.endTime,
          experience?.timePrecision,
        )
      : undefined;
  const where = experience?.context?.name;

  const passed = anticipation.nearness === "passed";

  return (
    <li
      className={`flex items-center gap-4 rounded-xl border p-3 ${
        passed
          ? // Still theirs, still Ahead, and visibly no longer coming.
            "border-[#e9e6da]/[0.07] bg-transparent"
          : "border-[#e9e6da]/10 bg-[#e9e6da]/[0.03]"
      }`}
      data-testid="ahead-thing"
      data-nearness={anticipation.nearness}
    >
      {experience?.heroMedia ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={experience.heroMedia.src}
          alt=""
          className="h-16 w-16 shrink-0 rounded-lg object-cover"
          loading="lazy"
        />
      ) : (
        <div
          className="h-16 w-16 shrink-0 rounded-lg bg-[#e9e6da]/[0.06]"
          aria-hidden
        />
      )}

      <div className="min-w-0 flex-1">
        {/* A film has no date, so the urgency slot is empty and the row read
            as an untitled nothing beside a haunt. It says what it is instead
            — and only while it genuinely has no day, so a movie somebody one
            day plans for a Tuesday still gets the real signal. */}
        {thing.entityKind === "Movie" && anticipation.nearness === "unknown" ? (
          <p
            data-testid="thing-kind"
            className="mb-0.5 text-[11px] font-medium tracking-[0.14em] text-[#e9e6da]/35 uppercase"
          >
            Film
          </p>
        ) : (
          <Nearness anticipation={anticipation} />
        )}
        {destination ? (
          <Link
            href={destination}
            className={`font-medium hover:underline ${
              passed ? "text-[#f3efe4]/55" : "text-[#f3efe4]"
            }`}
          >
            {thing.name}
          </Link>
        ) : (
          <p
            className={`font-medium ${
              passed ? "text-[#f3efe4]/55" : "text-[#f3efe4]"
            }`}
          >
            {thing.name}
          </p>
        )}
        {when && (
          <p className="mt-0.5 text-xs font-medium text-[#d09a4e]">{when}</p>
        )}
        {where && <p className="mt-0.5 text-xs text-[#d09a4e]">at {where}</p>}
        {!when && !where && experience?.subtype && (
          <p className="mt-0.5 text-[11px] tracking-wide text-[#d09a4e] uppercase">
            {experience.subtype}
          </p>
        )}

        {/* **A day, for the things that do not come with one.** An Atlas
            event already has its own date and must never be overwritten by a
            guess; a film and a Doing have none until somebody decides, and
            deciding is what turns "carve pumpkins" into a plan. */}
        {thing.entityKind === "Doing" || thing.entityKind === "Movie" ? (
          <p className="mt-2">
            <PlanDay
              entityId={thing.entityId}
              day={thing.startsAt ? localDay(thing.startsAt) : undefined}
            />
          </p>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={onDid}
          disabled={busy}
          className="min-h-9 rounded-full bg-[#e9e6da] px-3.5 text-xs font-medium text-[#0c0a0c] hover:bg-[#f3efe4] disabled:opacity-50"
          data-testid="did-this"
        >
          Did this
        </button>
        <button
          type="button"
          onClick={onForget}
          disabled={busy}
          aria-label={`Remove ${thing.name} from your October`}
          className="min-h-9 rounded-full px-2.5 text-xs text-[#e9e6da]/45 hover:bg-[#e9e6da]/10 disabled:opacity-50"
          data-testid="forget"
        >
          not this one
        </button>
      </div>
    </li>
  );
}

/**
 * **How close it is, said in three words at most.**
 *
 * The one line that turns a list of saved things into an answer to *what is
 * coming up for me*. It is the first thing in the row and the only ember on
 * it, so the eye lands on "Tonight" before it reads the name — which is the
 * whole point of opening this page in the evening.
 *
 * Nothing is drawn where Atlas holds no day. A film and a subject whose
 * nights live on its modes get a name and no urgency, because inventing one
 * would be the only lie this page could tell.
 */
function Nearness({ anticipation }: { anticipation: Anticipation }) {
  const { nearness, label, lastChance, nights } = anticipation;
  if (nearness === "unknown") return null;

  const imminent =
    nearness === "running" || nearness === "tonight" || nearness === "tomorrow";
  const gone = nearness === "passed";

  return (
    <p className="mb-0.5 flex flex-wrap items-baseline gap-x-2">
      <span
        data-testid="nearness"
        className={`text-[11px] font-medium tracking-[0.14em] uppercase ${
          gone
            ? "text-[#e9e6da]/35"
            : imminent
              ? "text-[#d09a4e]"
              : "text-[#d09a4e]/70"
        }`}
      >
        {label}
      </span>

      {/* Said only on the night it is true, and only where there were other
          nights to have missed. */}
      {lastChance ? (
        <span
          data-testid="last-chance"
          className="text-[10px] tracking-wider text-[#d09a4e]/70 uppercase"
        >
          last night of it
        </span>
      ) : null}

      {/* A run is a run. "8 nights" is the fact; a range would claim the
          nights between, and Field of Screams' 38 are a list with gaps. */}
      {!gone && nights && nights > 1 ? (
        <span data-testid="nights" className="text-[10px] text-[#e9e6da]/35">
          {nights} nights
        </span>
      ) : null}

      {/* The calendar has an opinion; only they have the answer. */}
      {gone ? (
        <span className="text-[10px] text-[#e9e6da]/35">did you go?</span>
      ) : null}
    </p>
  );
}

function LivedRow({
  thing,
  experience,
  busy,
  onForget,
  reaction,
  onReact,
}: {
  thing: OctoberThing;
  experience?: Experience;
  busy: boolean;
  onForget: () => void;
  reaction?: MovieReaction;
  onReact?: (r: {
    verdict: "loved" | "good" | "meh";
    felt: string;
    gotMe?: string;
  }) => void;
}) {
  const destination = destinationOf(thing, experience);
  // A film they watched can say what it was like. Only a film — everything
  // else in My October is a place or an evening, and the reaction layer for
  // those is deliberately not built yet.
  const film =
    thing.entityKind === "Movie" ? filmById(thing.entityId) : undefined;
  return (
    <li className="relative" data-testid="lived-thing">
      <span
        aria-hidden
        className="absolute top-2 -left-[1.55rem] h-2.5 w-2.5 rounded-full bg-[#d09a4e]"
      />
      <p className="text-xs font-medium text-[#d09a4e]">
        {dayOf(livedOn(thing))}
      </p>
      {destination ? (
        <Link
          href={destination}
          className="font-heading text-xl text-[#f3efe4] hover:underline"
        >
          {thing.name}
        </Link>
      ) : (
        <p className="font-heading text-xl text-[#f3efe4]">{thing.name}</p>
      )}
      {experience?.context?.name && (
        <p className="text-sm text-[#e9e6da]/55">{experience.context.name}</p>
      )}
      {film &&
        onReact &&
        (reaction ? (
          <p
            className="mt-1 text-sm text-[#e9e6da]/55"
            data-testid="film-reaction"
          >
            {reaction.verdict === "loved"
              ? "Loved it"
              : reaction.verdict === "good"
                ? "Good"
                : "Meh"}
            {reaction.felt && ` · ${reaction.felt}`}
            {reaction.gotMe && ` · ${reaction.gotMe}`}
          </p>
        ) : (
          <FilmReaction expected={film.fear} onDone={onReact} />
        ))}

      <button
        type="button"
        onClick={onForget}
        disabled={busy}
        className="mt-1 text-[11px] text-[#e9e6da]/35 underline-offset-4 hover:underline disabled:opacity-50"
      >
        that didn&apos;t happen
      </button>
    </li>
  );
}
