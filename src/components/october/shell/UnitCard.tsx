import { destinationFor } from "@/domain/experience/destination";
import { formatEventWhen } from "@/domain/experience/eventTime";
import type { Experience } from "@/domain/experience/types";
import { namesOf, type DiscoveryUnit } from "@/domain/discovery/discoveryUnits";
import { Card } from "./atoms";

/**
 * **One discovery, whether Atlas holds it as one Thing or as an attraction
 * with modes.**
 *
 * The card is the whole, the link goes to the whole — the subject whose
 * composed detail page carries every mode's own prices and hours — and the
 * options are the parts *this lane* actually matched.
 *
 * Lifted out of `/october/discover` so October Home can show the same thing.
 * The two surfaces were never allowed to disagree about what a candidate
 * *means*; before this, Home had no grouping at all and rendered an attraction
 * and its modes as separate cards competing with each other, which made the
 * same Atlas read say two different things depending on which door you came
 * through. Home may show fewer of these, or style them differently. It may not
 * count them differently.
 */
export function UnitCard({
  unit,
  label,
}: {
  readonly unit: DiscoveryUnit;
  readonly label: string;
}) {
  const { head } = unit;
  const when =
    formatEventWhen(head.startTime, head.endTime) ??
    statedDaysLine(head) ??
    (unit.options.length > 0 ? statedDaysLine(unit.options[0]!) : undefined);
  return (
    <Card
      href={destinationFor(head)}
      eyebrow={when}
      title={head.title}
      line={head.shortDescription}
      media={hero(head)}
      options={namesOf(unit)}
      optionsLabel={unit.options.length > 0 ? label : undefined}
    />
  );
}

/**
 * How many days a source named, said plainly. Never a range: the eight nights
 * of a haunt are eight nights, and printing "Oct 16 – Oct 31" would claim the
 * fifteen days between them.
 */
export function statedDaysLine(e: Experience): string | undefined {
  const days = e.availability?.days ?? [];
  if (days.length === 0) return undefined;
  const label = (day: string) =>
    new Date(`${day}T12:00:00Z`).toLocaleDateString("en-CA", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
  return days.length === 1
    ? label(days[0]!)
    : `${days.length} dates · ${label(days[0]!)} to ${label(days[days.length - 1]!)}`;
}

export const hero = (e: Experience) =>
  e.heroMedia
    ? { src: e.heroMedia.src, alt: e.heroMedia.alt ?? "" }
    : undefined;
