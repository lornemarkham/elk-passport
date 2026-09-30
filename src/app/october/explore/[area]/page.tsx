import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { discoveryCandidates } from "@/lib/data/atlas-repo";
import { candidateToExperience } from "@/domain/experience/atlasMapper";
import { destinationFor } from "@/domain/experience/destination";
import { formatEventWhen } from "@/domain/experience/eventTime";
import { OCTOBER_AREAS, areaById, throughLens } from "@/domain/october/areas";
import { Card, Honesty, Nothing } from "@/components/october/shell/atoms";
import { keptOnThisPage } from "@/lib/october/keptOnThisPage";
import { keepFor } from "@/components/october/save/keepFor";

/** Every area has a door, including the ones with nothing behind them yet. */
export function generateStaticParams() {
  return OCTOBER_AREAS.filter((a) => !a.href).map((a) => ({ area: a.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ area: string }>;
}): Promise<Metadata> {
  const { area } = await params;
  const found = areaById(area);
  return { title: found ? `${found.label} — October` : "October" };
}

/**
 * **One area of October.**
 *
 * The smallest thing that makes the navigation walkable: a real destination
 * per area, showing whatever is genuinely behind it.
 *
 * Three outcomes, and each is told plainly rather than dressed up:
 *
 * - the corpus has things that match, and they are shown, with the caveat that
 *   a keyword lens found them rather than anyone curating them;
 * - the area is real but nothing matches, which is said;
 * - the area does not exist yet, which is *also* said, in its own words.
 *
 * This is explicitly not eight products. It is eight doors that open, so the
 * shape of October can be walked before any of it is built, and so a new idea
 * can be placed — is it a thing, a surface, a moment, a scene — against
 * something real.
 */
export default async function OctoberAreaPage({
  params,
}: {
  params: Promise<{ area: string }>;
}) {
  const { area: id } = await params;
  const area = areaById(id);
  if (!area || area.href) notFound();

  // A lens over an empty corpus and a lens over an unanswered one look the
  // same here, and this surface already says a keyword lens found whatever it
  // shows — so it takes the candidates and leaves the admission to the two
  // lanes that lead with it.
  const [{ candidates }, page] = await Promise.all([
    area.terms?.length ? discoveryCandidates() : { candidates: [] },
    // One read for the area, not one per card.
    keptOnThisPage(),
  ]);
  const found = throughLens(candidates.map(candidateToExperience), area, 24);

  return (
    <main className="mx-auto max-w-5xl px-4 pt-10 pb-24 sm:px-6">
      <Link
        href="/october"
        className="text-sm text-[#e9e6da]/40 underline-offset-4 hover:text-[#e9e6da]/70 hover:underline"
      >
        ← October
      </Link>

      <header className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2">
        <h1 className="font-heading text-4xl tracking-tight text-[#f3efe4] sm:text-5xl">
          {area.label}
        </h1>
        <Honesty status={area.status} />
      </header>
      <p className="mt-3 max-w-xl text-[#e9e6da]/50">{area.line}</p>

      <div className="mt-10">
        {area.status === "later" ? (
          <Nothing>{area.nothingYet}</Nothing>
        ) : found.length > 0 ? (
          <>
            {area.status === "prototype" ? (
              <p className="mb-5 max-w-xl text-sm text-[#e9e6da]/35">
                Found by matching words against what Atlas already publishes —
                real entities, but nobody has curated this list.
              </p>
            ) : null}
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {found.map((e) => (
                <li key={e.id}>
                  <Card
                    keep={keepFor(e, page, `/october/explore/${area.id}`)}
                    href={destinationFor(e)}
                    eyebrow={
                      formatEventWhen(
                        e.startTime,
                        e.endTime,
                        e.timePrecision,
                      ) ?? e.subtype
                    }
                    title={e.title}
                    line={e.shortDescription}
                    media={
                      e.heroMedia
                        ? { src: e.heroMedia.src, alt: e.heroMedia.alt ?? "" }
                        : undefined
                    }
                  />
                </li>
              ))}
            </ul>
          </>
        ) : (
          <Nothing>
            Nothing in the corpus matches this yet. Atlas has not been taught
            about October, and it should not be — this is Passport&apos;s
            question to answer.
          </Nothing>
        )}
      </div>
    </main>
  );
}
