import Link from "next/link";
import type { Metadata } from "next";
import { gallery, type Subject } from "@/lib/design-lab/sample";
import { LabNote } from "@/components/design-lab/LabNote";

/**
 * Always read the live corpus. A prototype prerendered at build time is a
 * prototype showing whatever Atlas happened to hold that afternoon, which is
 * the opposite of what this sandbox is for.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Editorial — design lab" };

/**
 * **DIRECTION ONE — EDITORIAL.**
 *
 * The premise: a thing worth doing deserves to be *published*, not listed. So
 * there is no card grid here at all. There is a masthead, a lead story that
 * takes the full measure of the page, a numbered run of features in an
 * asymmetric two-column rhythm, and an index at the end for everything the
 * corpus holds without a photograph.
 *
 * ## What makes it this and not the others
 *
 * - **Paper, not screen.** Warm white ground, hairline rules, ink-black text.
 * - **Display type does the work.** Fraunces at 56–88px, tight leading,
 *   negative tracking. The accent is a single ochre, spent on rules and
 *   numerals, never on a button that shouts.
 * - **Asymmetry.** Features alternate sides; the image column is wider than
 *   the text column, which is held near 60 characters.
 * - **Metadata is small-caps, not chips.** A place and a verb are a byline,
 *   not a filter control.
 *
 * ## Honesty
 *
 * Every word on this page is Atlas's. A feature with no photograph is not
 * given a grey box — it goes in the index, which is the editorial answer to
 * "four subjects in five have no picture".
 */
export default async function EditorialHome() {
  const { featured, rest, total } = await gallery();
  const [lead, ...features] = featured;

  return (
    <main className="min-h-screen bg-[#fbfaf7] text-[#15130f]">
      <LabNote direction="editorial" />

      <header className="mx-auto max-w-[1180px] px-5 pt-10 sm:px-10 sm:pt-16">
        <div className="flex items-baseline justify-between border-b-2 border-[#15130f] pb-4">
          <p className="font-heading text-2xl tracking-[-0.02em] sm:text-3xl">
            Passport
          </p>
          <p className="text-[10px] tracking-[0.22em] text-[#15130f]/55 uppercase">
            The Okanagan · Saturday
          </p>
        </div>
      </header>

      {lead && <Lead subject={lead} />}

      <section className="mx-auto max-w-[1180px] px-5 pb-24 sm:px-10">
        <div className="mt-16 flex items-center gap-4 sm:mt-24">
          <h2 className="font-heading text-xl tracking-[-0.01em] sm:text-2xl">
            Worth the drive
          </h2>
          <span className="h-px flex-1 bg-[#15130f]/20" />
        </div>

        <div className="mt-8 flex flex-col gap-16 sm:gap-24">
          {features.map((subject, index) => (
            <Feature
              key={subject.id}
              subject={subject}
              index={index + 1}
              flip={index % 2 === 1}
            />
          ))}
        </div>

        <Index subjects={rest} total={total} />
      </section>
    </main>
  );
}

function Lead({ subject }: { readonly subject: Subject }) {
  return (
    <article className="mx-auto mt-10 max-w-[1180px] px-5 sm:px-10">
      <Link
        href={`/labs/design/editorial/${subject.id}`}
        className="group block"
      >
        {subject.heroUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- Atlas-hosted
          <img
            src={subject.heroUrl}
            alt=""
            className="aspect-[3/2] w-full object-cover sm:aspect-[21/9]"
          />
        )}
        <div className="mt-7 grid gap-6 sm:grid-cols-[1.15fr_1fr] sm:gap-14">
          <h1 className="font-heading text-[2.6rem] leading-[0.95] tracking-[-0.035em] text-balance sm:text-[4.4rem]">
            {subject.title}
          </h1>
          <div>
            <Byline subject={subject} />
            {subject.blurb && (
              <p className="mt-3 max-w-[60ch] text-[15px] leading-[1.65] text-[#15130f]/75 first-letter:float-left first-letter:mt-1 first-letter:mr-2 first-letter:text-[3.2rem] first-letter:leading-[0.8] first-letter:font-[var(--font-fraunces)]">
                {subject.blurb}
              </p>
            )}
            <span className="mt-5 inline-block border-b border-[#a9681f] pb-0.5 text-[11px] tracking-[0.18em] text-[#a9681f] uppercase transition-colors group-hover:border-[#15130f] group-hover:text-[#15130f]">
              Read the place
            </span>
          </div>
        </div>
      </Link>
    </article>
  );
}

function Feature({
  subject,
  index,
  flip,
}: {
  readonly subject: Subject;
  readonly index: number;
  readonly flip: boolean;
}) {
  return (
    <article
      data-testid="editorial-feature"
      className={`grid items-center gap-6 sm:grid-cols-[1.25fr_1fr] sm:gap-14 ${
        flip ? "sm:[&>a]:order-2" : ""
      }`}
    >
      <Link
        href={`/labs/design/editorial/${subject.id}`}
        className="group block"
      >
        {subject.heroUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- Atlas-hosted
          <img
            src={subject.heroUrl}
            alt=""
            className="aspect-[4/3] w-full object-cover grayscale-[0.12] transition-all duration-500 group-hover:grayscale-0"
          />
        )}
      </Link>
      <div>
        <p className="font-heading text-[2.6rem] leading-none text-[#a9681f]/35 tabular-nums">
          {String(index).padStart(2, "0")}
        </p>
        <h3 className="font-heading mt-1 text-[1.9rem] leading-[1.03] tracking-[-0.025em] text-balance sm:text-[2.3rem]">
          <Link href={`/labs/design/editorial/${subject.id}`}>
            {subject.title}
          </Link>
        </h3>
        <Byline subject={subject} />
        {subject.blurb && (
          <p className="mt-3 max-w-[58ch] text-[14.5px] leading-[1.65] text-[#15130f]/70">
            {subject.blurb}
          </p>
        )}
      </div>
    </article>
  );
}

/** Place and verbs as a byline — small caps, not controls. */
function Byline({ subject }: { readonly subject: Subject }) {
  const parts = [subject.place ?? subject.area, ...subject.doing.slice(0, 3)];
  const said = parts.filter(Boolean).join(" · ");
  if (!said) return null;
  return (
    <p className="mt-2 text-[10.5px] tracking-[0.2em] text-[#15130f]/50 uppercase">
      {said}
    </p>
  );
}

/**
 * The index: everything Atlas holds that has no photograph.
 *
 * A magazine's back pages. It is the editorial answer to a real corpus fact —
 * four subjects in five have no image Atlas will vouch for — and it treats
 * them as listings rather than as broken cards.
 */
function Index({
  subjects,
  total,
}: {
  readonly subjects: readonly Subject[];
  readonly total: number;
}) {
  if (subjects.length === 0) return null;
  return (
    <section className="mt-20 border-t-2 border-[#15130f] pt-6 sm:mt-28">
      <div className="flex items-baseline justify-between">
        <h2 className="font-heading text-xl tracking-[-0.01em]">Also listed</h2>
        <p className="text-[10px] tracking-[0.2em] text-[#15130f]/45 uppercase tabular-nums">
          {total.toLocaleString("en-CA")} in the region
        </p>
      </div>
      <ul className="mt-5 columns-1 gap-10 sm:columns-2 lg:columns-3">
        {subjects.map((subject) => (
          <li
            key={subject.id}
            className="mb-3 break-inside-avoid border-b border-[#15130f]/10 pb-3"
          >
            <Link
              href={`/labs/design/editorial/${subject.id}`}
              className="text-[15px] leading-snug hover:text-[#a9681f]"
            >
              {subject.title}
            </Link>
            {(subject.place ?? subject.area) && (
              <span className="block text-[10.5px] tracking-[0.16em] text-[#15130f]/45 uppercase">
                {subject.place ?? subject.area}
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
