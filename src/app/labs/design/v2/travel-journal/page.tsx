import Link from "next/link";
import type { Metadata } from "next";
import { byDoing, gallery, type Subject } from "@/lib/design-lab/sample";
import { LabNote } from "@/components/design-lab/LabNote";

export const metadata: Metadata = { title: "Travel Journal — design lab" };
export const dynamic = "force-dynamic";

/**
 * **ROUND TWO, DIRECTION THREE — MODERN TRAVEL JOURNAL.**
 *
 * The premise: somebody who knows the valley kept a beautifully designed
 * notebook, and you are turning its pages. Warm, personal, and much less
 * formal than Editorial — but designed, not scrapbooked.
 *
 * ## What makes it this and not the others
 *
 * - **Entries, not cards.** Each subject is a numbered entry with a rule above
 *   it and the photograph set *inset* from the text column — the way a plate
 *   sits in a book — rather than filling a tile.
 * - **A margin that talks.** On a wide screen a left rail carries the entry
 *   number, the town and the verbs as marginalia. On a phone it folds above
 *   the entry. Round one's directions had no margin at all.
 * - **Italic serif voice.** Fraunces italic for the framing lines, which is a
 *   register none of the other five use. The warmth is typographic, not
 *   decorative.
 * - **Cream and ink, one green.** `#f6f1e6` ground, `#2a2620` ink, a single
 *   moss accent. No shadow, no border, no radius — the feedback from round one.
 *
 * ## Exploring activities, and missing photographs
 *
 * The **contents list** at the top is the activity explorer: Atlas's verbs with
 * counts, set as a table of contents. Entries without a photograph are still
 * entries — they simply have no plate, which is what a real notebook looks
 * like, and the page does not pretend otherwise.
 */
export default async function TravelJournal() {
  const { featured, rest, total } = await gallery(16);
  const contents = byDoing(featured, 2).slice(0, 6);
  // Photographed entries first, then the unphotographed — same page, same
  // treatment, one without a plate.
  const entries = [...featured.slice(0, 9), ...rest.slice(0, 4)];

  return (
    <main className="min-h-screen bg-[#f6f1e6] text-[#2a2620]">
      <LabNote direction="travel journal" />

      <header className="mx-auto max-w-[1080px] px-5 pt-10 sm:px-10 sm:pt-16">
        <p className="text-[10px] tracking-[0.26em] text-[#2a2620]/45 uppercase">
          Passport · a notebook from the Okanagan
        </p>
        <h1 className="font-heading mt-4 max-w-[17ch] text-[2.5rem] leading-[1] tracking-[-0.03em] text-balance sm:text-[3.8rem]">
          Places worth
          <em className="text-[#4f6b3f] italic"> going out of your way </em>
          for
        </h1>
        <p className="font-heading mt-4 max-w-[52ch] text-[1.05rem] leading-[1.6] text-[#2a2620]/60 italic sm:text-[1.2rem]">
          {total.toLocaleString("en-CA")} real places and happenings, as Atlas
          knows them. Nothing here is invented — where it says nothing, it knows
          nothing.
        </p>

        {/* The contents list is the activity explorer. */}
        {contents.length > 0 && (
          <nav className="mt-9 border-t border-[#2a2620]/20 pt-5">
            <p className="text-[10px] tracking-[0.22em] text-[#2a2620]/45 uppercase">
              In this notebook
            </p>
            <ul className="mt-3 flex flex-col">
              {contents.map((item) => (
                <li
                  key={item.label}
                  data-testid="journal-contents"
                  className="flex items-baseline gap-3 border-b border-[#2a2620]/10 py-2"
                >
                  <span className="font-heading text-[1.05rem] first-letter:uppercase sm:text-[1.2rem]">
                    {item.label}
                  </span>
                  <span className="h-px flex-1 border-b border-dotted border-[#2a2620]/25" />
                  <span className="text-[12px] text-[#2a2620]/50 tabular-nums">
                    {item.subjects.length}
                  </span>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </header>

      <section className="mx-auto max-w-[1080px] px-5 pt-14 pb-24 sm:px-10 sm:pt-20">
        {entries.map((entry, index) => (
          <Entry key={entry.id} subject={entry} number={index + 1} />
        ))}
      </section>
    </main>
  );
}

/**
 * One entry: a margin, a heading, a plate where there is one.
 *
 * The photograph is inset from the text column rather than bled to the edge —
 * the opposite of Immersive Explorer, on purpose. A plate in a book.
 */
function Entry({
  subject,
  number,
}: {
  readonly subject: Subject;
  readonly number: number;
}) {
  return (
    <article
      data-testid="journal-entry"
      className="grid gap-x-10 gap-y-3 border-t border-[#2a2620]/18 py-8 sm:grid-cols-[150px_1fr] sm:py-11"
    >
      {/* Marginalia. Beside the entry on a wide screen, above it on a phone. */}
      <aside className="flex items-baseline gap-3 sm:block">
        <span className="font-heading text-[1.4rem] text-[#4f6b3f] tabular-nums sm:text-[1.8rem]">
          {String(number).padStart(2, "0")}
        </span>
        {(subject.place ?? subject.area) && (
          <span className="text-[10.5px] tracking-[0.18em] text-[#2a2620]/50 uppercase sm:mt-2 sm:block">
            {subject.place ?? subject.area}
          </span>
        )}
        {subject.doing.length > 0 && (
          <span className="hidden text-[12px] leading-[1.6] text-[#2a2620]/45 italic sm:mt-2 sm:block">
            {subject.doing.slice(0, 3).join(", ")}
          </span>
        )}
      </aside>

      <div>
        <h2 className="font-heading text-[1.7rem] leading-[1.05] tracking-[-0.025em] text-balance sm:text-[2.2rem]">
          <Link
            href={`/labs/design/v2/travel-journal/${subject.id}`}
            className="hover:text-[#4f6b3f]"
          >
            {subject.title}
          </Link>
        </h2>

        {subject.blurb && (
          <p className="mt-3 max-w-[60ch] text-[15px] leading-[1.72] text-[#2a2620]/75">
            {subject.blurb}
          </p>
        )}

        {/* The plate, inset — and simply absent when Atlas has none. */}
        {subject.heroUrl && (
          <Link
            href={`/labs/design/v2/travel-journal/${subject.id}`}
            className="group mt-5 block max-w-[620px]"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- Atlas-hosted */}
            <img
              src={subject.heroUrl}
              alt=""
              className="aspect-[3/2] w-full object-cover transition-opacity group-hover:opacity-90"
            />
            {subject.facts[0] && (
              <span className="mt-2 block max-w-[52ch] text-[11.5px] leading-[1.5] text-[#2a2620]/50 italic">
                {subject.facts[0].label}: {subject.facts[0].value}
              </span>
            )}
          </Link>
        )}

        {/* Verbs read as a sentence on a phone, where the margin has folded. */}
        {subject.doing.length > 0 && (
          <p className="mt-4 text-[12.5px] text-[#2a2620]/50 italic sm:hidden">
            {subject.doing.slice(0, 3).join(", ")}
          </p>
        )}
      </div>
    </article>
  );
}
