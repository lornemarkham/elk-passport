import type { Metadata } from "next";
import Link from "next/link";
import { listDiscoveryCandidates } from "@/lib/data/atlas-repo";
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
import { BrowseMonth } from "@/components/october/discover/BrowseMonth";
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
export default async function OctoberDiscoverPage() {
  // **An October surface reads from a day inside October.** Before the month
  // begins `octoberNow` anchors on the first of it, so Tonight stops leading
  // with the last Sunday in September and This weekend stops being empty
  // because the weekend it offered had already gone. Once October is under way
  // this is the real instant and the page advances by itself.
  const now = octoberNow(new Date());
  const today = localDay(now);
  const { from: octoberFrom, to: octoberTo } = octoberWindow(now);
  const candidates = await listDiscoveryCandidates().catch(() => []);
  const experiences = candidates.map(candidateToExperience);

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

  const lead = leadOf(tonight);
  const alsoTonight = withoutLead(tonight).slice(0, 3);
  // A fortnight is a scannable calendar; the rest of the month is browsing,
  // and that is the lane underneath.
  const comingDays = byDay(soon, today).slice(0, 8);

  return (
    <main className="mx-auto max-w-6xl px-4 pt-10 pb-24 sm:px-6">
      <header>
        <h1 className="font-heading text-4xl tracking-tight text-[#f3efe4] sm:text-5xl">
          What&apos;s on
        </h1>
        <p className="mt-2 text-[#e9e6da]/50">October in the Okanagan.</p>
      </header>

      {/* ================================================== TONIGHT ======== */}
      <section className="mt-10" data-testid="lane-tonight">
        <LaneHead title="Tonight" />
        {lead ? (
          <>
            <LeadCard unit={lead} eyebrow="On tonight" />
            {alsoTonight.length > 0 ? (
              <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {alsoTonight.map((unit) => (
                  <li key={unit.head.id}>
                    <DiscoverCard unit={unit} label="Tonight" />
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        ) : (
          <Quiet>
            Nothing Passport can date is on tonight. Most nights are like that —
            what is coming is below.
          </Quiet>
        )}
      </section>

      {/* ============================================= THIS WEEKEND ======== */}
      <section className="mt-16" data-testid="lane-weekend">
        <LaneHead title="This weekend" />
        {weekend.length > 0 ? (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {weekend.slice(0, 6).map((unit) => (
              <li key={unit.head.id}>
                <DiscoverCard unit={unit} label="This weekend" />
              </li>
            ))}
          </ul>
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
                  <DiscoverCard unit={unit} label={shelf.title} />
                </li>
              ))}
            </ul>
          ) : (
            <ul className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6">
              {shelf.units.slice(0, 10).map((unit) => (
                <li key={unit.head.id} className="w-64 shrink-0 sm:w-72">
                  <DiscoverCard unit={unit} label={shelf.title} />
                </li>
              ))}
            </ul>
          )}
          {/* The one subject October has exactly one of. A shelf of one is a
              heading with a card under it; a feature is the honest shape. */}
          {index === 0 && feature && (
            <div className="mt-6">
              <FeatureCard
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
                      <CompactRow unit={unit} />
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
