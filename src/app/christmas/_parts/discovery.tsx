import { cache } from "react";
import Link from "next/link";
import { ArrowRight, Map as MapIcon, Route, Star } from "lucide-react";
import { FindCard } from "@/components/christmas/FindCard";
import { Finder, Row } from "@/components/christmas/Finder";
import { TODAY_H2 } from "@/components/christmas/FeaturedToday";
import { EveningCard, PinNearCard } from "@/components/christmas/NearbyCards";
import { LocalFavouriteStops } from "@/components/featured/LocalFavouriteCard";
import { townById } from "@/domain/discovery/towns";
import { favouritesNear } from "@/domain/featured/locals";
import { youngest, type Ask, type Find } from "@/domain/christmas/discover";
import { comingUp, finderData, shownIn } from "@/domain/christmas/finder";
import { lightsNear, openThisEvening } from "@/domain/christmas/nearby";
import { inNorthOkanagan, matchesFeatured } from "@/domain/christmas/featured";
import { areaById } from "@/domain/christmas/lights/areas";
import { driveLength, suggestedDrives } from "@/domain/christmas/lights/drives";
import { distanceKm } from "@/lib/environment/geo";
import { addDays, shortDay, whenLabel } from "@/domain/christmas/when";
import { christmasFinds } from "../_server/corpus";
import { lightsFor, viewer } from "../_server/lights";

/**
 * **The parts of the Christmas page that wait on Atlas** (owner brief
 * M1154, "One unified discovery experience"). The page streams four of
 * them — Atlas's own events today, Coming up, Explore and the community
 * lights — each behind its own boundary, so the featured events and the
 * moods above never wait. They share one answer per request (`answerFor`,
 * React's `cache`): where, when and how far are answered once (ADR 026),
 * and the featured events are kept out of the feed so nobody sees a card
 * twice. What Coming up shows is kept out of Explore's unfiltered list for
 * the same reason.
 */

const answerFor = cache(async (key: string, today: string) => {
  const ask = JSON.parse(key) as Ask;
  const corpus = await christmasFinds(ask, today);
  // The featured events are said once, above; the feed keeps its own copy of
  // them out so nobody sees a card twice.
  const finds = inNorthOkanagan(ask.at)
    ? corpus.finds.filter((f) => !matchesFeatured(f.experience.title))
    : corpus.finds;
  const data = finderData(finds, ask, { today, now: new Date() });
  const dated = Boolean(ask.from || ask.to);
  // A visitor who chose days gets those days in Explore, not a second list.
  const coming = dated ? undefined : comingUp(data, today);
  return { corpus, data, coming };
});

const lightsNow = cache(() =>
  viewer()
    .then((v) => lightsFor(v))
    .catch(() => ({ pins: [], ready: false })),
);

const answer = (ask: Ask, today: string) =>
  answerFor(JSON.stringify(ask), today);

function place(ask: Ask) {
  const town = townById(ask.at)!;
  return {
    townName: town.name.replace(/,\s*BC$/, ""),
    origin: { latitude: town.latitude, longitude: town.longitude },
  };
}

function Cards({
  finds,
  ask,
  testId,
}: {
  readonly finds: readonly Find[];
  readonly ask: Ask;
  readonly testId: string;
}) {
  const { origin } = place(ask);
  const age = youngest(ask);
  return (
    <Row cols="lg:grid-cols-4" testId={testId}>
      {finds.map((f) => (
        <FindCard
          key={f.experience.id}
          find={f}
          origin={origin}
          {...(age !== undefined ? { youngest: age } : {})}
        />
      ))}
    </Row>
  );
}

/**
 * **Also on today, from local listings** — Atlas's own events confirmed for
 * today, under the featured ones in Happening today. Nothing on a dated
 * look, where Explore answers the days asked.
 */
export async function AlsoToday({
  ask,
  today,
  featured,
}: {
  readonly ask: Ask;
  readonly today: string;
  /** Whether a featured event is already on today above this row. */
  readonly featured: boolean;
}) {
  const { coming } = await answer(ask, today);
  if (!coming || coming.today.length === 0) return null;
  return (
    <div data-testid="also-today">
      {featured ? (
        <h3 className="mb-3 text-sm font-bold tracking-[0.14em] text-[#b3242f] uppercase">
          Also on today
        </h3>
      ) : (
        <h2 className={`${TODAY_H2} mb-4`}>Happening today</h2>
      )}
      <Cards finds={coming.today} ask={ask} testId="also-today-cards" />
    </div>
  );
}

/**
 * **Coming up** (owner brief M1154, the fourth band): tomorrow, this
 * weekend, then the next fortnight — confirmed events in a host's order,
 * each said once (`comingUp`).
 */
export async function ComingUp({
  ask,
  today,
}: {
  readonly ask: Ask;
  readonly today: string;
}) {
  const { coming } = await answer(ask, today);
  if (!coming) return null;
  const rows = [
    {
      id: "tomorrow",
      label: `Tomorrow · ${shortDay(addDays(today, 1))}`,
      finds: coming.tomorrow,
    },
    { id: "weekend", label: "This weekend", finds: coming.weekend },
    { id: "soon", label: "In the next two weeks", finds: coming.soon },
  ].filter((r) => r.finds.length > 0);
  if (rows.length === 0) return null;
  return (
    <section
      aria-labelledby="coming-title"
      data-testid="coming-up"
      className="space-y-5"
    >
      <h2
        id="coming-title"
        className="ghad-display text-[1.75rem] leading-tight font-extrabold tracking-[-0.02em] sm:text-4xl"
      >
        Coming up
      </h2>
      {rows.map((r) => (
        <div key={r.id} data-testid={`coming-${r.id}`}>
          <h3 className="mb-3 text-sm font-bold tracking-[0.14em] text-[#b3242f] uppercase">
            {r.label}
          </h3>
          <Cards finds={r.finds} ask={ask} testId={`coming-${r.id}-cards`} />
        </div>
      ))}
    </section>
  );
}

/**
 * **Explore Christmas** — every listing, filtered in the visitor's own hand
 * (`Finder`, ADR 026): categories several at once, show more on demand,
 * a host's answer when nothing matches. Leaves out what Coming up showed.
 */
export async function Explore({
  ask,
  today,
}: {
  readonly ask: Ask;
  readonly today: string;
}) {
  const { townName, origin } = place(ask);
  const [{ corpus, data, coming }, lights] = await Promise.all([
    answer(ask, today),
    lightsNow(),
  ]);
  const dated = Boolean(ask.from || ask.to);
  const days = dated
    ? { from: ask.from ?? ask.to!, to: ask.to ?? ask.from! }
    : undefined;
  const oneDay = days && days.from === days.to ? days.from : undefined;
  const when = whenLabel(ask, today);
  const tonight = oneDay === today;
  const pins = lightsNear(lights.pins, origin, ask.km, days);
  const evening = oneDay
    ? openThisEvening(corpus.experiences, origin, ask.km, oneDay)
    : [];
  const age = youngest(ask);

  return (
    <Finder
      data={data}
      ask={ask}
      today={today}
      when={when}
      townName={townName}
      origin={origin}
      {...(age !== undefined ? { youngest: age } : {})}
      {...(coming ? { exclude: shownIn(coming) } : {})}
      pinsOn={pins.on.length}
      outage={Boolean(corpus.outage)}
      evening={
        evening.length > 0 ? (
          <section data-testid="shelf-evening" aria-labelledby="evening-title">
            <p className="text-sm font-bold tracking-[0.14em] text-[#b3242f] uppercase">
              Make an evening of it
            </p>
            <h2
              id="evening-title"
              className="ghad-display mt-1 text-2xl leading-tight font-extrabold tracking-tight sm:text-3xl"
            >
              {tonight ? "Dinner open tonight" : `Dinner open ${when}`}
            </h2>
            <p className="mt-1 max-w-2xl text-base text-[var(--gh-ink-soft)]">
              Open after 8 pm by their own published hours. Book ahead.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {evening.map((o) => (
                <EveningCard key={o.experience.id} open={o} />
              ))}
            </div>
          </section>
        ) : undefined
      }
      warm={
        <LocalFavouriteStops
          experience="christmas"
          title="Warm up before or after"
          stops={favouritesNear("christmas", origin, ask.km)}
          className="pt-2"
        />
      }
    />
  );
}

/**
 * **Christmas Lights** (owner brief M1154, the seventh band): the map, the
 * ready-made drives (`suggestedDrives`, the same rule as Build My Lights
 * Tour) and the displays locals pinned near here. Route planning stays on
 * the Lights Map, one tap away.
 */
export async function ChristmasLights({
  ask,
  today,
  mapHref,
}: {
  readonly ask: Ask;
  readonly today: string;
  readonly mapHref: string;
}) {
  const { townName, origin } = place(ask);
  const lights = await lightsNow();
  const dated = Boolean(ask.from || ask.to);
  const days = dated
    ? { from: ask.from ?? ask.to!, to: ask.to ?? ask.from! }
    : undefined;
  const tonight = days?.from === today && days.to === today;
  const pins = lightsNear(lights.pins, origin, ask.km, days);
  const displays = [
    ...pins.popular,
    ...pins.on.filter((n) => !pins.popular.some((p) => p.pin.id === n.pin.id)),
  ].slice(0, 4);
  // A drive starts from its own town's centre; offer the ones a visitor
  // here would make, not one an hour away.
  const drives = suggestedDrives(lights.pins, today)
    .filter((d) => {
      const at = areaById(d.id)?.at;
      return (
        at !== undefined &&
        distanceKm(origin, { latitude: at.lat, longitude: at.lng }) <=
          Math.max(ask.km, 30)
      );
    })
    .slice(0, 3);

  return (
    <section
      aria-labelledby="lights-title"
      data-testid="christmas-lights"
      className="space-y-5"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2
          id="lights-title"
          className="ghad-display text-[1.75rem] leading-tight font-extrabold tracking-[-0.02em] sm:text-4xl"
        >
          Christmas lights
        </h2>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Link
          href={mapHref}
          data-testid="lights-map-link"
          className="group relative flex min-h-40 flex-col justify-end overflow-hidden rounded-[26px] bg-[#0b2a4a] p-5 text-white shadow-[0_12px_34px_rgba(11,42,74,0.35)]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 18% 28%, rgba(255,217,138,0.55) 0 3px, transparent 4px), radial-gradient(circle at 62% 40%, rgba(255,120,120,0.6) 0 3px, transparent 4px), radial-gradient(circle at 80% 22%, rgba(140,220,255,0.6) 0 3px, transparent 4px), radial-gradient(circle at 40% 65%, rgba(255,217,138,0.5) 0 3px, transparent 4px), radial-gradient(circle at 75% 75%, rgba(255,217,138,0.25), transparent 45%)",
          }}
        >
          <MapIcon className="mb-2 h-8 w-8 text-[#ffd98a]" aria-hidden />
          <span className="ghad-display text-2xl leading-tight font-extrabold">
            The Christmas Lights Map
          </span>
          <span className="text-sm text-white/85">
            Every display locals have pinned around {townName}, and Build My
            Lights Tour for a route of your own.
          </span>
          <span className="mt-2 inline-flex items-center gap-1 font-semibold text-[#ffd98a]">
            Open the map <ArrowRight className="h-4 w-4" aria-hidden />
          </span>
        </Link>
        <div
          className="rounded-[26px] bg-white p-5 shadow-[0_10px_30px_rgba(8,35,25,0.08)] ring-1 ring-black/5"
          data-testid="lights-drives"
        >
          <p className="flex items-center gap-2 text-sm font-bold tracking-[0.14em] text-[#b3242f] uppercase">
            <Route className="h-4 w-4" aria-hidden /> Ready-made drives
          </p>
          {drives.length > 0 ? (
            <ul className="mt-2 divide-y divide-black/5">
              {drives.map((d) => (
                <li key={d.id}>
                  <Link
                    href={d.tourHref}
                    className="flex min-h-14 items-center justify-between gap-3 py-2"
                    data-testid="lights-drive"
                  >
                    <span>
                      <span className="block font-bold">{d.title}</span>
                      <span className="text-sm text-[var(--gh-ink-soft)]">
                        {d.stops.length} displays · about {driveLength(d)} ·{" "}
                        {d.night === today ? "tonight" : shortDay(d.night)}
                      </span>
                    </span>
                    <ArrowRight className="h-4 w-4 shrink-0" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-base text-[var(--gh-ink-soft)]">
              Drives appear once locals confirm displays lit this season.
            </p>
          )}
          <Link
            href="/christmas/lights/tour"
            className="mt-2 inline-flex min-h-11 items-center gap-1 font-semibold underline underline-offset-4"
            data-testid="lights-tour-link"
          >
            Build My Lights Tour
          </Link>
        </div>
      </div>
      {displays.length > 0 && (
        <div data-testid="shelf-lights-on">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-bold tracking-[0.14em] text-[#b3242f] uppercase">
            <Star className="h-4 w-4" aria-hidden />
            {tonight
              ? "Community displays lit tonight"
              : dated
                ? "Community displays on these dates"
                : "Community displays nearby"}
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {displays.map((n) => (
              <PinNearCard key={n.pin.id} near={n} />
            ))}
          </div>
          <p className="mt-2 text-sm text-[var(--gh-ink-soft)]">
            Pinned by locals and checked by a person
            {pins.popular.length > 0 ? ", with families' own star ratings" : ""}
            .
          </p>
        </div>
      )}
    </section>
  );
}
