import Link from "next/link";
import type { Metadata } from "next";
import { byDoing, gallery, type Subject } from "@/lib/design-lab/sample";
import { LabNote } from "@/components/design-lab/LabNote";

export const metadata: Metadata = { title: "Immersive Explorer — design lab" };
export const dynamic = "force-dynamic";

/**
 * **ROUND TWO, DIRECTION TWO — IMMERSIVE EXPLORER.**
 *
 * The brief was explicit: photography leads, compositions should be
 * interesting, and **avoid the endless vertical wall of photographs**. Round
 * one's Cinematic was exactly that wall — beautiful, and you scrolled past
 * eleven of them to find the twelfth.
 *
 * ## So the page moves sideways
 *
 * Each of Atlas's verbs gets a **horizontal rail**, and the tiles inside a rail
 * are deliberately unequal — the first is tall and wide, the rest are portrait.
 * You travel across an activity rather than down a feed, and the whole set of
 * activities is visible in one screen's height.
 *
 * - **Ink-teal ground** `#0e1a1c`, not black: colder and more alive than round
 *   one's near-black, and it makes the Okanagan's greens and blues sing.
 * - **Rails scroll with snap points**, so a thumb lands on a whole tile.
 * - **No shadows, no borders, no radius above 2px.** The round-one feedback
 *   about heavy black shadows applies doubly on a dark ground, where a shadow
 *   is invisible anyway and only muddies the edge.
 * - **Navigation is one row of verbs at the top**, anchored — the only chrome
 *   on the page, and it says exactly what is below.
 *
 * ## Honesty
 *
 * A subject with no photograph never enters a rail — rails are a photographic
 * device and a grey tile would break the one thing this direction is for. They
 * get a named list at the end instead, and the count is stated.
 */
export default async function ImmersiveExplorer() {
  const { featured, rest, total } = await gallery(30);
  const rails = byDoing(featured, 3).slice(0, 5);
  const [hero] = featured;

  return (
    <main className="min-h-screen bg-[#0e1a1c] text-white">
      <LabNote direction="immersive explorer" tone="dark" />

      {/* One screen of photograph, then the page turns sideways. */}
      {hero && (
        <section className="relative h-[52vh] min-h-[320px] w-full overflow-hidden">
          {hero.heroUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- Atlas-hosted
            <img
              src={hero.heroUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover opacity-70"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0e1a1c] via-[#0e1a1c]/20 to-[#0e1a1c]/40" />
          <div className="absolute inset-x-0 bottom-0 px-5 pb-7 sm:px-10 sm:pb-10">
            <h1 className="font-heading max-w-[16ch] text-[2.4rem] leading-[0.95] tracking-[-0.03em] text-balance sm:text-[4rem]">
              Go and see something
            </h1>
            <p className="mt-2 max-w-[54ch] text-[14px] leading-relaxed text-white/60">
              {total.toLocaleString("en-CA")} real places and happenings around
              the Okanagan. Pick a thing to do and travel across it.
            </p>
          </div>
        </section>
      )}

      {/* The only chrome: the verbs, as anchors. */}
      <nav className="sticky top-0 z-20 -mx-px overflow-x-auto bg-[#0e1a1c]/92 backdrop-blur">
        <ul className="flex min-w-max gap-5 px-5 py-3.5 sm:px-10">
          {rails.map((rail) => (
            <li key={rail.label}>
              <a
                href={`#${slug(rail.label)}`}
                data-testid="explorer-nav"
                className="text-[12.5px] tracking-wide whitespace-nowrap text-white/55 transition-colors first-letter:uppercase hover:text-[#7fe3c4]"
              >
                {rail.label}
                <span className="ml-1.5 text-white/30 tabular-nums">
                  {rail.subjects.length}
                </span>
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="flex flex-col gap-12 py-10 sm:gap-16">
        {rails.map((rail) => (
          <Rail key={rail.label} label={rail.label} subjects={rail.subjects} />
        ))}
      </div>

      {rest.length > 0 && (
        <section className="border-t border-white/10 px-5 py-14 sm:px-10">
          <p className="text-[10px] tracking-[0.28em] text-white/40 uppercase">
            Known, but not photographed
          </p>
          <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2.5">
            {rest.slice(0, 16).map((subject) => (
              <li key={subject.id}>
                <Link
                  href={`/labs/design/v2/immersive-explorer/${subject.id}`}
                  className="text-[14px] text-white/45 transition-colors hover:text-[#7fe3c4]"
                >
                  {subject.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

const slug = (label: string) => label.toLowerCase().replace(/[^a-z0-9]+/g, "-");

/**
 * **A rail, with deliberately unequal tiles.**
 *
 * The lead tile is 2:3 and twice as wide as the portraits that follow it, so
 * the composition has a beat rather than being a row of identical rectangles.
 * Snap points mean a thumb lands on a whole tile.
 */
function Rail({
  label,
  subjects,
}: {
  readonly label: string;
  readonly subjects: readonly Subject[];
}) {
  return (
    <section
      id={slug(label)}
      data-testid="explorer-rail"
      className="scroll-mt-16"
    >
      <div className="flex items-baseline gap-3 px-5 sm:px-10">
        <h2 className="font-heading text-[1.5rem] tracking-[-0.02em] first-letter:uppercase sm:text-[2rem]">
          {label}
        </h2>
        <span className="text-[11px] text-white/35 tabular-nums">
          {subjects.length} places
        </span>
      </div>

      <ul className="mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-2 sm:gap-4 sm:px-10">
        {subjects.map((subject, index) => (
          <li
            key={subject.id}
            className={
              "shrink-0 snap-start " +
              (index === 0 ? "w-[78vw] sm:w-[520px]" : "w-[52vw] sm:w-[260px]")
            }
          >
            <Link
              href={`/labs/design/v2/immersive-explorer/${subject.id}`}
              className="group block"
            >
              <div
                className={
                  "relative overflow-hidden rounded-[2px] " +
                  (index === 0 ? "aspect-[3/2]" : "aspect-[3/4]")
                }
              >
                {subject.heroUrl && (
                  // eslint-disable-next-line @next/next/no-img-element -- Atlas-hosted
                  <img
                    src={subject.heroUrl}
                    alt=""
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.05]"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-3.5">
                  <h3
                    className={
                      "font-heading leading-[1.05] tracking-[-0.02em] text-balance " +
                      (index === 0
                        ? "text-[1.5rem] sm:text-[2rem]"
                        : "text-[1.05rem]")
                    }
                  >
                    {subject.title}
                  </h3>
                  {(subject.place ?? subject.area) && (
                    <p className="mt-1 text-[10px] tracking-[0.18em] text-white/55 uppercase">
                      {subject.place ?? subject.area}
                    </p>
                  )}
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
