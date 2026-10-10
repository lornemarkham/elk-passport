"use client";

import type { Invitation } from "@/domain/discovery/directions";

/**
 * **The page asks "What could you do?" — this is the first honest answer.**
 *
 * Everything underneath it is nouns: *Kalamoir Park*, *Stuart Park Ice Rink*,
 * *Kekuli Bay*. Those are records, and a person who does not already know what
 * they want cannot tell from a list of them that **skating** and **finding a
 * playground** are two different afternoons.
 *
 * So the verbs come first, in Atlas's own words, with the places that said so
 * named underneath as proof. Tapping one opens exactly those places — the
 * evidence that produced the invitation, not a second ranked list.
 *
 * ## What is not happening here
 *
 * No copy is written about any of it. The label is the affordance string Atlas
 * states; the count is how many subjects state it; the two names are the first
 * two of them. Passport does not promise it is open, does not say how long it
 * takes, does not price it, does not say who it suits and does not claim the
 * weather is right for it — none of which Atlas states, and all of which would
 * be invented by anyone writing "perfect for a sunny afternoon with the kids".
 */
export function InvitationStrip({
  invitations,
  near,
  selected,
  onSelect,
}: {
  readonly invitations: readonly Invitation[];
  /**
   * Whether this pool is genuinely near the reader.
   *
   * Only ever true once somebody has shared where they are **and** Atlas
   * placed things within reach of it. The counts mean different things in the
   * two cases, so they are said differently rather than left ambiguous.
   */
  readonly near: boolean;
  readonly selected?: string;
  readonly onSelect: (doing: string | undefined) => void;
}) {
  if (invitations.length === 0) return null;

  return (
    <section data-testid="invitations" aria-label="Things you could do">
      <p className="text-xs font-medium tracking-wide text-[#8a5a24] uppercase">
        {near ? "Things you could do near you" : "Things you could do"}
      </p>
      <ul className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        {invitations.map((invitation) => {
          const on = selected === invitation.doing;
          const count = invitation.places.length;
          return (
            <li key={invitation.doing}>
              <button
                type="button"
                data-testid="invitation"
                data-doing={invitation.doing}
                aria-pressed={on}
                onClick={() => onSelect(on ? undefined : invitation.doing)}
                className={
                  "flex h-full w-full flex-col gap-1 rounded-2xl border px-3 py-3 text-left transition-colors " +
                  (on
                    ? "border-[#2b2015] bg-[#2b2015] text-[#f7ecd3]"
                    : "border-[#8a5a24]/25 bg-[#f7ecd3]/50 hover:border-[#8a5a24]/55")
                }
              >
                {/* Atlas's own word, capitalised and otherwise untouched.
                    `mountain biking` stays mountain biking. */}
                <span className="font-heading text-base leading-tight first-letter:uppercase sm:text-lg">
                  {invitation.doing}
                </span>
                <span
                  className={
                    "text-[11px] tabular-nums " +
                    (on ? "text-[#f7ecd3]/70" : "text-[#2b2015]/50")
                  }
                >
                  {count} {count === 1 ? "place" : "places"}
                  {near ? " near you" : ""}
                </span>
                {/* The proof, said on the tile rather than one tap away. A
                    verb with no names behind it is a category; a verb with
                    Kekuli Bay behind it is somewhere to go. */}
                <span
                  className={
                    "line-clamp-2 text-[11px] leading-snug " +
                    (on ? "text-[#f7ecd3]/60" : "text-[#2b2015]/45")
                  }
                >
                  {invitation.examples.map((place) => place.title).join(" · ")}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
