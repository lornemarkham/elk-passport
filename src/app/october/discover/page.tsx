import type { Metadata } from "next";
import Link from "next/link";
import { listDiscoveryCandidates } from "@/lib/data/atlas-repo";
import { candidateToExperience } from "@/domain/experience/atlasMapper";
import { destinationFor } from "@/domain/experience/destination";
import { formatEventWhen } from "@/domain/experience/eventTime";
import type { Experience } from "@/domain/experience/types";
import { happeningWithin, localDay, upcoming } from "@/domain/october/calendar";
import {
  OCTOBER_AREAS,
  hrefForArea,
  throughLens,
} from "@/domain/october/areas";
import {
  collectionBySlug,
  resolveCollection,
} from "@/domain/collections/editorial";
import { Card, Nothing, Section } from "@/components/october/shell/atoms";

export const metadata: Metadata = {
  title: "Discover — October",
};

/**
 * **Discover, from October's side of the door.**
 *
 * Passport already has a Discovery product at `/discovery`: a list optimised
 * for finding and saving quickly, with scope, search and filters. This is not
 * a replacement for it and deliberately does not rebuild any of it. It is a
 * *composition* — the same Atlas read, arranged by the questions October makes
 * a person ask, with a plain door through to the full list for everything
 * else.
 *
 * The groupings are Passport's, not Atlas's. Atlas holds no notion of October
 * and is not being taught one.
 *
 * ## Two different kinds of section, and the difference matters
 *
 * Where an area names an **editorial collection**, that stated membership is
 * authoritative: a human decided those Things belong, and the keyword lens has
 * no vote. Everywhere else the lens still runs, and those sections say that
 * they were found by matching words.
 *
 * The lens is not being tuned away — it is being demoted. It found *Caravan
 * Farm Theatre* and missed *The Fall of the House of Usher*, the production
 * Caravan was staging, because nothing in Poe's title says Halloween. That is
 * not a threshold to adjust; it is the wrong question. The lens remains useful
 * for finding candidates a curator might not have thought of, which is exactly
 * what it is still doing below.
 */
export default async function OctoberDiscoverPage() {
  const now = new Date();
  const candidates = await listDiscoveryCandidates().catch(() => []);
  const experiences = candidates.map(candidateToExperience);

  // Stated membership, resolved live against Atlas. Nothing about these Things
  // is stored by Passport beyond which ones belong.
  const curated = OCTOBER_AREAS.flatMap((area) => {
    const collection = area.collectionSlug
      ? collectionBySlug(area.collectionSlug)
      : undefined;
    if (!collection) return [];
    return [{ area, ...resolveCollection(collection, experiences) }];
  });

  // Anything a human has already placed is spoken for, so the inferred
  // sections below cannot list it a second time under a different heading.
  const spokenFor = new Set(curated.flatMap((c) => c.members.map((m) => m.id)));
  const free = (list: readonly Experience[]) =>
    list.filter((e) => !spokenFor.has(e.id));

  const dated = free(upcoming(experiences, now)).slice(0, 6);
  // The whole month, from whatever evidence each Thing has: an Event's own
  // interval, or the days a source named for a claim-bearing subject. The year
  // is today's in the Okanagan, because this is October's own surface.
  const october = free(
    happeningWithin(
      experiences,
      `${localDay(now).slice(0, 4)}-10-01`,
      `${localDay(now).slice(0, 4)}-10-31`,
    ),
  );
  const lensed = OCTOBER_AREAS.filter(
    (a) => a.terms?.length && !a.collectionSlug,
  ).map((area) => ({
    area,
    found: free(throughLens(experiences, area, 12)).slice(0, 6),
  }));

  return (
    <main className="mx-auto max-w-5xl px-4 pt-10 pb-24 sm:px-6">
      <header>
        <h1 className="font-heading text-4xl tracking-tight text-[#f3efe4] sm:text-5xl">
          Discover
        </h1>
        <p className="mt-3 max-w-xl text-[#e9e6da]/50">
          What is out there — {experiences.length.toLocaleString()} places,
          organizations, activities and events Passport can currently see in the
          Okanagan.
        </p>
      </header>

      <div className="mt-12">
        {curated.map(({ area, members }) => (
          <Section
            key={area.id}
            title={area.label}
            note={area.line}
            action={
              <Link
                href={hrefForArea(area)}
                className="text-sm text-[#e9e6da]/45 underline-offset-4 hover:text-[#e9e6da]/75 hover:underline"
              >
                More
              </Link>
            }
          >
            {members.length > 0 ? (
              <ul
                data-testid={`collection-${area.collectionSlug}`}
                className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
              >
                {members.map((e) => (
                  <li key={e.id}>
                    <Card
                      href={destinationFor(e)}
                      eyebrow={
                        formatEventWhen(e.startTime, e.endTime) ?? e.subtype
                      }
                      title={e.title}
                      line={e.shortDescription}
                      media={hero(e)}
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <Nothing>Nothing is in this collection yet.</Nothing>
            )}
          </Section>
        ))}

        <Section
          title="Dated and coming"
          note="Events with a real date on them, soonest first."
          action={
            <Link
              href="/discovery"
              className="text-sm text-[#e9e6da]/45 underline-offset-4 hover:text-[#e9e6da]/75 hover:underline"
            >
              Full discovery
            </Link>
          }
        >
          {dated.length > 0 ? (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {dated.map((e) => (
                <li key={e.id}>
                  <Card
                    href={destinationFor(e)}
                    eyebrow={formatEventWhen(e.startTime, e.endTime)}
                    title={e.title}
                    line={e.shortDescription}
                    media={hero(e)}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <Nothing>Nothing dated is ahead of us right now.</Nothing>
          )}
        </Section>

        <Section
          title="All of October"
          note="Everything Atlas can date inside the month — an event's own dates, or the nights a place named."
        >
          {october.length > 0 ? (
            <ul
              data-testid="all-october"
              className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
            >
              {october.map((e) => (
                <li key={e.id}>
                  <Card
                    href={destinationFor(e)}
                    eyebrow={
                      formatEventWhen(e.startTime, e.endTime) ??
                      statedDaysLine(e)
                    }
                    title={e.title}
                    line={e.shortDescription}
                    media={hero(e)}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <Nothing>Atlas can date nothing inside October yet.</Nothing>
          )}
        </Section>

        {lensed.map(({ area, found }) => (
          <Section
            key={area.id}
            title={area.label}
            note={area.line}
            action={
              <Link
                href={hrefForArea(area)}
                className="text-sm text-[#e9e6da]/45 underline-offset-4 hover:text-[#e9e6da]/75 hover:underline"
              >
                More
              </Link>
            }
          >
            {found.length > 0 ? (
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {found.map((e) => (
                  <li key={e.id}>
                    <Card
                      href={destinationFor(e)}
                      eyebrow={e.subtype}
                      title={e.title}
                      line={e.shortDescription}
                      media={hero(e)}
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <Nothing>Nothing in the corpus matches this yet.</Nothing>
            )}
          </Section>
        ))}
      </div>
    </main>
  );
}

/**
 * How many days a source named, said plainly. Never a range: the eight nights
 * of a haunt are eight nights, and printing "Oct 16 – Oct 31" would claim the
 * fifteen days between them.
 */
function statedDaysLine(e: Experience): string | undefined {
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

const hero = (e: Experience) =>
  e.heroMedia
    ? { src: e.heroMedia.src, alt: e.heroMedia.alt ?? "" }
    : undefined;
