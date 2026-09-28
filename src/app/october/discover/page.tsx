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
import { OCTOBER_AREAS, hrefForArea } from "@/domain/october/areas";
import { octoberNow, octoberWindow } from "@/domain/october/octoberWindow";
import {
  collectionBySlug,
  resolveCollection,
} from "@/domain/collections/editorial";
import { asDiscoveryUnits } from "@/domain/discovery/discoveryUnits";
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
  DiscoverCard,
  LeadCard,
  ShelfCard,
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
                <ul className="min-w-0">
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

      {/* ================================================== THEMES =========
          **Only shelves whose membership is evidence.**

          An October recommendation has to be connected to October by
          something. An editorial collection is: a person decided those Things
          belong. A keyword lens is not — it matches words in a description
          over the whole corpus, with no temporal evidence of any kind.

          Measured on the rendered page before this changed: of the 36 cards
          the three lens shelves produced, **0 had October temporal evidence**.
          What they did produce was five wineries under "Kids October",
          "Kids snowmobile rides", and two pairs of near-duplicate bakeries.
          Truthfully labelling that "found by matching words" made it honest
          without making it useful, and a smaller truthful product beats a
          larger misleading one.

          The lens itself is untouched and still runs `/october/explore/[area]`,
          where a person has asked for that specific browse. It is only not
          allowed to make recommendations here. */}
      <div className="mt-20 flex flex-col gap-14">
        {curated.map(({ area, members }) =>
          members.length > 0 ? (
            <Shelf
              key={area.id}
              title={area.label}
              note={area.line}
              href={hrefForArea(area)}
              items={members}
              testid={`collection-${area.collectionSlug}`}
            />
          ) : null,
        )}
      </div>
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

/**
 * A theme, as a shelf you can push along rather than a block of taxonomy
 * output. Horizontal on every width: it reads as "a way into October" instead
 * of "the rest of the result set".
 */
function Shelf({
  title,
  note,
  href,
  items,
  caveat,
  testid,
}: {
  readonly title: string;
  readonly note?: string;
  readonly href: string;
  readonly items: readonly Experience[];
  readonly caveat?: string;
  readonly testid?: string;
}) {
  return (
    <section>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div className="flex flex-wrap items-baseline gap-x-3">
          <h2 className="font-heading text-xl text-[#f3efe4]">{title}</h2>
          {note ? <p className="text-sm text-[#e9e6da]/40">{note}</p> : null}
        </div>
        <Link
          href={href}
          className="text-sm text-[#e9e6da]/45 underline-offset-4 hover:text-[#e9e6da]/75 hover:underline"
        >
          More
        </Link>
      </div>
      {caveat ? (
        <p className="mb-3 text-xs text-[#e9e6da]/25">{caveat}</p>
      ) : null}
      <ul
        data-testid={testid}
        className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6"
      >
        {items.slice(0, 12).map((e) => (
          <li key={e.id}>
            <ShelfCard experience={e} />
          </li>
        ))}
      </ul>
    </section>
  );
}
