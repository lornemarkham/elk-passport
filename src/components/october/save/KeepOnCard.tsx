"use client";

import { Check, Heart, Loader2 } from "lucide-react";
import { useKeeping, type Keepable } from "./keeping";

/**
 * **Deciding without opening the thing.**
 *
 * A person scanning October already knows, quite often, that they want a
 * particular night. Until now the only way to say so was to open the subject,
 * read a page they had already decided about, and press a button at the foot
 * of it. The decision was made on the card; the product made them travel to
 * record it.
 *
 * ## It is a mark, not a button
 *
 * October's cards are photographs and titles, and the card is the star. So
 * this is the quietest thing that can still be pressed: an outline heart in
 * the corner, no label, no chrome, no fill — until it is kept, when it becomes
 * an ember tick and says *In My October* in the smallest type on the card.
 * Nothing covers the image, the title or the dates; it sits in the margin the
 * layout already had.
 *
 * On a phone there is no hover, so it is always visible at low contrast rather
 * than revealed. A control that appears on hover is a control that does not
 * exist on the device most of this is read on.
 *
 * ## Inside a card that is itself a link
 *
 * The card's whole surface navigates, which is right on a phone. That makes a
 * nested `<button>` two problems at once: invalid HTML, and a press that
 * navigates instead of saving. Cards using this put their link in an
 * *overlay* — `absolute inset-0` — and this sits above it, so the two targets
 * are siblings rather than nested and each does exactly one thing.
 *
 * `stopPropagation` as well, because a stray click that opened the page after
 * a successful save would undo the whole point of deciding from here.
 */
export function KeepOnCard({
  thing,
  initiallySaved = false,
  signedIn,
  returnTo,
}: {
  readonly thing: Keepable;
  readonly initiallySaved?: boolean;
  readonly signedIn: boolean;
  /** Where signing in should bring them back to — the surface they are on. */
  readonly returnTo: string;
}) {
  const { saved, state, toggle } = useKeeping(thing, initiallySaved);

  if (!signedIn) {
    // The detail page's rule, in miniature: never a saved state for somebody
    // with nowhere to save it, and never a control that silently does nothing.
    return (
      <a
        href={`/auth?next=${encodeURIComponent(returnTo)}`}
        data-testid="keep-signed-out"
        aria-label={`Sign in to keep ${thing.name} in your October`}
        title="Sign in to keep this"
        onClick={(event) => event.stopPropagation()}
        className="relative z-10 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[#e9e6da]/30 transition-colors hover:bg-[#e9e6da]/[0.06] hover:text-[#e9e6da]/70"
      >
        <Heart className="h-[18px] w-[18px]" />
      </a>
    );
  }

  return (
    <span className="relative z-10 inline-flex shrink-0 flex-col items-end">
      <button
        type="button"
        data-testid="keep-on-card"
        data-saved={saved ? "true" : "false"}
        aria-pressed={saved}
        aria-label={
          saved
            ? `${thing.name} is in your October. Remove it?`
            : `Keep ${thing.name} in your October`
        }
        disabled={state === "saving"}
        onClick={(event) => {
          // The card underneath is a link. This press is not for it.
          event.preventDefault();
          event.stopPropagation();
          void toggle();
        }}
        className={`inline-flex h-11 w-11 items-center justify-center rounded-full transition-colors disabled:opacity-60 ${
          saved
            ? "text-[#d09a4e] hover:bg-[#d09a4e]/10"
            : "text-[#e9e6da]/30 hover:bg-[#e9e6da]/[0.06] hover:text-[#e9e6da]/70"
        }`}
      >
        {state === "saving" ? (
          <Loader2 className="h-[18px] w-[18px] animate-spin" />
        ) : saved ? (
          <Check className="h-[18px] w-[18px]" />
        ) : (
          <Heart className="h-[18px] w-[18px]" />
        )}
      </button>

      {/* Said once, in the smallest type October has, and only when true. */}
      {saved && state !== "failed" ? (
        <span
          data-testid="keep-kept-label"
          className="-mt-1 mr-0.5 text-[10px] tracking-wider whitespace-nowrap text-[#d09a4e]/70 uppercase"
        >
          In My October
        </span>
      ) : null}

      {state === "failed" ? (
        <span
          data-testid="keep-failed"
          className="-mt-1 mr-0.5 text-[10px] tracking-wider whitespace-nowrap text-[#d09a4e]/80"
        >
          didn&apos;t save
        </span>
      ) : null}
    </span>
  );
}
