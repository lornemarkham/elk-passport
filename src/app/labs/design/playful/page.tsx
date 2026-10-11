import Link from "next/link";
import type { Metadata } from "next";
import { gallery, type Subject } from "@/lib/design-lab/sample";
import { LabNote } from "@/components/design-lab/LabNote";
import { colourOf } from "@/components/design-lab/playfulPalette";

/**
 * Always read the live corpus. A prototype prerendered at build time is a
 * prototype showing whatever Atlas happened to hold that afternoon, which is
 * the opposite of what this sandbox is for.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Playful — design lab" };

/**
 * **DIRECTION THREE — PLAYFUL.**
 *
 * The premise: a Saturday morning with a four-year-old in the car. The page
 * opens with **what you could do**, in large friendly blocks, and the places
 * are what you find once you have picked a verb.
 *
 * ## What makes it this and not the others
 *
 * - **Verb-first, not subject-first.** The other two lead with a beautiful
 *   photograph of a thing. This leads with *Swimming*, *Hiking*, *Playground*
 *   — the one direction whose structure is a different question, not a
 *   different skin.
 * - **Flat colour blocks.** Saturated but muted — pine, lake, clay, plum —
 *   assigned by hashing Atlas's own affordance string, so a verb keeps the
 *   same colour everywhere without Passport maintaining a list of verbs.
 * - **Chunky geometry.** 28px radii, thick 3px borders, a hard offset shadow
 *   instead of a blur. Cards sit on the page like objects.
 * - **Grotesk, not serif.** Heavy Jakarta throughout; this is the only
 *   direction that does not use the display serif.
 *
 * ## Not childish
 *
 * No cartoon illustration, no emoji, no bouncing. The warmth comes from
 * colour, weight and radius — and the photographs are the real ones, at full
 * saturation, doing the grown-up work.
 */
export default async function PlayfulHome() {
  const { featured, rest, total } = await gallery();

  // Group the real subjects by Atlas's own verbs. No taxonomy: the label is
  // the affordance string, exactly as Atlas states it.
  const byDoing = new Map<string, Subject[]>();
  for (const subject of featured) {
    for (const doing of subject.doing) {
      const key = doing.toLowerCase();
      if (!byDoing.has(key)) byDoing.set(key, []);
      byDoing.get(key)!.push(subject);
    }
  }
  const verbs = [...byDoing.entries()]
    .map(([key, subjects]) => ({
      label: subjects[0]!.doing.find((d) => d.toLowerCase() === key) ?? key,
      subjects,
    }))
    .sort((a, b) => b.subjects.length - a.subjects.length)
    .slice(0, 6);

  return (
    <main className="min-h-screen bg-[#fff6e9] text-[#1f1a16]">
      <LabNote direction="playful" />

      <header className="mx-auto max-w-[1180px] px-5 pt-10 sm:px-10 sm:pt-14">
        <h1 className="font-sans text-[2.6rem] leading-[0.98] font-extrabold tracking-[-0.035em] text-balance sm:text-[4rem]">
          What do you feel
          <br />
          like doing?
        </h1>
        <p className="mt-3 max-w-[46ch] text-[15px] leading-relaxed text-[#1f1a16]/65">
          {total.toLocaleString("en-CA")} real places and happenings around the
          Okanagan. Pick a thing to do — the places follow.
        </p>
      </header>

      <section className="mx-auto max-w-[1180px] px-5 pt-8 sm:px-10">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
          {verbs.map((verb) => (
            <VerbBlock
              key={verb.label}
              label={verb.label}
              count={verb.subjects.length}
            />
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-[1180px] px-5 py-14 sm:px-10 sm:py-20">
        {/* **Not "near you".** This prototype has no location and is not
            going to imply one for atmosphere. */}
        <h2 className="font-sans text-2xl font-extrabold tracking-[-0.02em] sm:text-3xl">
          Real places, with photographs
        </h2>
        <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {featured.map((subject) => (
            <Chunk key={subject.id} subject={subject} />
          ))}
        </div>

        {rest.length > 0 && (
          <>
            <h2 className="mt-14 font-sans text-2xl font-extrabold tracking-[-0.02em]">
              No photo yet
            </h2>
            <p className="mt-1 text-[14px] text-[#1f1a16]/55">
              Passport will not borrow one. These are real too.
            </p>
            <ul className="mt-4 flex flex-wrap gap-2">
              {rest.map((subject) => (
                <li key={subject.id}>
                  <Link
                    href={`/labs/design/playful/${subject.id}`}
                    className="inline-flex min-h-11 items-center rounded-2xl border-[2.5px] border-[#1f1a16]/15 bg-white px-4 text-[14px] font-semibold transition-colors hover:border-[#1f1a16]/40"
                  >
                    {subject.title}
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </main>
  );
}

function VerbBlock({
  label,
  count,
}: {
  readonly label: string;
  readonly count: number;
}) {
  const colour = colourOf(label);
  return (
    <div
      data-testid="playful-verb"
      style={{ backgroundColor: colour.bg, color: colour.ink }}
      className="flex min-h-[112px] flex-col justify-between rounded-[26px] p-4 sm:min-h-[132px] sm:p-5"
    >
      <span className="text-[1.3rem] leading-[1.05] font-extrabold tracking-[-0.02em] first-letter:uppercase sm:text-[1.7rem]">
        {label}
      </span>
      <span className="text-[12px] font-semibold tabular-nums opacity-70">
        {count} {count === 1 ? "place" : "places"}
      </span>
    </div>
  );
}

function Chunk({ subject }: { readonly subject: Subject }) {
  const colour = subject.doing[0]
    ? colourOf(subject.doing[0])
    : { bg: "#1f1a16", ink: "#fff6e9" };
  return (
    <Link
      href={`/labs/design/playful/${subject.id}`}
      data-testid="playful-chunk"
      className="group flex flex-col overflow-hidden rounded-[26px] border-[3px] border-[#1f1a16] bg-white shadow-[5px_6px_0_0_#1f1a16] transition-transform hover:-translate-y-1"
    >
      {subject.heroUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- Atlas-hosted
        <img
          src={subject.heroUrl}
          alt=""
          className="aspect-[5/3] w-full border-b-[3px] border-[#1f1a16] object-cover"
        />
      )}
      <div className="flex flex-1 flex-col p-4">
        {subject.doing[0] && (
          <span
            style={{ backgroundColor: colour.bg, color: colour.ink }}
            className="mb-2 inline-flex w-fit rounded-full px-2.5 py-1 text-[11px] font-bold first-letter:uppercase"
          >
            {subject.doing[0]}
          </span>
        )}
        <h3 className="font-sans text-[1.15rem] leading-tight font-extrabold tracking-[-0.015em] text-balance">
          {subject.title}
        </h3>
        {(subject.place ?? subject.area) && (
          <p className="mt-1 text-[13px] font-semibold text-[#1f1a16]/50">
            {subject.place ?? subject.area}
          </p>
        )}
        {subject.blurb && (
          <p className="mt-2 line-clamp-3 text-[13.5px] leading-[1.55] text-[#1f1a16]/70">
            {subject.blurb}
          </p>
        )}
      </div>
    </Link>
  );
}
