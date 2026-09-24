import type { Metadata } from "next";
import Link from "next/link";
import { listDiscoveryCandidates } from "@/lib/data/atlas-repo";
import { candidateToExperience } from "@/domain/experience/atlasMapper";
import { destinationFor } from "@/domain/experience/destination";
import { formatEventWhen } from "@/domain/experience/eventTime";
import type { Experience } from "@/domain/experience/types";
import { upcoming } from "@/domain/october/calendar";
import {
  OCTOBER_AREAS,
  hrefForArea,
  throughLens,
} from "@/domain/october/areas";
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
 * and is not being taught one; the lens that produces "haunts" is keyword
 * matching over names and descriptions Atlas already publishes, which is why
 * the sections that lean on it say so.
 */
export default async function OctoberDiscoverPage() {
  const now = new Date();
  const candidates = await listDiscoveryCandidates().catch(() => []);
  const experiences = candidates.map(candidateToExperience);

  const dated = upcoming(experiences, now).slice(0, 6);
  const lensed = OCTOBER_AREAS.filter((a) => a.terms?.length).map((area) => ({
    area,
    found: throughLens(experiences, area, 6),
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

const hero = (e: Experience) =>
  e.heroMedia
    ? { src: e.heroMedia.src, alt: e.heroMedia.alt ?? "" }
    : undefined;
