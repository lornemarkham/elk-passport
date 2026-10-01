import type { Metadata } from "next";
import Link from "next/link";
import { discoveryCandidates } from "@/lib/data/atlas-repo";
import { candidateToExperience } from "@/domain/experience/atlasMapper";
import type { Experience } from "@/domain/experience/types";
import {
  happeningThisWeekend,
  happeningTonight,
  happeningWithin,
  localDay,
  nextRelevantDay,
  upcoming,
} from "@/domain/october/calendar";
import { OCTOBER_AREAS } from "@/domain/october/areas";
import { octoberNow, octoberWindow } from "@/domain/october/octoberWindow";
import {
  collectionBySlug,
  resolveCollection,
} from "@/domain/collections/editorial";
import { asDiscoveryUnits } from "@/domain/discovery/discoveryUnits";
import {
  OCTOBER_FEATURE,
  OCTOBER_SHELVES,
} from "@/lib/passport/curation/octoberShelves";
import {
  byDay,
  byOctoberSpecificity,
  leadOf,
  withoutAlreadyShown,
  withoutLead,
} from "@/domain/discovery/presentation";
import { Unanswered } from "@/components/october/shell/atoms";
import { keptOnThisPage } from "@/lib/october/keptOnThisPage";
import { keepFor } from "@/components/october/save/keepFor";
import { BrowseMonth } from "@/components/october/discover/BrowseMonth";
import { currentUser } from "@/lib/auth/currentUser";
import { getSubjectDetail } from "@/lib/data/atlas-repo";
import { subjectPageView } from "@/lib/passport/subjectPage";
import { profileFor } from "@/lib/profile/profileService";
import { OCTOBER_PLACES, placeFrom } from "@/domain/environment/places";
import { classifySubject } from "@/domain/october/subjectKind";
import { conditionsFor } from "@/domain/october/conditions";
import { environmentsForPoints, nearestPlace } from "@/lib/environment/atEvent";
import {
  localnessOf,
  byNearest,
  type PlacePoints,
} from "@/domain/october/localness";
import { RightNow } from "@/components/october/environment/RightNow";
import { temporalContext } from "@/domain/october/temporal";
import { lightPhaseAt } from "@/domain/environment/daylight";
import { SkyWash } from "@/components/october/environment/SkyWash";
import { placeById } from "@/domain/environment/places";
import { scenarioFrom, simulatedEnvironment } from "@/lib/environment/scenario";
import { CardWeather } from "@/components/october/environment/CardWeather";
import { quickFor } from "@/components/october/quick/quickFor";
import { closingFor, dontMiss } from "@/domain/october/dontMiss";
import { DontMiss } from "@/components/october/discover/DontMiss";
import { hypeFor, savedContextFor, strongestHype } from "@/domain/october/hype";
import { HypeSky } from "@/components/october/discover/HypeSky";
import { HypeCard } from "@/components/october/discover/HypeCard";
import {
  CompactRow,
  FeatureCard,
  DiscoverCard,
  LeadCard,
  dayLabel,
} from "@/components/october/discover/cards";

export const metadata: Metadata = {
  title: "Discover — October",
};

/**
 * **Discover, arranged around a decision rather than around a corpus.**
 *
 * The question a person actually arrives with is *what looks fun tonight*, and
 * the page is ordered by how soon they could act on the answer: Tonight, then
 * the weekend, then a calendar of what is coming, then the month to browse,
 * then themes to wander into. Weight follows immediacy — **not** record count,
 * which is why the largest lane in the corpus is the quietest one on the page.
 *
 * ## What the evidence will support, and what it will not
 *
 * Of the 180 datable things Atlas currently holds, all have a title, a
 * description and a date; about a quarter have a picture; and **none has a
 * location** — no venue, no town, no coordinate. So there is no place line on
 * any card here. The brief asked for one and the corpus cannot answer it, and
 * an invented "Vernon" would be worse than its absence.
 *
 * Presentation treatment is decided by what is *known* (`presentation.ts`) —
 * whether a record can carry a picture, how complete it is, how soon it is.
 * Nothing on this page is called best, top, featured or recommended, because
 * Atlas supports no such claim and Passport does not manufacture one.
 *
 * ## The groupings are Passport's
 *
 * Atlas holds no notion of October and is not being taught one. Where an area
 * names an **editorial collection** that stated membership is authoritative;
 * everywhere else a keyword lens still runs, and those shelves say so.
 */
export default async function OctoberDiscoverPage({
  searchParams,
}: {
  searchParams: Promise<{ sim?: string }>;
}) {
  // Development only; inert in any deployed build.
  const scenario = scenarioFrom((await searchParams).sim);
  // **An October surface reads from a day inside October.** Before the month
  // begins `octoberNow` anchors on the first of it, so Tonight stops leading
  // with the last Sunday in September and This weekend stops being empty
  // because the weekend it offered had already gone. Once October is under way
  // this is the real instant and the page advances by itself.
  //
  // A dev scenario moves this instant too, not only the weather — otherwise
  // the lanes keep showing today while the forecast claims to be Halloween,
  // which is a harness that cannot be used to look at a different day.
  const nowReal = scenario ? scenario.now : new Date();
  const now = octoberNow(nowReal);
  const today = localDay(nowReal);
  const { from: octoberFrom, to: octoberTo } = octoberWindow(now);
  // An empty corpus and an unanswered question are different answers, and
  // this page used to render both as "nothing is on".
  // Two reads for the whole page, not two per card: what October holds, and
  // what this person has already kept out of it.
  const [atlas, page, user] = await Promise.all([
    discoveryCandidates(),
    keptOnThisPage(),
    currentUser().catch(() => null),
  ]);
  const experiences = atlas.candidates.map(candidateToExperience);

  // Where this person's October is, and what the sky is doing — at each
  // thing's own place, not at theirs.
  const profile = user ? await profileFor(user).catch(() => null) : null;
  const place = scenario
    ? placeById(scenario.areaId)
    : placeFrom(profile?.homeArea);
  const points: PlacePoints = new Map(
    atlas.candidates
      .filter((c) => c.coordinates)
      .map((c) => [
        c.id,
        { latitude: c.coordinates![1], longitude: c.coordinates![0] },
      ]),
  );
  const venuePoints = experiences
    .map((e) => (e.venue?.placeId ? points.get(e.venue.placeId) : undefined))
    .filter((pt): pt is { latitude: number; longitude: number } => Boolean(pt));
  const environments = scenario
    ? new Map(
        OCTOBER_PLACES.map((p) => [p.id, simulatedEnvironment(scenario, p)]),
      )
    : await environmentsForPoints(venuePoints, place);
  const outside = place ? environments.get(place.id) : undefined;
  const near = (e: Experience) => localnessOf(e, place, points);

  const environmentAt = (e: Experience) => {
    const pt = e.venue?.placeId ? points.get(e.venue.placeId) : undefined;
    const at = pt ? nearestPlace(pt) : undefined;
    return at ? environments.get(at.id) : pt ? undefined : outside;
  };

  /** Town, and how far that is from the October this person is having. */
  const NEARNESS_SAYS = {
    here: undefined,
    nearby: "nearby",
    "a-drive": "worth the drive",
    unknown: undefined,
  } as const;
  const whereFor = (unit: { head: Experience }) => {
    const l = near(unit.head);
    const town = l.locality;
    const far = NEARNESS_SAYS[l.nearness];
    if (!town && !far) return undefined;
    return [town, far].filter(Boolean).join(" · ");
  };

  /** Coming up rows say what conditions mean, when they mean anything. */
  const weatherNote = (unit: { head: Experience }, day: string) => {
    const head = unit.head;
    const venueSubtype = head.venue?.placeId
      ? atlas.candidates.find((c) => c.id === head.venue!.placeId)?.subtype
      : undefined;
    const { kind } = classifySubject(head, venueSubtype);
    const read = conditionsFor(kind, day, environmentAt(head), nowReal);
    return read ? <CardWeather read={read} /> : undefined;
  };
  const keep = (unit: { head: Experience }) =>
    keepFor(unit.head, page, "/october/discover");

  // Stated membership, resolved live against Atlas.
  const curated = OCTOBER_AREAS.flatMap((area) => {
    const collection = area.collectionSlug
      ? collectionBySlug(area.collectionSlug)
      : undefined;
    if (!collection) return [];
    return [{ area, ...resolveCollection(collection, experiences) }];
  });
  const spokenFor = new Set(curated.flatMap((c) => c.members.map((m) => m.id)));
  const free = (list: readonly Experience[]) =>
    list.filter((e) => !spokenFor.has(e.id));

  // One attraction is one discovery, everywhere on this page.
  const units = (list: readonly Experience[]) =>
    asDiscoveryUnits(list, experiences);

  const tonight = units(happeningTonight(experiences, now));
  // **This weekend answers "what *else*".** A multi-day run is legitimately
  // eligible for both lanes, and unsubtracted the weekend opened with the four
  // cards the reader had just looked at. Removed here and nowhere else: these
  // units are untouched in Coming up, in Browse the month and on their own
  // pages, because they have not stopped being on.
  const weekend = withoutAlreadyShown(
    units(free(happeningThisWeekend(experiences, now))),
    tonight,
  );
  const soon = units(free(upcoming(experiences, now)));
  const month = byOctoberSpecificity(
    units(free(happeningWithin(experiences, octoberFrom, octoberTo))),
    octoberFrom,
  );

  // **Editorial shelves, drawn only from what is genuinely on.** The register
  // names ids; the lanes decide which of them October can still offer, and in
  // what order. A shelf whose subjects have all finished renders nothing.
  const everything = [...month, ...tonight, ...weekend, ...soon];
  const unitById = new Map(everything.map((u) => [u.head.id, u]));
  const shelves = OCTOBER_SHELVES.map((shelf) => ({
    ...shelf,
    units: shelf.entityIds
      .map((id) => unitById.get(id))
      .filter((u): u is NonNullable<typeof u> => Boolean(u)),
  })).filter((shelf) => shelf.units.length > 0);
  const feature = unitById.get(OCTOBER_FEATURE.entityId);

  // **Local first, everywhere a lane is capped.** Sorting before the cap is
  // the whole point: it changes *which* things survive it, not merely their
  // order. Nothing is filtered — a Vernon thing still appears for a Kelowna
  // person, below the Kelowna ones, marked as worth the drive.
  const localFirst = byNearest<{ head: Experience }>((u) => near(u.head));
  const tonightLocal = [...tonight].sort(localFirst);
  const weekendLocal = [...weekend].sort(localFirst);

  const lead = leadOf(tonightLocal);
  const alsoTonight = withoutLead(tonightLocal).slice(0, 3);
  // A fortnight is a scannable calendar; the rest of the month is browsing,
  // and that is the lane underneath.
  // Within a day, nearest first — so a Kelowna person's Saturday leads with
  // Kelowna rather than with whatever Atlas happened to return first.
  const comingDays = byDay(soon, today)
    .slice(0, 8)
    .map(({ day, units }) => ({
      day,
      units: [...units].sort(
        byNearest<{ head: Experience }>((u) => near(u.head)),
      ),
    }));

  // **What is closing.** Drawn from everything Atlas dates rather than from a
  // lane, because a thing on its final night is worth saying whether or not it
  // happened to survive Tonight's cap. Usually one; often none.
  const closing = dontMiss(experiences, (e) => {
    const venueSubtype = e.venue?.placeId
      ? atlas.candidates.find((c) => c.id === e.venue!.placeId)?.subtype
      : undefined;
    const atNight = classifySubject(e, venueSubtype).kind === "outdoor-night";
    return closingFor(e, today, atNight, nowReal);
  });

  // **What October would mention unprompted.** Evaluated across everything
  // Atlas dates, capped at one, and absent most days. Nothing the person has
  // already saved can qualify — that has become Anticipate's.
  const hyped = strongestHype(
    experiences
      .map((e) => {
        const venueSubtype = e.venue?.placeId
          ? atlas.candidates.find((c) => c.id === e.venue!.placeId)?.subtype
          : undefined;
        return hypeFor(e, {
          today,
          now: nowReal,
          kind: classifySubject(e, venueSubtype).kind,
          environment: environmentAt(e),
          saved: savedContextFor(Boolean(scenario), page.kept),
        });
      })
      .filter((h): h is NonNullable<typeof h> => Boolean(h)),
  );

  // Every subject's level, so a lane can treat a card without re-deciding.
  const hypeLevels = new Map(
    experiences
      .map((e) => {
        const venueSubtype = e.venue?.placeId
          ? atlas.candidates.find((c) => c.id === e.venue!.placeId)?.subtype
          : undefined;
        const h = hypeFor(e, {
          today,
          now: nowReal,
          kind: classifySubject(e, venueSubtype).kind,
          environment: environmentAt(e),
          saved: savedContextFor(Boolean(scenario), page.kept),
        });
        return [e.id, h?.level ?? 0] as const;
      })
      .filter(([, level]) => level > 0),
  );
  /** Wraps a card in its treatment. Level 0 is the card, untouched. */
  const treat = (unit: { head: Experience }, card: React.ReactNode) => {
    const level = hypeLevels.get(unit.head.id) ?? 0;
    // The takeover has its own surface; a card never tries to be one.
    if (level === 0 || level >= 4) return card;
    return (
      <HypeCard level={level} hasImage={Boolean(unit.head.heroMedia)}>
        {card}
      </HypeCard>
    );
  };

  // One request, and only when a takeover is actually on screen: Atlas's own
  // facts for the single hyped subject, for the optional drawer. A failure
  // means no drawer, never a broken page.
  const hypePanels =
    hyped?.level === 4
      ? await getSubjectDetail("events", hyped.subject.id)
          .then((composition) =>
            composition
              ? subjectPageView(composition).subject.facts.map((f) => ({
                  label: f.label,
                  value: f.value,
                }))
              : [],
          )
          .catch(() => [])
      : [];

  const when = temporalContext(nowReal);
  const phase = place
    ? lightPhaseAt(place.latitude, place.longitude, nowReal)
    : undefined;

  return (
    <SkyWash phase={phase}>
      {/* **The entrance.** Outside the page's column and before its header,
          because a takeover that renders inside the flow under "What's on" is
          a card — and a card is what nobody noticed. Only an astronomy
          subject with a clear forecast can reach this; see `hype.ts`. */}
      {/* Hype leads, because it is the thing you had not thought about. The
        only expression built is the sky, and only an astronomy subject with
        a clear forecast can reach it — see `hype.ts`. */}
      {hyped && hyped.level === 4 && hyped.kind === "astronomy" ? (
        <HypeSky
          hype={hyped}
          panels={hypePanels}
          thing={{
            entityId: hyped.subject.id,
            entityKind: "Event",
            name: hyped.subject.title,
            startsAt: hyped.subject.startTime ?? null,
          }}
          signedIn={page.signedIn}
          // Same simulation: under a scenario the block opens in its unsaved
          // state so the first-encounter language can be seen. The control
          // underneath is real — pressing it writes the real row.
          initiallySaved={scenario ? false : page.kept.has(hyped.subject.id)}
          detailHref={`/passport/${hyped.subject.id}`}
        />
      ) : null}

      <main className="mx-auto max-w-6xl px-4 pt-10 pb-24 sm:px-6">
        <header>
          <h1 className="font-heading text-4xl tracking-tight text-[#f3efe4] sm:text-5xl">
            What&apos;s on
          </h1>
          {/* Where October is standing. The question "is this using my area?"
            should never need answering by squinting at the results. */}
          <div className="mt-3">
            <RightNow
              area={place}
              environment={outside}
              now={nowReal}
              when={when}
              phase={phase}
              simulated={scenario?.label}
            />
          </div>
        </header>

        <DontMiss
          items={closing}
          keep={(experience) => keepFor(experience, page, "/october/discover")}
        />

        {/* ================================================== TONIGHT ======== */}
        <section className="mt-10" data-testid="lane-tonight">
          <LaneHead title="Tonight" />
          {lead ? (
            <>
              {treat(
                lead,
                <LeadCard unit={lead} eyebrow="On tonight" keep={keep(lead)} />,
              )}
              {alsoTonight.length > 0 ? (
                <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {alsoTonight.map((unit) => (
                    <li key={unit.head.id}>
                      {treat(
                        unit,
                        <DiscoverCard
                          unit={unit}
                          label="Tonight"
                          keep={keep(unit)}
                        />,
                      )}
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          ) : atlas.outage ? (
            <Unanswered />
          ) : (
            <Quiet>
              Nothing Passport can date is on tonight. Most nights are like that
              — what is coming is below.
            </Quiet>
          )}
        </section>

        {/* ============================================= THIS WEEKEND ======== */}
        <section className="mt-16" data-testid="lane-weekend">
          <LaneHead title="This weekend" />
          {weekendLocal.length > 0 ? (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {weekendLocal.slice(0, 6).map((unit) => (
                <li key={unit.head.id}>
                  {treat(
                    unit,
                    <DiscoverCard
                      unit={unit}
                      label="This weekend"
                      keep={keep(unit)}
                    />,
                  )}
                </li>
              ))}
            </ul>
          ) : atlas.outage ? (
            <Unanswered />
          ) : (
            <Quiet>Nothing dated falls on the coming weekend.</Quiet>
          )}
        </section>

        {/* ================================================= EDITORIAL =======
          Between the two immediate lanes and the calendar: the shapes October
          actually has, in different forms so the page has a rhythm rather
          than four identical grids. Each is drawn from the same units the
          lanes are, so nothing here can show something that is not on. */}
        {shelves.map((shelf, index) => (
          <section
            key={shelf.id}
            className="mt-16"
            data-testid={`shelf-${shelf.id}`}
          >
            <LaneHead title={shelf.title} note={shelf.blurb} />
            {index === 0 ? (
              // The haunts get room: they are what the month is for, and they
              // are the subjects with the strongest media.
              <ul className="grid gap-4 sm:grid-cols-2">
                {shelf.units.slice(0, 4).map((unit) => (
                  <li key={unit.head.id}>
                    {treat(
                      unit,
                      <DiscoverCard
                        unit={unit}
                        label={shelf.title}
                        keep={keep(unit)}
                      />,
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <ul className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6">
                {shelf.units.slice(0, 10).map((unit) => (
                  <li key={unit.head.id} className="w-64 shrink-0 sm:w-72">
                    <DiscoverCard
                      unit={unit}
                      label={shelf.title}
                      keep={keep(unit)}
                    />
                  </li>
                ))}
              </ul>
            )}
            {/* The one subject October has exactly one of. A shelf of one is a
              heading with a card under it; a feature is the honest shape. */}
            {/* The curated feature stands down while October is actively
                hyping the same subject — the Draconids appearing twice on one
                page reads as a bug, not as emphasis. */}
            {index === 0 &&
              feature &&
              feature.head.id !== hyped?.subject.id && (
                <div className="mt-6">
                  <FeatureCard
                    keep={keep(feature)}
                    unit={feature}
                    eyebrow={OCTOBER_FEATURE.eyebrow}
                    title={OCTOBER_FEATURE.title}
                    blurb={OCTOBER_FEATURE.blurb}
                  />
                </div>
              )}
          </section>
        ))}

        {/* ================================================ COMING UP ======== */}
        <section className="mt-16" data-testid="lane-coming">
          <LaneHead title="Coming up" note="The next few weeks, by date." />
          {comingDays.length > 0 ? (
            <div className="flex flex-col gap-1">
              {comingDays.map(({ day, units: onDay }) => (
                <div
                  key={day}
                  data-testid="coming-day"
                  // `minmax(0,1fr)` and `min-w-0`: a grid column is `auto` by
                  // default, which sizes to max-content, so a long title in a
                  // truncating row cannot shrink and pushes the whole page into
                  // a horizontal scroll on a phone. Measured at 375px: 713px
                  // wide before this.
                  className="grid gap-x-6 border-t border-[#e9e6da]/[0.07] py-3 sm:grid-cols-[9rem_minmax(0,1fr)]"
                >
                  <p className="font-heading pt-2 text-sm text-[#d09a4e] tabular-nums">
                    {dayLabel(day)}
                  </p>
                  <ul className="min-w-0 divide-y divide-transparent">
                    {onDay.map((unit) => (
                      <li key={unit.head.id}>
                        <CompactRow
                          unit={unit}
                          where={whereFor(unit)}
                          note={weatherNote(unit, day)}
                        />
                        {/* Outside the row, because the row is itself one
                            <a> and an anchor inside an anchor is invalid
                            HTML that fails hydration. */}
                        <div className="px-3 pb-3">{quickFor(unit.head)}</div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : (
            <Quiet>Nothing dated is ahead of us right now.</Quiet>
          )}
        </section>

        {/* =============================================== ALL OCTOBER ======= */}
        <section className="mt-16" data-testid="lane-month">
          <LaneHead
            title="Browse the month"
            note={
              month.length > 0
                ? `${month.length} things Atlas can date inside October.`
                : undefined
            }
            action={
              <Link
                href="/discovery"
                className="text-sm text-[#e9e6da]/45 underline-offset-4 hover:text-[#e9e6da]/75 hover:underline"
              >
                Search everything
              </Link>
            }
          />
          {month.length > 0 ? (
            <BrowseMonth
              rows={month.map((unit) => ({
                unit,
                day: nextRelevantDay(unit.head, octoberFrom),
              }))}
            />
          ) : (
            <Quiet>Atlas can date nothing inside October yet.</Quiet>
          )}
        </section>

        {/* The editorial collection shelves that used to sit here are gone:
          "Events & Haunts" held two subjects, both of which now lead Haunted
          October above. A second heading over the same two cards is
          repetition, not navigation. The collection mechanism is untouched and
          still runs /october/explore/[area]. */}
      </main>
    </SkyWash>
  );
}

function LaneHead({
  title,
  note,
  action,
}: {
  readonly title: string;
  readonly note?: string;
  readonly action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <div className="flex flex-wrap items-baseline gap-x-3">
        <h2 className="font-heading text-2xl text-[#f3efe4] sm:text-3xl">
          {title}
        </h2>
        {note ? <p className="text-sm text-[#e9e6da]/40">{note}</p> : null}
      </div>
      {action}
    </div>
  );
}

/** A lane with nothing in it, said without apology or filler. */
function Quiet({ children }: { readonly children: React.ReactNode }) {
  return (
    <p
      data-testid="october-nothing"
      className="max-w-xl text-[#e9e6da]/45 italic"
    >
      {children}
    </p>
  );
}
