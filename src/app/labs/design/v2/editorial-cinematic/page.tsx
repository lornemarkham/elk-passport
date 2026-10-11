import Link from "next/link";
import type { Metadata } from "next";
import { byDoing, gallery, type Subject } from "@/lib/design-lab/sample";
import { LabNote } from "@/components/design-lab/LabNote";

export const metadata: Metadata = { title: "Editorial Cinematic — design lab" };
export const dynamic = "force-dynamic";

/**
 * **ROUND TWO, DIRECTION ONE — EDITORIAL CINEMATIC.**
 *
 * Round one said: the photographs in Cinematic were the best thing, and
 * Editorial felt sophisticated. This is what happens when those are the same
 * design rather than two.
 *
 * ## What it takes from each, and what it refuses
 *
 * - **Cinematic's scale, on a warm ground.** Images run to the edge and past
 *   it, but the page underneath is sandstone `#efe7da`, not black. Warmth is
 *   the whole point of the fusion: Editorial's paper was cold, Cinematic's
 *   black was nocturnal, and the Okanagan is neither.
 * - **Type that overlaps the picture.** The headline sits *on* the image,
 *   pulled up over its lower edge, so the two are one object. Round one kept
 *   them in separate boxes.
 * - **Asymmetry with a held column.** A 7/5 split that reverses down the page;
 *   the text column never exceeds ~58 characters however wide the screen.
 * - **No shadow, no border, no radius.** The round-one feedback was explicit
 *   about heavy black shadows. Separation here comes from the warm ground
 *   showing through, and from space.
 *
 * ## Exploring activities
 *
 * Verbs are **section rules** — Atlas's own words set as a quiet divider with
 * a count, so the page reads as chapters of a magazine rather than as filters.
 */
export default async function EditorialCinematic() {
  const { featured, rest, total } = await gallery(22);
  const [opening, ...body] = featured;
  const chapters = byDoing(featured, 2).slice(0, 4);

  return (
    <main className="min-h-screen bg-[#efe7da] text-[#241d15]">
      <LabNote direction="editorial-cinematic" />

      <header className="mx-auto flex max-w-[1240px] items-baseline justify-between px-5 pt-8 sm:px-10 sm:pt-12">
        <p className="font-heading text-xl tracking-[-0.02em] sm:text-2xl">
          Passport
        </p>
        <p className="text-[10px] tracking-[0.24em] text-[#241d15]/45 uppercase">
          The Okanagan
        </p>
      </header>

      {/* **The opening spread.** Full-bleed photograph, headline lifted over
          its lower edge so the type and the picture are one object. */}
      {opening && (
        <section className="mt-7">
          <Link href={`/labs/design/v2/editorial-cinematic/${opening.id}`}>
            {opening.heroUrl && (
              // eslint-disable-next-line @next/next/no-img-element -- Atlas-hosted
              <img
                src={opening.heroUrl}
                alt=""
                className="h-[46vh] min-h-[280px] w-full object-cover sm:h-[66vh]"
              />
            )}
            <div className="mx-auto -mt-14 max-w-[1240px] px-5 sm:-mt-24 sm:px-10">
              <h1 className="font-heading max-w-[13ch] text-[2.9rem] leading-[0.9] tracking-[-0.035em] text-balance text-[#efe7da] drop-shadow-[0_2px_18px_rgba(20,14,8,0.55)] sm:text-[5.6rem]">
                {opening.title}
              </h1>
            </div>
          </Link>
          <div className="mx-auto mt-6 grid max-w-[1240px] gap-5 px-5 sm:grid-cols-[7fr_5fr] sm:gap-14 sm:px-10">
            <p className="text-[10.5px] tracking-[0.22em] text-[#9a5f1c] uppercase">
              {[opening.place ?? opening.area, ...opening.doing.slice(0, 3)]
                .filter(Boolean)
                .join(" · ")}
            </p>
            {opening.blurb && (
              <p className="max-w-[58ch] text-[15.5px] leading-[1.7] text-[#241d15]/75">
                {opening.blurb}
              </p>
            )}
          </div>
        </section>
      )}

      {/* Chapters, named with Atlas's own verbs. */}
      <section className="mx-auto max-w-[1240px] px-5 pt-16 pb-24 sm:px-10 sm:pt-24">
        {chapters.map((chapter, chapterIndex) => (
          <div
            key={chapter.label}
            className={chapterIndex > 0 ? "mt-20 sm:mt-28" : ""}
          >
            <div className="flex items-baseline gap-5">
              <h2 className="font-heading text-[1.6rem] tracking-[-0.02em] first-letter:uppercase sm:text-[2.1rem]">
                {chapter.label}
              </h2>
              <span className="h-px flex-1 bg-[#241d15]/18" />
              <span className="text-[10px] tracking-[0.2em] text-[#241d15]/40 uppercase tabular-nums">
                {chapter.subjects.length}
              </span>
            </div>

            <div className="mt-7 flex flex-col gap-14 sm:gap-20">
              {chapter.subjects.slice(0, 2).map((subject, index) => (
                <Spread
                  key={subject.id}
                  subject={subject}
                  flip={(chapterIndex + index) % 2 === 1}
                />
              ))}
            </div>
          </div>
        ))}

        {/* Everything else with a photograph, smaller, still unshadowed. */}
        <div className="mt-24 grid grid-cols-2 gap-x-5 gap-y-10 sm:grid-cols-4 sm:gap-x-8">
          {body.slice(6, 14).map((subject) => (
            <Link
              key={subject.id}
              href={`/labs/design/v2/editorial-cinematic/${subject.id}`}
              className="group"
            >
              {subject.heroUrl && (
                // eslint-disable-next-line @next/next/no-img-element -- Atlas-hosted
                <img
                  src={subject.heroUrl}
                  alt=""
                  className="aspect-[4/5] w-full object-cover transition-opacity group-hover:opacity-85"
                />
              )}
              <h3 className="font-heading mt-2.5 text-[1.05rem] leading-tight tracking-[-0.015em] text-balance">
                {subject.title}
              </h3>
              {(subject.place ?? subject.area) && (
                <p className="mt-1 text-[10px] tracking-[0.18em] text-[#241d15]/45 uppercase">
                  {subject.place ?? subject.area}
                </p>
              )}
            </Link>
          ))}
        </div>

        {/* **No photograph is a typographic end-page, not a grey box.** */}
        {rest.length > 0 && (
          <div className="mt-24 border-t border-[#241d15]/20 pt-7">
            <p className="text-[10px] tracking-[0.22em] text-[#241d15]/45 uppercase">
              Also in the region · {total.toLocaleString("en-CA")} known
            </p>
            <ul className="mt-4 flex flex-wrap gap-x-7 gap-y-2">
              {rest.slice(0, 14).map((subject) => (
                <li key={subject.id}>
                  <Link
                    href={`/labs/design/v2/editorial-cinematic/${subject.id}`}
                    className="font-heading text-[1.15rem] tracking-[-0.015em] text-[#241d15]/55 hover:text-[#9a5f1c]"
                  >
                    {subject.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </main>
  );
}

function Spread({
  subject,
  flip,
}: {
  readonly subject: Subject;
  readonly flip: boolean;
}) {
  return (
    <article
      data-testid="ec-spread"
      className={`grid items-end gap-5 sm:gap-12 ${
        flip ? "sm:grid-cols-[5fr_7fr]" : "sm:grid-cols-[7fr_5fr]"
      }`}
    >
      <Link
        href={`/labs/design/v2/editorial-cinematic/${subject.id}`}
        className={`group block ${flip ? "sm:order-2" : ""}`}
      >
        {subject.heroUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- Atlas-hosted
          <img
            src={subject.heroUrl}
            alt=""
            className="aspect-[3/2] w-full object-cover transition-transform duration-700 group-hover:scale-[1.015]"
          />
        )}
      </Link>
      <div className={flip ? "sm:order-1" : ""}>
        <h3 className="font-heading text-[1.8rem] leading-[1.02] tracking-[-0.025em] text-balance sm:text-[2.6rem]">
          <Link href={`/labs/design/v2/editorial-cinematic/${subject.id}`}>
            {subject.title}
          </Link>
        </h3>
        <p className="mt-2 text-[10.5px] tracking-[0.2em] text-[#9a5f1c] uppercase">
          {[subject.place ?? subject.area, ...subject.doing.slice(0, 2)]
            .filter(Boolean)
            .join(" · ")}
        </p>
        {subject.blurb && (
          <p className="mt-3 max-w-[56ch] text-[14.5px] leading-[1.68] text-[#241d15]/70">
            {subject.blurb}
          </p>
        )}
      </div>
    </article>
  );
}
