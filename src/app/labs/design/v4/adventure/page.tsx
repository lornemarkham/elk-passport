import Link from "next/link";
import type { Metadata } from "next";
import {
  byDoing,
  gallery,
  themes,
  type Subject,
} from "@/lib/design-lab/sample";
import { LabNote } from "@/components/design-lab/LabNote";
import { Plate, Shelf } from "@/components/design-lab/white";
import { ACCENT, BrandBar, Wordmark } from "@/components/design-lab/brand";

export const metadata: Metadata = { title: "The Adventure Brand — design lab" };
export const dynamic = "force-dynamic";

/**
 * **ROUND FOUR, DIRECTION ONE — THE ADVENTURE BRAND.**
 *
 * What an outdoor brand's confidence looks like applied to Discovery, without
 * becoming an advertising landing page. The test the brief set is the right
 * one: people must still be able to find things quickly, so the brand gets the
 * first screen and then gets out of the way.
 *
 * ## The structure
 *
 * ```
 * wordmark + one enormous photograph + a statement
 * a row of Atlas's verbs, as links, immediately under it   ← findable fast
 * alternating bands: statement · gallery · statement · gallery
 * ```
 *
 * The statements are the only written copy in the whole round, and they are
 * **about the product, never about a place** — "Two thousand six hundred real
 * places. None of them invented." A line claiming a lake is breathtaking would
 * be the fabrication everything else here is built to avoid.
 *
 * ## Why it is not a magazine and not a brochure
 *
 * No serif, no columns, no pull-quotes, no captions under plates. Statements
 * are set at display size with a rule above them, galleries run edge to edge,
 * and the only colour besides the photographs is one accent on a full stop and
 * a live count.
 */
export default async function AdventureBrand() {
  const { featured, rest, total } = await gallery(48);
  const [opener, ...more] = featured;
  const verbs = byDoing(featured, 3).slice(0, 7);
  const shelves = themes(featured, new Date(), opener ? [opener.id] : []);

  const href = (subject: Subject) => `/labs/design/v4/adventure/${subject.id}`;

  return (
    <main className="min-h-screen bg-white text-black">
      <LabNote direction="the adventure brand" />
      <BrandBar total={total} href="/labs/design/v4/adventure" />

      {/* One enormous photograph, then the brand's only real piece of
          swagger — and then, immediately, the verbs. */}
      {opener && (
        <section>
          <Link href={href(opener)} className="group block">
            {opener.heroUrl && (
              // eslint-disable-next-line @next/next/no-img-element -- Atlas-hosted
              <img
                src={opener.heroUrl}
                alt=""
                className="aspect-[4/5] w-full object-cover sm:aspect-[21/9]"
              />
            )}
          </Link>
          <div className="mx-auto max-w-[1800px] px-5 pt-6 sm:px-10 sm:pt-10">
            <h1 className="max-w-[14ch] text-[42px] leading-[0.88] font-extrabold tracking-[-0.05em] text-balance uppercase sm:text-[112px]">
              Go have
              <br />a day<span style={{ color: ACCENT }}>.</span>
            </h1>
            <p className="mt-4 max-w-[46ch] text-[15px] leading-relaxed text-black/50 sm:text-[18px]">
              {total.toLocaleString("en-CA")} real places and happenings around
              the Okanagan. None of them invented, none of them written by us.
            </p>
          </div>
        </section>
      )}

      {/* Findable fast: Atlas's own verbs, immediately, as plain links. */}
      {verbs.length > 0 && (
        <nav className="mx-auto mt-7 max-w-[1800px] px-5 sm:mt-10 sm:px-10">
          <ul className="flex flex-wrap items-baseline gap-x-7 gap-y-2 border-y border-black/10 py-4">
            {verbs.map((verb) => (
              <li key={verb.label}>
                <Link
                  href={`/labs/design/v4/adventure?doing=${encodeURIComponent(verb.label)}`}
                  data-testid="adventure-verb"
                  className="text-[20px] font-bold tracking-[-0.03em] first-letter:uppercase hover:text-black/50 sm:text-[26px]"
                >
                  {verb.label}
                  <span className="ml-1.5 text-[0.55em] font-semibold text-black/30 tabular-nums">
                    {verb.subjects.length}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}

      {/* Alternating bands. A statement, then a gallery, then the next. */}
      <div className="mt-12 flex flex-col gap-14 sm:mt-20 sm:gap-24">
        {shelves.map((theme, index) => (
          <section key={theme.key} data-testid="adventure-band">
            <div className="mx-auto max-w-[1800px] px-5 sm:px-10">
              {index === 1 && (
                <p className="mb-10 max-w-[20ch] border-t border-black/15 pt-6 text-[30px] leading-[0.95] font-extrabold tracking-[-0.045em] text-balance uppercase sm:mb-16 sm:text-[64px]">
                  Nobody ever
                  <br />
                  regretted going
                  <span style={{ color: ACCENT }}>.</span>
                </p>
              )}
              <h2 className="text-[28px] leading-[0.95] font-extrabold tracking-[-0.04em] text-balance uppercase sm:text-[52px]">
                {theme.title}
              </h2>
              <p className="mt-1.5 text-[13px] text-black/40 sm:text-[14px]">
                {theme.basis} · {theme.subjects.length}
              </p>
            </div>
            <div className="mt-5 sm:mt-7">
              <Shelf
                subjects={theme.subjects}
                href={href}
                ratio={index % 2 === 0 ? "3/2" : "4/5"}
                wide={index === 0}
              />
            </div>
          </section>
        ))}

        {/* One more enormous plate, as punctuation rather than decoration. */}
        {more[3] && (
          <section className="mx-auto w-full max-w-[1800px] px-0 sm:px-10">
            <Plate
              subject={more[3]}
              href={href(more[3])}
              ratio="2/1"
              size="large"
            />
          </section>
        )}
      </div>

      <footer className="mx-auto mt-16 max-w-[1800px] px-5 pb-20 sm:mt-24 sm:px-10">
        {rest.length > 0 && (
          <>
            <h2 className="text-[12px] font-semibold tracking-[0.1em] text-black/35 uppercase">
              Known, not photographed — we will not borrow a picture
            </h2>
            <ul className="mt-4 flex flex-wrap gap-x-8 gap-y-2">
              {rest.slice(0, 14).map((subject) => (
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
          </>
        )}
        <div className="mt-14 border-t border-black/10 pt-6">
          <Wordmark size="large" href="/labs/design/v4/adventure" />
        </div>
      </footer>
    </main>
  );
}
