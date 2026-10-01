import Link from "next/link";
import type { ReactNode } from "react";
import { destinationFor } from "@/domain/experience/destination";
import type { Experience } from "@/domain/experience/types";
import type { Closing } from "@/domain/october/dontMiss";

/**
 * **The one or two things on this page you could actually lose.**
 *
 * Deliberately not a badge. A badge on a card says *this card is slightly more
 * important than its neighbours*, which is a distinction nobody acts on. This
 * is its own block, above everything, with the subject at heading size and the
 * reason directly underneath in the one colour October reserves for urgency —
 * so the hierarchy actually changes rather than being decorated.
 *
 * ## The reason is the point
 *
 * "Don't miss" on its own is a marketing noise. "Final weekend" is a fact a
 * person can act on, and it is always rendered, always derived from days Atlas
 * states, and never softened. If `closingFor` cannot produce one, the subject
 * does not appear here.
 *
 * ## It disappears
 *
 * The caller renders nothing when nothing qualifies, which on the live corpus
 * is fourteen days of October. A section that is always present is furniture;
 * one that is usually absent is a signal.
 */
export function DontMiss({
  items,
  keep,
}: {
  readonly items: readonly { item: Experience; closing: Closing }[];
  /** The save control for a subject, drawn by the surface. */
  readonly keep?: (experience: Experience) => ReactNode;
}) {
  if (items.length === 0) return null;

  return (
    <section data-testid="dont-miss" className="mt-10">
      <p className="text-[11px] font-medium tracking-[0.2em] text-[#d09a4e] uppercase">
        Don&apos;t miss
      </p>

      <ul className="mt-3 flex flex-col gap-3">
        {items.map(({ item, closing }) => {
          const href = destinationFor(item);
          return (
            <li
              key={item.id}
              data-testid="dont-miss-item"
              data-days-left={closing.daysLeft}
              // One ember rule down the side rather than a box: it reads as
              // part of the page with something flagged, not as an ad.
              className="relative border-l-2 border-[#d09a4e]/60 pl-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  {href ? (
                    <Link
                      href={href}
                      data-testid="dont-miss-link"
                      className="font-heading text-2xl leading-tight text-[#f3efe4] underline-offset-4 hover:underline sm:text-3xl"
                    >
                      {item.title}
                    </Link>
                  ) : (
                    <p className="font-heading text-2xl leading-tight text-[#f3efe4] sm:text-3xl">
                      {item.title}
                    </p>
                  )}

                  {/* The fact, not the feeling. */}
                  <p
                    data-testid="dont-miss-reason"
                    className="mt-1 text-base font-medium text-[#d09a4e]"
                  >
                    {closing.reason}
                  </p>

                  {item.venue?.locality ? (
                    <p className="mt-0.5 text-sm text-[#e9e6da]/40">
                      {item.venue.locality}
                    </p>
                  ) : null}
                </div>

                {keep ? keep(item) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
