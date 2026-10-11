import Link from "next/link";
import type { Metadata } from "next";
import { gallery, type Subject } from "@/lib/design-lab/sample";
import { LabNote } from "@/components/design-lab/LabNote";
import { Plate, Shelf } from "@/components/design-lab/white";

export const metadata: Metadata = { title: "Open Canvas — design lab" };
export const dynamic = "force-dynamic";

/**
 * **ROUND THREE, DIRECTION ONE — OPEN CANVAS.**
 *
 * Pure white, and almost nothing on it but photographs. Every previous round
 * put the pictures inside something — a sandstone spread, a dark frame, a
 * bordered tile. Here the page *is* white and the photograph is the only
 * object, so the excitement has to come from the place rather than from the
 * interface around it.
 *
 * ## The rhythm
 *
 * Image sizes alternate deliberately rather than tiling: a near-full-width
 * opener, then a tall pair, then one wide, then a trio. On a 1920px screen the
 * big plates run to 1680px; on a phone they run edge to edge and the pairs
 * become a swipeable shelf. That variation is the whole composition — there is
 * no other decoration to carry it.
 *
 * ## Typography
 *
 * Jakarta throughout, heavy, tight, large. No serif, no rules, no chips. A
 * title, a town, and — only where Atlas's sentence earns it — one line.
 *
 * ## Honesty
 *
 * A subject without a photograph never enters a plate, because a plate is a
 * photographic object and a grey rectangle would be the decoration this
 * direction exists without. They get a plain list at the end, and the count is
 * stated.
 */
export default async function OpenCanvas() {
  const { featured, rest, total } = await gallery(26);
  const [opener, ...more] = featured;
  const pair = more.slice(0, 2);
  const wide = more[2];
  const trio = more.slice(3, 6);
  const shelf = more.slice(6, 14);

  const href = (subject: Subject) =>
    `/labs/design/v3/open-canvas/${subject.id}`;

  return (
    <main className="min-h-screen bg-white text-black">
      <LabNote direction="open canvas" />

      <header className="mx-auto flex max-w-[1680px] items-baseline justify-between px-5 py-6 sm:px-10">
        <p className="text-[15px] font-bold tracking-[-0.02em]">Passport</p>
        <p className="text-[12px] text-black/40 tabular-nums">
          {total.toLocaleString("en-CA")} in the Okanagan
        </p>
      </header>

      {opener && (
        <section className="mx-auto max-w-[1680px] px-0 sm:px-10">
          <Plate
            subject={opener}
            href={href(opener)}
            ratio="21/9"
            size="hero"
          />
        </section>
      )}

      <section className="mx-auto mt-4 max-w-[1680px] px-0 sm:mt-10 sm:px-10">
        {/* A tall pair. Side by side on a wide screen, a swipeable shelf on a
            phone — the first place this direction goes horizontal. */}
        <div className="hidden gap-8 sm:grid sm:grid-cols-2">
          {pair.map((subject) => (
            <Plate
              key={subject.id}
              subject={subject}
              href={href(subject)}
              ratio="4/5"
              size="large"
            />
          ))}
        </div>
        <div className="sm:hidden">
          <Shelf subjects={pair} href={href} ratio="4/5" />
        </div>
      </section>

      {wide && (
        <section className="mx-auto mt-4 max-w-[1680px] px-0 sm:mt-10 sm:px-10">
          <Plate subject={wide} href={href(wide)} ratio="2/1" size="large" />
        </section>
      )}

      <section className="mx-auto mt-4 max-w-[1680px] px-0 sm:mt-10 sm:px-10">
        <div className="hidden gap-8 sm:grid sm:grid-cols-3">
          {trio.map((subject) => (
            <Plate
              key={subject.id}
              subject={subject}
              href={href(subject)}
              ratio="3/4"
            />
          ))}
        </div>
        <div className="sm:hidden">
          <Shelf subjects={trio} href={href} ratio="3/4" />
        </div>
      </section>

      {shelf.length > 0 && (
        <section className="mt-10 sm:mt-20">
          <h2 className="mx-auto max-w-[1680px] px-5 text-[26px] font-bold tracking-[-0.03em] sm:px-10 sm:text-[40px]">
            Keep going
          </h2>
          <div className="mt-4 sm:mt-6">
            <Shelf subjects={shelf} href={href} ratio="3/2" wide />
          </div>
        </section>
      )}

      {rest.length > 0 && (
        <section className="mx-auto mt-14 max-w-[1680px] px-5 pb-20 sm:mt-24 sm:px-10">
          <h2 className="text-[13px] font-semibold tracking-[0.1em] text-black/35 uppercase">
            No photograph — {rest.length} of what Atlas holds
          </h2>
          <ul className="mt-4 flex flex-wrap gap-x-8 gap-y-2">
            {rest.slice(0, 14).map((subject) => (
              <li key={subject.id}>
                <Link
                  href={href(subject)}
                  className="text-[17px] font-semibold tracking-[-0.015em] text-black/45 transition-colors hover:text-black"
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
