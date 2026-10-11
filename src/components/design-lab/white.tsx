import Link from "next/link";
import type { Subject } from "@/lib/design-lab/sample";

/**
 * **The two objects round three is built from.**
 *
 * Shared by all three white directions so they agree about what a photograph
 * *is* — edge to edge, no border, no radius, no shadow — and differ in how
 * they arrange them. That is the point of the round: the composition carries
 * the identity, because there is no decoration left to carry it.
 */

const RATIOS: Record<string, string> = {
  "21/9": "aspect-[16/10] sm:aspect-[21/9]",
  "2/1": "aspect-[3/2] sm:aspect-[2/1]",
  "3/2": "aspect-[3/2]",
  "4/5": "aspect-[4/5]",
  "3/4": "aspect-[3/4]",
  "1/1": "aspect-square",
};

/**
 * One photograph with its name under it.
 *
 * A subject Atlas has no picture for gets a **restrained fallback** — a white
 * field with a hairline and the name set large — rather than an unrelated
 * photograph or a grey block. Four subjects in five look like that, and
 * borrowing imagery for them would be the one unforgivable thing in a
 * photography-led design.
 */
export function Plate({
  subject,
  href,
  ratio = "3/2",
  size = "normal",
}: {
  readonly subject: Subject;
  readonly href: string;
  readonly ratio?: keyof typeof RATIOS | string;
  readonly size?: "hero" | "large" | "normal";
}) {
  const title =
    size === "hero"
      ? "text-[30px] sm:text-[64px] leading-[0.95]"
      : size === "large"
        ? "text-[22px] sm:text-[34px] leading-[1.02]"
        : "text-[18px] sm:text-[22px] leading-[1.05]";

  return (
    <Link href={href} data-testid="white-plate" className="group block">
      <div
        className={`relative w-full overflow-hidden bg-white ${RATIOS[ratio] ?? ratio}`}
      >
        {subject.heroUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- Atlas-hosted
          <img
            src={subject.heroUrl}
            alt=""
            className="h-full w-full object-cover transition-transform duration-[900ms] ease-out group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex h-full w-full items-end border-t border-black/15 p-4">
            <span className="text-[13px] text-black/35">No photograph</span>
          </div>
        )}
      </div>
      <div className="px-5 pt-3 sm:px-0">
        <h3 className={`font-bold tracking-[-0.03em] text-balance ${title}`}>
          {subject.title}
        </h3>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[13px] text-black/45">
          {(subject.place ?? subject.area) && (
            <span>{subject.place ?? subject.area}</span>
          )}
          {subject.recurs && (
            <span data-testid="plate-recurs" className="text-black/70">
              {subject.recurs}
            </span>
          )}
          {subject.doing[0] && <span>{subject.doing[0]}</span>}
        </p>
        {/* Atlas says when its own sentence adds nothing; those are left off
            entirely here rather than shrunk, because this direction has room
            for one line and should spend it on a real one. */}
        {size !== "normal" && subject.blurb && !subject.weakBlurb && (
          <p className="mt-2 max-w-[62ch] text-[15px] leading-[1.6] text-black/60">
            {subject.blurb}
          </p>
        )}
      </div>
    </Link>
  );
}

/**
 * **A swipeable shelf.** The round's main interaction.
 *
 * Cards nearly fill a phone with the next one visibly peeking, snap points so
 * a thumb lands square, and on a desktop the same row scrolls with a trackpad.
 * `overscroll-x-contain` keeps a swipe inside the shelf instead of triggering
 * the browser's back gesture.
 */
export function Shelf({
  subjects,
  href,
  ratio = "3/2",
  wide = false,
}: {
  readonly subjects: readonly Subject[];
  readonly href: (subject: Subject) => string;
  readonly ratio?: string;
  /** Wider cards, for a shelf that is the section rather than a fallback. */
  readonly wide?: boolean;
}) {
  if (subjects.length === 0) return null;
  return (
    <ul
      data-testid="white-shelf"
      className="flex snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain px-5 pb-2 sm:gap-8 sm:px-10"
    >
      {subjects.map((subject) => (
        <li
          key={subject.id}
          className={
            "shrink-0 snap-start " +
            (wide ? "w-[84vw] sm:w-[560px]" : "w-[78vw] sm:w-[380px]")
          }
        >
          <Plate subject={subject} href={href(subject)} ratio={ratio} />
        </li>
      ))}
    </ul>
  );
}
