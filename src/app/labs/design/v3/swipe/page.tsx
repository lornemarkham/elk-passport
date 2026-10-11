import Link from "next/link";
import type { Metadata } from "next";
import { gallery, themes, type Subject } from "@/lib/design-lab/sample";
import { LabNote } from "@/components/design-lab/LabNote";
import { Plate, Shelf } from "@/components/design-lab/white";

export const metadata: Metadata = { title: "Swipe & Discover — design lab" };
export const dynamic = "force-dynamic";

/**
 * **ROUND THREE, DIRECTION TWO — SWIPE & DISCOVER.**
 *
 * The whole page is shelves. Not a feed with a rail in it — there is no
 * vertical list here at all, and every photograph is reached by moving
 * sideways. Pure white, so the only colour on the screen is the Okanagan.
 *
 * ## How it differs from round two's Immersive Explorer
 *
 * That was rails of a *verb* on near-black with deliberately unequal tiles.
 * This is rails of a **theme** on white, with cards that nearly fill the
 * viewport and the next one visibly peeking — the shelf is the object, not a
 * strip of thumbnails. Proportions vary per shelf rather than per tile, so
 * each row has its own shape: a 3:2 row reads as landscape, a 4:5 row as
 * portrait, and you feel the change as you move down.
 *
 * ## Themes are evidence, not categories
 *
 * Each shelf states what makes its contents belong together — *"Atlas states
 * the setting is outdoor"* — and a theme with fewer than three or four real
 * subjects is simply absent rather than padded. **A subject appears in at most
 * one shelf**, so no row is filled with what the row above already showed.
 *
 * *Nearby* is not among them. It needs the reader's position, which this
 * server-rendered prototype does not have, and a shelf called Nearby filled
 * with the corpus's usual suspects would be the fabrication this round is
 * least able to afford. The real product asks for location first.
 */
export default async function SwipeAndDiscover() {
  // Deep enough that the specific themes have something to claim: the
  // substance ranking puts photographed places with affordances first, and a
  // dated event rarely has either.
  const { featured, rest, total } = await gallery(60);
  const [lead] = featured;
  // The hero is already on the page; it must not reappear in a shelf below it.
  const shelves = themes(featured, new Date(), lead ? [lead.id] : []);

  const href = (subject: Subject) => `/labs/design/v3/swipe/${subject.id}`;

  return (
    <main className="min-h-screen bg-white text-black">
      <LabNote direction="swipe & discover" />

      <header className="mx-auto max-w-[1680px] px-5 pt-8 sm:px-10 sm:pt-14">
        <h1 className="max-w-[18ch] text-[34px] leading-[0.98] font-bold tracking-[-0.04em] text-balance sm:text-[64px]">
          Swipe through the valley
        </h1>
        <p className="mt-3 max-w-[52ch] text-[15px] leading-relaxed text-black/50 sm:text-[17px]">
          {total.toLocaleString("en-CA")} real places and happenings. Every row
          below says what makes its contents belong together.
        </p>
      </header>

      {lead && (
        <section className="mt-7 sm:mt-12">
          <div className="mx-auto max-w-[1680px] px-0 sm:px-10">
            <Plate subject={lead} href={href(lead)} ratio="21/9" size="hero" />
          </div>
        </section>
      )}

      <div className="mt-10 flex flex-col gap-12 pb-6 sm:mt-16 sm:gap-20">
        {shelves.map((theme, index) => (
          <section
            key={theme.key}
            data-testid="swipe-shelf"
            data-theme={theme.key}
          >
            <div className="mx-auto max-w-[1680px] px-5 sm:px-10">
              <h2 className="text-[26px] font-bold tracking-[-0.035em] text-balance sm:text-[44px]">
                {theme.title}
              </h2>
              {/* The basis, said plainly. A theme that cannot say why its
                  contents belong together is a category, and a category is
                  what this round is trying not to be. */}
              <p className="mt-1 text-[13px] text-black/40 sm:text-[14px]">
                {theme.basis} · {theme.subjects.length}
              </p>
            </div>
            <div className="mt-4 sm:mt-6">
              <Shelf
                subjects={theme.subjects}
                href={href}
                // Each shelf its own proportion, so moving down the page
                // changes shape as well as subject.
                ratio={["3/2", "4/5", "1/1", "3/4"][index % 4]!}
                wide={index === 0}
              />
            </div>
          </section>
        ))}
      </div>

      {rest.length > 0 && (
        <section className="mx-auto max-w-[1680px] px-5 pt-8 pb-20 sm:px-10">
          <h2 className="text-[13px] font-semibold tracking-[0.1em] text-black/35 uppercase">
            Known, not photographed
          </h2>
          <ul className="mt-4 flex flex-wrap gap-x-8 gap-y-2">
            {rest.slice(0, 16).map((subject) => (
              <li key={subject.id}>
                <Link
                  href={href(subject)}
                  className="text-[17px] font-semibold tracking-[-0.015em] text-black/45 hover:text-black"
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
