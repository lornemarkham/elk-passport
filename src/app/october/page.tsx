import type { Metadata } from "next";
import Link from "next/link";
import { currentUser } from "@/lib/auth/currentUser";
import { discoveryCandidates } from "@/lib/data/atlas-repo";
import { candidateToExperience } from "@/domain/experience/atlasMapper";
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
export default async function OctoberHomePage() {
  // The real instant is what the date line at the top says; the lanes read from
  // a day inside October, so before the month starts this page previews it from
  // the first rather than leading with the last weekend of September
  // (`octoberNow`).
  const realNow = new Date();
  const now = octoberNow(realNow);
  const user = await currentUser();

  const [atlas, things, reactions] = await Promise.all([
    // Atlas being unreachable is an ordinary outcome, not a crash: October
    // still has films, the Video Store and your own things. What it must not
    // become is an empty month — `discoveryCandidates` keeps the difference.
    discoveryCandidates(),
    user ? octoberThingsFor(user) : Promise.resolve([]),
    user ? reactionsFor(user) : Promise.resolve([]),
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
  const tonight = asDiscoveryUnits(
    happeningTonight(experiences, now),
    experiences,
  ).slice(0, 3);
  const weekend = asDiscoveryUnits(
    happeningThisWeekend(experiences, now),
    experiences,
  ).slice(0, 6);
  const soon = asDiscoveryUnits(upcoming(experiences, now), experiences).slice(
    0,
    4,
  );

  const ahead = things.filter((t) => t.state === "ahead").length;
  const lived = things.filter((t) => t.state === "lived").length;

  const today = new Intl.DateTimeFormat("en-CA", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "America/Vancouver",
  }).format(realNow);

  return (
    <main className="mx-auto max-w-5xl px-4 pt-10 pb-24 sm:px-6">
      <header>
        <p className="text-sm text-[#e9e6da]/40">{today}</p>
        <h1 className="font-heading mt-1 text-4xl tracking-tight text-[#f3efe4] sm:text-5xl">
          October
        </h1>
      </header>

      {/* ------------------------------------------------------------ TONIGHT */}
      <div className="mt-12">
        <Section
          title="Tonight"
          note={
            tonight.length > 0 || atlas.outage
              ? undefined
              : "Nothing Passport knows about is on tonight. That is most nights."
          }
        >
          {atlas.outage ? (
            <Unanswered />
          ) : tonight.length > 0 ? (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {tonight.map((unit) => (
                <li key={unit.head.id}>
                  <UnitCard unit={unit} label="Tonight" />
                </li>
              ))}
            </ul>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <Card
                href="/october/movies"
                eyebrow="Indoors"
                title="Movie Night"
                line="Pick something that suits who is actually on the sofa."
              />
              {soon[0] ? (
                <UnitCard unit={soon[0]} label="Not tonight, but soon" />
              ) : null}
            </div>
          )}
        </Section>

        {/* ---------------------------------------------------- THIS WEEKEND */}
        <Section
          title="This weekend"
          note="Real events in the Okanagan, from Atlas."
          action={
            <Link
              href="/october/discover"
              className="text-sm text-[#e9e6da]/45 underline-offset-4 hover:text-[#e9e6da]/75 hover:underline"
            >
              All of it
            </Link>
          }
        >
          {atlas.outage ? (
            <Unanswered />
          ) : weekend.length > 0 ? (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {weekend.map((unit) => (
                <li key={unit.head.id}>
                  <UnitCard unit={unit} label="This weekend" />
                </li>
              ))}
            </ul>
          ) : (
            <Nothing>
              Atlas has nothing dated for this weekend yet. What it does have is
              in{" "}
              <Link
                href="/october/discover"
                className="text-[#d09a4e] underline-offset-4 hover:underline"
              >
                Discover
              </Link>
              .
            </Nothing>
          )}
        </Section>

        {/* ------------------------------------------------------ FROM OCTOBER */}
        <Section
          title="From October"
          note="Things October has made for you. These are not always here."
        >
          {/* The one place anything notices a completed encounter. One line,
              and only for somebody she has actually met. */}
          <Remembered />

          <div className="grid gap-3 sm:grid-cols-2">
            <Card
              href="/labs/october/video-store"
              eyebrow="Tonight only, apparently"
              title="The Video Store"
              line="Somebody has already been through the horror section."
              external
            />
            <Card
              href="/labs/october/witching-hour"
              eyebrow="Late, and better with headphones"
              title="Witching Hour"
              line="Most people are finished with October for tonight. You're not."
              external
            />
          </div>
          {/* The way in to the workshop, and deliberately not a door in the
              gallery. Everything above is a room October actually made and a
              person can walk into knowing nothing about how we work; this is
              for us, so it gets a line of text and no card. If it ever looks
              like one of the things above it, it has become too loud. */}
          <p className="mt-5">
            <Link
              href="/labs/october/sketchbook"
              data-testid="sketchbook-door"
              className="inline-flex min-h-11 items-center text-sm text-[#e9e6da]/30 underline decoration-dotted underline-offset-4 transition-colors hover:text-[#e9e6da]/60"
            >
              There is a door at the back of October.
            </Link>
          </p>
        </Section>

        {/* ------------------------------------------------------------ EXPLORE */}
        <Section
          title="Explore"
          note="Ordinary, useful corners of October. Some of them are still only a door."
        >
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {OCTOBER_AREAS.map((area) => (
              <li key={area.id}>
                <Card
                  href={hrefForArea(area)}
                  title={area.label}
                  line={area.line}
                  status={area.status}
                />
              </li>
            ))}
          </ul>
        </Section>

        {/* ------------------------------------------------------ YOUR OCTOBER */}
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
              Nothing yet. That is the good part — everything you decide on will
              wait here.
            </Nothing>
          ) : (
            <dl
              data-testid="your-october"
              className="flex flex-wrap gap-x-10 gap-y-4"
            >
              <Tally n={ahead} label={ahead === 1 ? "thing ahead" : "ahead"} />
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
