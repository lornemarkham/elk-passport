import Link from "next/link";
import { destinationFor } from "@/domain/experience/destination";
import { formatEventWhen, ZONE } from "@/domain/experience/eventTime";
import type { Experience } from "@/domain/experience/types";
import { namesOf, type DiscoveryUnit } from "@/domain/discovery/discoveryUnits";
import { statedDaysLine } from "@/components/october/shell/UnitCard";

/**
 * **Cards for deciding, not for auditing.**
 *
 * Three weights, and which one a discovery gets is decided by the lane it is
 * in and by how much of it is actually known — never by an editorial opinion
 * the corpus cannot support. There is no "featured", no "top pick" and no
 * score.
 *
 * ## What these can and cannot say
 *
 * Every dated thing has a title, a description and a date. About a quarter
 * have a picture. **None of them has a location** — not a venue, not a town,
 * not a coordinate — so no card here has a place line, because the honest
 * alternative to a missing value is its absence rather than a guess.
 *
 * A card degrades in one direction only: less is drawn, never less is true.
 */

/** What a lane can say about when, from whichever evidence the thing has. */
export function whenLine(unit: DiscoveryUnit): string | undefined {
  const { head } = unit;
  return (
    formatEventWhen(head.startTime, head.endTime, head.timePrecision) ??
    statedDaysLine(head) ??
    (unit.options.length > 0 ? statedDaysLine(unit.options[0]!) : undefined)
  );
}

const src = (e: Experience) => e.heroMedia?.src;

/**
 * **Where it is, in as many words as Atlas can vouch for.**
 *
 * `Vernon Jazz Club · Vernon` when both are known, one of them when only one
 * is, and **nothing at all** when Atlas knows neither — which is most of the
 * corpus. The absence is the honest answer and is never padded out with a
 * region, a publisher's town, or "Okanagan".
 */
export function whereLine(unit: DiscoveryUnit): string | undefined {
  const venue = unit.head.venue ?? unit.options.find((o) => o.venue)?.venue;
  if (!venue) return undefined;
  const parts = [venue.name, venue.locality].filter((p): p is string =>
    Boolean(p && p.trim()),
  );
  // "Vernon Jazz Club · Vernon" reads well; "Vernon · Vernon" does not.
  const unique = parts.filter((p, i) => parts.indexOf(p) === i);
  return unique.length > 0 ? unique.join(" · ") : undefined;
}

function Where({
  unit,
  className,
}: {
  readonly unit: DiscoveryUnit;
  readonly className: string;
}) {
  const where = whereLine(unit);
  if (!where) return null;
  return (
    <p data-testid="card-where" className={className}>
      {where}
    </p>
  );
}

/** The modes of an attraction, named. Never counted. */
function Options({
  unit,
  label,
}: {
  readonly unit: DiscoveryUnit;
  readonly label: string;
}) {
  if (unit.options.length === 0) return null;
  return (
    <p data-testid="card-options" className="mt-3 flex flex-wrap gap-1.5">
      <span className="sr-only">{label}: </span>
      {namesOf(unit).map((name) => (
        <span
          key={name}
          className="rounded-full border border-[#d09a4e]/25 px-2.5 py-1 text-xs text-[#d09a4e]"
        >
          {name}
        </span>
      ))}
    </p>
  );
}

/**
 * **The one thing a person is most likely to act on right now**, drawn big.
 *
 * Large because it is the soonest thing that can carry a picture — a fact
 * about the record, not a recommendation. Nothing on it claims to be best.
 */
export function LeadCard({
  unit,
  eyebrow,
}: {
  readonly unit: DiscoveryUnit;
  readonly eyebrow: string;
}) {
  const { head } = unit;
  const image = src(head);
  const when = whenLine(unit);
  return (
    <Link
      href={destinationFor(head) ?? "#"}
      data-testid="lead-card"
      className="group grid overflow-hidden rounded-2xl border border-[#e9e6da]/10 bg-[#e9e6da]/[0.03] transition-colors hover:border-[#d09a4e]/40 sm:grid-cols-2"
    >
      {image ? (
        <div className="relative aspect-[16/10] overflow-hidden sm:aspect-auto sm:h-full sm:min-h-64">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={image}
            alt={head.heroMedia?.alt ?? ""}
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
          />
        </div>
      ) : null}
      <div className="flex flex-col justify-center p-6 sm:p-8">
        <p className="text-[11px] tracking-[0.25em] text-[#d09a4e] uppercase">
          {eyebrow}
        </p>
        <h3 className="font-heading mt-3 text-2xl leading-tight text-balance text-[#f3efe4] sm:text-3xl">
          {head.title}
        </h3>
        {when ? (
          <p className="mt-3 text-sm text-[#e9e6da]/70 tabular-nums">{when}</p>
        ) : null}
        <Where unit={unit} className="mt-1 text-sm text-[#e9e6da]/50" />
        {head.shortDescription ? (
          <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-[#e9e6da]/55">
            {head.shortDescription}
          </p>
        ) : null}
        <Options unit={unit} label={eyebrow} />
      </div>
    </Link>
  );
}

/** The ordinary discovery card: picture where there is one, and the facts. */
export function DiscoverCard({
  unit,
  label,
}: {
  readonly unit: DiscoveryUnit;
  readonly label: string;
}) {
  const { head } = unit;
  const image = src(head);
  const when = whenLine(unit);
  return (
    <Link
      href={destinationFor(head) ?? "#"}
      data-testid="october-card"
      className="group flex h-full flex-col overflow-hidden rounded-xl border border-[#e9e6da]/10 bg-[#e9e6da]/[0.03] transition-colors hover:border-[#d09a4e]/40 hover:bg-[#e9e6da]/[0.06]"
    >
      {image ? (
        <div className="aspect-[16/9] overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={image}
            alt={head.heroMedia?.alt ?? ""}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
          />
        </div>
      ) : null}
      <div className="flex flex-1 flex-col p-4">
        {when ? (
          <p className="text-xs text-[#d09a4e]/90 tabular-nums">{when}</p>
        ) : null}
        <h3 className="font-heading mt-1 text-lg leading-snug text-[#f3efe4]">
          {head.title}
        </h3>
        <Where unit={unit} className="mt-0.5 text-xs text-[#e9e6da]/45" />
        {head.shortDescription ? (
          <p className="mt-1.5 line-clamp-2 text-sm text-[#e9e6da]/50">
            {head.shortDescription}
          </p>
        ) : null}
        <Options unit={unit} label={label} />
      </div>
    </Link>
  );
}

/**
 * One line in a calendar. No picture, no description — a person scanning what
 * is coming wants the shape of the month, and eleven paragraphs is not a
 * shape.
 */
export function CompactRow({ unit }: { readonly unit: DiscoveryUnit }) {
  const { head } = unit;
  // **A clock only where a publisher stated one.** This column used to render
  // every Event's instant, so a date-only Event — 47 of October's 86 — printed
  // `5:00 p.m.`, which is UTC midnight read in Vancouver and a time nobody
  // published. An em dash is the honest answer; the day is the card's own.
  const clock =
    head.startTime && head.timePrecision === "minute"
      ? new Intl.DateTimeFormat("en-CA", {
          hour: "numeric",
          minute: "2-digit",
          timeZone: ZONE,
        }).format(new Date(head.startTime))
      : undefined;
  return (
    <Link
      href={destinationFor(head) ?? "#"}
      data-testid="compact-row"
      // **Two rows that touch are one target.** Measured on the rendered page:
      // the Draconids row ended at 2629px and the Valdy row began at 2629px —
      // no gap, no divider — so a click aimed a few pixels low at one opened
      // the other. Each row is now its own bounded object: a hairline between
      // them, breathing room, a hover that covers the whole band, and a
      // visible focus ring for anyone arriving by keyboard.
      className="group flex items-baseline gap-4 rounded-lg border-b border-[#e9e6da]/[0.06] px-3 py-3.5 transition-colors last:border-b-0 hover:bg-[#e9e6da]/[0.06] focus-visible:ring-1 focus-visible:ring-[#d09a4e] focus-visible:outline-none"
    >
      {/* **The clock column exists only when there is a clock.**

          It was a fixed 5rem lane holding an em dash for the 47 of October's
          86 Events that truthfully have no stated time — a column of
          placeholders, which reads as fields that failed to load rather than
          as a date-only event. Nothing is invented and nothing stated is
          hidden: a real time still gets the same prominence it always had,
          and a date-only row simply begins at the title. */}
      {clock ? (
        <span className="w-20 shrink-0 text-xs text-[#e9e6da]/60 tabular-nums">
          {clock}
        </span>
      ) : null}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[#e9e6da]/85 group-hover:text-[#f3efe4]">
          {head.title}
        </span>
        {unit.options.length > 0 ? (
          <span className="mt-0.5 block truncate text-xs text-[#d09a4e]/80">
            {namesOf(unit).join(" · ")}
          </span>
        ) : whereLine(unit) ? (
          <span
            data-testid="card-where"
            className="mt-0.5 block truncate text-xs text-[#e9e6da]/40"
          >
            {whereLine(unit)}
          </span>
        ) : null}
      </span>
    </Link>
  );
}

/**
 * The quietest weight. Used where the job is "there is more of this month",
 * not "look at this" — a title and a date, nothing competing for the eye.
 */
export function BrowseRow({
  unit,
  day,
}: {
  readonly unit: DiscoveryUnit;
  readonly day?: string;
}) {
  // A short date, not the full when-line: a multi-day event's line is
  // "Thu, Sep 17, 2026 5:00 p.m. – Sat, Oct 3, 2026 5:00 p.m.", which in a
  // browse row crowds out the only thing the row is for — the title.
  return (
    <Link
      href={destinationFor(unit.head) ?? "#"}
      data-testid="browse-row"
      className="flex items-baseline justify-between gap-4 border-b border-[#e9e6da]/[0.06] py-2.5 text-sm transition-colors hover:border-[#d09a4e]/30"
    >
      <span className="min-w-0 truncate text-[#e9e6da]/70">
        {unit.head.title}
      </span>
      {day ? (
        <span className="shrink-0 text-xs text-[#e9e6da]/35 tabular-nums">
          {shortDay(day)}
        </span>
      ) : null}
    </Link>
  );
}

/** `Oct 17` — enough to place it in the month, and no more. */
export function shortDay(day: string): string {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString("en-CA", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** A thematic shelf item: small, picture-forward where one exists. */
export function ShelfCard({ experience }: { readonly experience: Experience }) {
  const image = src(experience);
  // Without a picture the tile carries the title itself rather than sitting
  // empty above one. Three quarters of the corpus has no image, and a row of
  // blank frames reads as broken rather than as restraint.
  if (!image) {
    return (
      <Link
        href={destinationFor(experience) ?? "#"}
        data-testid="shelf-card"
        className="group flex aspect-[4/3] w-56 shrink-0 flex-col justify-between rounded-xl border border-[#e9e6da]/10 bg-[#e9e6da]/[0.035] p-4 transition-colors hover:border-[#d09a4e]/40 hover:bg-[#e9e6da]/[0.06] sm:w-60"
      >
        <p className="font-heading line-clamp-3 text-base leading-snug text-[#e9e6da]/90 group-hover:text-[#f3efe4]">
          {experience.title}
        </p>
        <span className="text-[11px] tracking-wider text-[#e9e6da]/30 uppercase">
          {experience.subtype ?? experience.kind}
        </span>
      </Link>
    );
  }
  return (
    <Link
      href={destinationFor(experience) ?? "#"}
      data-testid="shelf-card"
      className="group block w-56 shrink-0 sm:w-60"
    >
      <div className="aspect-[4/3] overflow-hidden rounded-xl border border-[#e9e6da]/10 bg-[#e9e6da]/[0.04]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image}
          alt={experience.heroMedia?.alt ?? ""}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
        />
      </div>
      <p className="font-heading mt-2 line-clamp-2 text-sm leading-snug text-[#e9e6da]/85 group-hover:text-[#f3efe4]">
        {experience.title}
      </p>
    </Link>
  );
}

/** The date a calendar group is filed under, written for a person. */
export function dayLabel(day: string): string {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString("en-CA", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}
