import type { Metadata } from "next";
import Link from "next/link";
import { currentUser } from "@/lib/auth/currentUser";
import { discoveryCandidates } from "@/lib/data/atlas-repo";
import { candidateToExperience } from "@/domain/experience/atlasMapper";
import type { Experience } from "@/domain/experience/types";
import {
  happeningThisWeekend,
  happeningTonight,
  upcoming,
} from "@/domain/october/calendar";
import { OCTOBER_AREAS, hrefForArea } from "@/domain/october/areas";
import { octoberNow } from "@/domain/october/octoberWindow";
import { octoberThingsFor } from "@/lib/october/octoberThings";
import { reactionsFor } from "@/lib/movies/reactions";
import {
  Card,
  Nothing,
  Section,
  Unanswered,
} from "@/components/october/shell/atoms";
import { UnitCard } from "@/components/october/shell/UnitCard";
import { asDiscoveryUnits } from "@/domain/discovery/discoveryUnits";
import { Remembered } from "@/components/october/shell/Remembered";
import { keepFor } from "@/components/october/save/keepFor";
import { OctoberPicks } from "@/components/october/movies/OctoberPicks";
import { OCTOBER_PLACES, placeFrom } from "@/domain/environment/places";
import { profileFor } from "@/lib/profile/profileService";
import { daysOn } from "@/domain/october/calendar";
import { anticipate } from "@/domain/october/anticipation";
import { closingFor, dontMiss } from "@/domain/october/dontMiss";
import { hypeFor, savedContextFor, strongestHype } from "@/domain/october/hype";
import { destinationFor } from "@/domain/experience/destination";
import { lightPhaseAt } from "@/domain/environment/daylight";
import { temporalContext } from "@/domain/october/temporal";
import {
  byNearest,
  localnessOf,
  type PlacePoints,
} from "@/domain/october/localness";
import { SkyWash } from "@/components/october/environment/SkyWash";
import { CardWeather } from "@/components/october/environment/CardWeather";
import { quickFor } from "@/components/october/quick/quickFor";
import { RightNow } from "@/components/october/environment/RightNow";
import { classifySubject } from "@/domain/october/subjectKind";
import { conditionsFor } from "@/domain/october/conditions";
import { environmentsForPoints, nearestPlace } from "@/lib/environment/atEvent";
import { placeById } from "@/domain/environment/places";
import { scenarioFrom, simulatedEnvironment } from "@/lib/environment/scenario";
import { localDay } from "@/domain/experience/eventTime";

export const metadata: Metadata = {
  title: "October — Passport",
};

/**
 * **October Home: the room you come back to.**
 *
 * Not a landing page and not a feed. Five questions in the order a person
 * actually asks them — what could I do tonight, what is on this weekend, what
 * has October got for me, what can I look through, and what have I already
 * gathered — and each one answered with the most real thing available rather
 * than the most impressive.
 *
 * ## The seam Tonight is built on
 *
 * Tonight currently knows two things: the clock, and what Atlas holds. It asks
 * `happeningTonight` for events on today's local date and shows them. That is
 * *selection*, not recommendation, and the distinction is deliberate — a
 * surface that ranked these would be claiming to know something about the
 * person that Passport has not earned.
 *
 * What makes it a seam rather than a dead end is that the shape is already
 * right: one function turns "everything Passport can see" plus "now" into
 * "what is on". Weather, location, who you are with, what you saved, what you
 * did last week — every one of those is another argument to that call and a
 * richer sort inside it. None of them requires this page to change, which is
 * the whole reason to build the surface before the engine.
 *
 * ## What is real here
 *
 * Tonight and This Weekend read live Atlas events. Your October reads the
 * person's own rows. Nothing on this page invents an entity, a date or a piece
 * of personal history: where there is nothing, it says there is nothing.
 */
export default async function OctoberHomePage({
  searchParams,
}: {
  searchParams: Promise<{ sim?: string }>;
}) {
  // Development only; inert in any deployed build. See `lib/environment/scenario`.
  const scenario = scenarioFrom((await searchParams).sim);
  // The real instant is what the date line at the top says; the lanes read from
  // a day inside October, so before the month starts this page previews it from
  // the first rather than leading with the last weekend of September
  // (`octoberNow`).
  const realNow = scenario ? scenario.now : new Date();
  const now = octoberNow(realNow);
  const user = await currentUser();

  const [atlas, things, reactions, profile] = await Promise.all([
    // Atlas being unreachable is an ordinary outcome, not a crash: October
    // still has films, the Video Store and your own things. What it must not
    // become is an empty month — `discoveryCandidates` keeps the difference.
    discoveryCandidates(),
    user ? octoberThingsFor(user) : Promise.resolve([]),
    user ? reactionsFor(user) : Promise.resolve([]),
    user ? profileFor(user).catch(() => null) : Promise.resolve(null),
  ]);
  const experiences = atlas.candidates.map(candidateToExperience);

  // **The same candidate has to mean the same thing here as it does on
  // Discover.** The windows below were already shared — Tonight, This weekend
  // and Coming up all come from `october/calendar`, occasions, stated days and
  // all. What Home was missing was the last step: grouping each window's
  // matches by the `includes` edges Atlas asserts, so an attraction and its
  // modes arrive as one discovery with options rather than as three cards
  // competing with one another. Home may show fewer of them. It may not count
  // them differently.
  //
  // Grouped before slicing, or the cap would be spent on parts of the same
  // thing and Tonight would show one haunt three times instead of three things.
  const allTonight = asDiscoveryUnits(
    happeningTonight(experiences, now),
    experiences,
  );
  const allWeekend = asDiscoveryUnits(
    happeningThisWeekend(experiences, now),
    experiences,
  );
  const allSoon = asDiscoveryUnits(upcoming(experiences, now), experiences);

  // The page already knows what this person kept — the same rows the tallies
  // below are counted from. Every card reads that one answer rather than
  // asking for itself.
  const page = {
    signedIn: Boolean(user),
    kept: new Set(things.map((t) => t.entityId)),
  };
  const keep = (unit: { head: Experience }) =>
    keepFor(unit.head, page, "/october");

  // ----------------------------------------------------- what is outside
  //
  // The area is the person's own, from the profile field that has existed
  // since the profile did. Weather is fetched only for that one place, once,
  // and only when a provider is configured — darkness needs neither.
  // The scenario's area wins on a developer's machine, so every screen can be
  // looked at from Kelowna without anybody's saved profile being touched.
  const place = scenario
    ? placeById(scenario.areaId)
    : placeFrom(profile?.homeArea);

  // October reports the sky because of something *they saved*, never as a
  // weather report. A meteor shower asks about cloud; a haunt asks about rain.
  const today = localDay(realNow);

  // Where things are. Atlas gives a dated subject a `happens_at` Place, and
  // that Place's coordinates arrive in this same feed — so localising costs
  // nothing beyond building one map.
  const points: PlacePoints = new Map(
    atlas.candidates
      .filter((c) => c.coordinates)
      .map((c) => [
        c.id,
        { latitude: c.coordinates![1], longitude: c.coordinates![0] },
      ]),
  );
  const near = (e: Experience) => localnessOf(e, place, points);
  const byIdExp = new Map(experiences.map((e) => [e.id, e] as const));

  // **A forecast for where each thing is, not for where you live.** Every
  // dated subject's venue point is collected, deduped to areas, and fetched in
  // one batch — two or three areas for a whole page.
  const venuePoints = experiences
    .map((e) => (e.venue?.placeId ? points.get(e.venue.placeId) : undefined))
    .filter((pt): pt is { latitude: number; longitude: number } => Boolean(pt));
  const environments = scenario
    ? new Map(
        OCTOBER_PLACES.map((p) => [p.id, simulatedEnvironment(scenario, p)]),
      )
    : await environmentsForPoints(venuePoints, place);
  const outside = place ? environments.get(place.id) : undefined;

  /** The forecast that is actually about this subject's own place. */
  const environmentAt = (e: Experience) => {
    const pt = e.venue?.placeId ? points.get(e.venue.placeId) : undefined;
    const at = pt ? nearestPlace(pt) : undefined;
    // Falls back to the home area only when the subject has no place of its
    // own — never when it has one somewhere we cannot forecast.
    return at ? environments.get(at.id) : pt ? undefined : outside;
  };

  /** What the conditions mean for this thing, if they mean anything. */
  const readFor = (e: Experience) => {
    const day = daysOn(e).find((d) => d >= today);
    if (!day) return undefined;
    const venueSubtype = e.venue?.placeId
      ? atlas.candidates.find((c) => c.id === e.venue!.placeId)?.subtype
      : undefined;
    const { kind } = classifySubject(e, venueSubtype);
    return conditionsFor(kind, day, environmentAt(e), realNow);
  };

  // Nearest first, and only then capped — so changing Vernon to Kelowna
  // changes *which* things survive the cap, not merely their order.
  const nearestFirst = byNearest<{ head: Experience }>((u) => near(u.head));
  const tonight = [...allTonight].sort(nearestFirst).slice(0, 3);
  const weekend = [...allWeekend].sort(nearestFirst).slice(0, 6);
  const soon = [...allSoon].sort(nearestFirst).slice(0, 4);

  /** The conditions line a card gets, when they mean something for it. */
  const weatherNote = (unit: { head: Experience }) => {
    const read = readFor(unit.head);
    const quick = quickFor(unit.head);
    if (!read && !quick) return undefined;
    return (
      <>
        {quick}
        {read ? <CardWeather read={read} /> : null}
      </>
    );
  };

  // ------------------------------------------------------------- the boost
  //
  // **A boost, never a filter.** Nothing is removed and no lane is hidden;
  // conditions move one thing up and the page says why. Atlas is untouched.
  //
  // Clear night → something that needs a sky rises. Wet or freezing night →
  // an indoor October option rises. That is the whole rule.
  const boosted = (() => {
    const scored = allSoon
      .map((unit) => ({ unit, read: readFor(unit.head) }))
      .filter((x) => x.read?.weight === "good");
    return scored[0];
  })();

  const tonightRead = (() => {
    const home = outside;
    if (!home) return undefined;
    return conditionsFor("indoor", today, home, realNow, { surface: "page" });
  })();

  // ------------------------------------------------- what Home composes
  //
  // Three candidates, each allowed to be absent. Home shows what it has and
  // says so plainly when it has nothing, rather than filling the space with
  // the browse grids that made it indistinguishable from Discover.

  /** The nearest thing this person already chose, with its conditions. */
  const nextOfMine = (() => {
    const ahead = things.filter((thing) => thing.state === "ahead");
    if (ahead.length === 0) return undefined;
    const scored = ahead
      .map((thing) => {
        const experience = byIdExp.get(thing.entityId);
        const day = experience
          ? daysOn(experience).find((d) => d >= today)
          : undefined;
        return { thing, experience, day };
      })
      // Dated things first, soonest first; undated keep their saved order.
      .sort((a, b) => (a.day ?? "9999").localeCompare(b.day ?? "9999"));
    const best = scored[0]!;
    const anticipation = anticipate(best.thing, best.experience, realNow);
    const read = best.experience
      ? (() => {
          const venueSubtype = best.experience!.venue?.placeId
            ? atlas.candidates.find(
                (c) => c.id === best.experience!.venue!.placeId,
              )?.subtype
            : undefined;
          const kind = classifySubject(best.experience!, venueSubtype).kind;
          return best.day
            ? conditionsFor(
                kind,
                best.day,
                environmentAt(best.experience!),
                realNow,
              )
            : undefined;
        })()
      : undefined;
    return {
      name: best.thing.name,
      href: best.experience ? destinationFor(best.experience) : undefined,
      anticipation,
      read,
    };
  })();

  /** The one thing closing, and the one October would mention unprompted. */
  const closing = dontMiss(
    experiences,
    (e) => {
      const venueSubtype = e.venue?.placeId
        ? atlas.candidates.find((c) => c.id === e.venue!.placeId)?.subtype
        : undefined;
      const atNight = classifySubject(e, venueSubtype).kind === "outdoor-night";
      return closingFor(e, today, atNight, realNow);
    },
    1,
  );

  const hyped = strongestHype(
    experiences
      .map((e) => {
        const venueSubtype = e.venue?.placeId
          ? atlas.candidates.find((c) => c.id === e.venue!.placeId)?.subtype
          : undefined;
        return hypeFor(e, {
          today,
          now: realNow,
          kind: classifySubject(e, venueSubtype).kind,
          environment: environmentAt(e),
          saved: savedContextFor(Boolean(scenario), page.kept),
        });
      })
      .filter((h): h is NonNullable<typeof h> => Boolean(h)),
  );

  // Counts for the door into Discover. A number is a better promise than an
  // adjective, and it costs nothing — these lanes were already computed.
  const tonightCount = allTonight.length;
  const weekendCount = allWeekend.length;

  const when = temporalContext(realNow);
  const lightPhase = place
    ? lightPhaseAt(place.latitude, place.longitude, realNow)
    : undefined;

  const ahead = things.filter((t) => t.state === "ahead").length;
  const lived = things.filter((t) => t.state === "lived").length;

  const todayLabel = new Intl.DateTimeFormat("en-CA", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "America/Vancouver",
  }).format(realNow);

  return (
    <SkyWash phase={lightPhase}>
      <main className="mx-auto max-w-5xl px-4 pt-10 pb-24 sm:px-6">
        <header>
          <p className="text-sm text-[#e9e6da]/40">{todayLabel}</p>
          <h1 className="font-heading mt-1 text-4xl tracking-tight text-[#f3efe4] sm:text-5xl">
            October
          </h1>
          {/* What October noticed about the world this morning. One line. */}
          {/* Where October is standing, and what it can see from there. */}
          <div className="mt-4">
            <RightNow
              area={place}
              environment={outside}
              now={realNow}
              when={when}
              phase={lightPhase}
              simulated={scenario?.label}
            />
          </div>
        </header>

        {/* ===================================================================
            **October composes the moment. It does not browse.**

            Everything between here and "Your October" used to be Tonight and
            This weekend — the same two grids Discover opens with, which is
            why nobody could say what either page was for. Home now chooses:
            the nearest thing you saved, the one thing October is excited
            about, the one thing closing, and two doors. If it cannot decide
            anything it says so in one line rather than filling the space.
            =================================================================== */}

        {/* What you already chose, and how close it is. The only block that
            is about you, so it leads. */}
        {nextOfMine ? (
          <div className="mt-10" data-testid="home-yours">
            <p className="text-[11px] font-medium tracking-[0.2em] text-[#d09a4e] uppercase">
              {nextOfMine.anticipation.label === ""
                ? "In your October"
                : nextOfMine.anticipation.label}
            </p>
            <Link
              href={nextOfMine.href ?? "/october/mine"}
              className="font-heading mt-1 block text-3xl leading-tight tracking-tight text-[#f3efe4] hover:underline sm:text-4xl"
            >
              {nextOfMine.name}
            </Link>
            {nextOfMine.read ? (
              <p className="mt-2 text-base text-[#e9e6da]/70">
                {nextOfMine.read.line}
                {nextOfMine.read.facts ? (
                  <span className="block text-sm text-[#e9e6da]/40">
                    {nextOfMine.read.facts}
                  </span>
                ) : null}
              </p>
            ) : null}
          </div>
        ) : null}

        {/* The one thing closing. Usually absent. */}
        {closing.length > 0 ? (
          <div className="mt-10" data-testid="home-closing">
            <p className="text-[11px] font-medium tracking-[0.2em] text-[#d09a4e] uppercase">
              Don&apos;t miss
            </p>
            <Link
              href={destinationFor(closing[0]!.item) ?? "/october/discover"}
              className="font-heading mt-1 block text-2xl leading-tight text-[#f3efe4] hover:underline"
            >
              {closing[0]!.item.title}
            </Link>
            <p className="mt-0.5 text-base font-medium text-[#d09a4e]">
              {closing[0]!.closing.reason}
            </p>
          </div>
        ) : null}

        {/* The one thing October would mention unprompted. */}
        {hyped ? (
          <div className="mt-10" data-testid="home-hype">
            <p className="text-[11px] font-medium tracking-[0.2em] text-[#9fb4d8] uppercase">
              October is watching this one
            </p>
            <Link
              href={destinationFor(hyped.subject) ?? "/october/discover"}
              className="font-heading mt-1 block text-2xl leading-tight text-[#f3efe4] hover:underline"
            >
              {hyped.subject.title}
            </Link>
            <p className="mt-0.5 text-base text-[#e9e6da]/70">
              {hyped.now} {hyped.because}
            </p>
          </div>
        ) : null}

        {/* **An unanswered question is not a quiet night.** With Atlas
            unreachable every block above goes empty, and saying "a quiet one
            so far" would be the page inventing calm out of a failure. */}
        {atlas.outage ? (
          <div className="mt-10">
            <Unanswered />
          </div>
        ) : !nextOfMine && closing.length === 0 && !hyped ? (
          <p
            className="mt-10 text-base text-[#e9e6da]/55"
            data-testid="home-quiet"
          >
            A quiet one so far. Nothing of yours is close and nothing is about
            to vanish.
          </p>
        ) : null}

        {/* Two doors. One into the month, one into a world. */}
        <div
          className="mt-12 grid gap-3 sm:grid-cols-2"
          data-testid="home-doors"
        >
          <Card
            href="/october/discover"
            eyebrow="Find something"
            title="What's on"
            line={`${tonightCount} tonight, ${weekendCount} this weekend near you.`}
          />
          <Card
            href="/october/movies"
            eyebrow="Feel like staying in?"
            title="Movies"
            line="Forty-four films, each one watched and written about by somebody."
          />
        </div>

        {/* ------------------------------------------------------ YOUR OCTOBER */}
        <div className="mt-12">
          <Section
            title="Your October"
            action={
              <Link
                href="/october/mine"
                className="text-sm text-[#e9e6da]/45 underline-offset-4 hover:text-[#e9e6da]/75 hover:underline"
              >
                Open
              </Link>
            }
          >
            {!user ? (
              <Nothing>
                Nothing is kept until you sign in — and then everything is, on
                whatever you are holding.{" "}
                <Link
                  href="/auth?next=/october"
                  className="text-[#d09a4e] not-italic underline-offset-4 hover:underline"
                >
                  Sign in
                </Link>
              </Nothing>
            ) : ahead + lived + reactions.length === 0 ? (
              <Nothing>
                Nothing yet. That is the good part — everything you decide on
                will wait here.
              </Nothing>
            ) : (
              <dl
                data-testid="your-october"
                className="flex flex-wrap gap-x-10 gap-y-4"
              >
                <Tally
                  n={ahead}
                  label={ahead === 1 ? "thing ahead" : "ahead"}
                />
                <Tally n={lived} label="lived" />
                <Tally
                  n={reactions.length}
                  label={reactions.length === 1 ? "film" : "films"}
                />
              </dl>
            )}
          </Section>
        </div>
      </main>
    </SkyWash>
  );
}
/** A count the person actually produced. Never a score, never a percentage. */
function Tally({ n, label }: { readonly n: number; readonly label: string }) {
  return (
    <div>
      <dt className="sr-only">{label}</dt>
      <dd className="font-heading text-3xl text-[#f3efe4] tabular-nums">
        {n}
        <span className="ml-2 align-middle text-sm text-[#e9e6da]/45">
          {label}
        </span>
      </dd>
    </div>
  );
}
